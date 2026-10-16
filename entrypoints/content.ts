import { browser, defineContentScript } from '#imports';
import { FormFiller, type ClassifyRemote } from '@/lib/engine';
import { EsAssist } from '@/lib/es-assist';
import { matchCompany } from '@/lib/sophon-link';
import { getActiveProfile, getSettings, sophonDataItem, sophonOutboxItem } from '@/lib/store';
import type { FrameStatus, RemoteAnswer } from '@/lib/types';

type Global = typeof globalThis & { __recruitAI?: { run(action: string, payload: unknown): Promise<FrameStatus> } };

export default defineContentScript({
  // manifest には登録せず、ポップアップ・ショートカットから executeScript で注入する
  registration: 'runtime',
  main() {
    const g = globalThis as Global;
    if (g.__recruitAI) return;

    const filler = new FormFiller(document);
    let assist: EsAssist | null = null;
    let recorded = false;

    /**
     * Sophon とつながっていれば、このページがどの企業のものかを調べて、
     * フローティングバーに「ボードに記録」を出し、記述欄では ES を候補に出す。
     */
    const linkSophon = async () => {
      const data = await sophonDataItem.getValue();
      if (!data) return;
      // 応募フォームが iframe の中にあるときは、親ページの URL でも探す
      const urls = [location.href, ...Array.from(location.ancestorOrigins ?? [])];
      const company = urls.map((u) => matchCompany(u, data.companies)).find(Boolean);
      filler.setLink(
        company
          ? {
              company: company.name,
              recorded,
              onRecord: async () => {
                recorded = true;
                const outbox = await sophonOutboxItem.getValue();
                await sophonOutboxItem.setValue([
                  ...outbox,
                  { id: crypto.randomUUID(), companyId: company.id, at: new Date().toISOString(), url: location.href, esAnswerIds: [...(assist?.used ?? [])] },
                ]);
              },
            }
          : null,
      );
      const used = assist?.used;
      assist?.stop();
      assist = new EsAssist(document, data.esAnswers, company?.id);
      used?.forEach((id) => assist!.used.add(id));
      assist.start();
    };

    const classifyRemote: ClassifyRemote = async (formText, questions) => {
      const res = (await browser.runtime.sendMessage({ type: 'classify', formText, questions })) as
        | { answers: RemoteAnswer[] }
        | { error: string };
      if ('error' in res) throw new Error(res.error);
      return res.answers;
    };

    /**
     * 別のサイトから埋め込まれたフォーム枠（応募システムの iframe など）の origin。
     * activeTab で入力できるのは開いているページのサイトだけなので、ポップアップがこの一覧を見て追加の許可をお願いする
     */
    const iframeOrigins = () => {
      const origins = new Set<string>();
      for (const frame of Array.from(document.querySelectorAll('iframe'))) {
        const r = frame.getBoundingClientRect();
        if (r.width < 150 || r.height < 100) continue;
        try {
          const url = new URL(frame.src, location.href);
          if (/^https?:$/.test(url.protocol) && url.origin !== location.origin) origins.add(url.origin);
        } catch {
          // src が壊れている枠は無視する
        }
      }
      return [...origins];
    };

    const handle = async (action: string, payload: unknown): Promise<FrameStatus> => {
      switch (action) {
        case 'fill': {
          const [profile, settings] = await Promise.all([getActiveProfile(), getSettings()]);
          if (!profile) {
            if (window === window.top) filler.notice('プロフィールが未登録です。らくらくエントリー のアイコンから登録してください');
            return { detected: 0, filled: 0, warn: 0, reviews: [], error: 'no-profile' };
          }
          await linkSophon();
          return filler.fill(profile, settings, settings.engine === 'openai' ? classifyRemote : undefined);
        }
        case 'undo':
          return filler.undo();
        case 'diagnose':
          return { ...filler.status(), report: filler.diagnose() };
        case 'resolve': {
          const { id, value } = payload as { id: string; value: string };
          return filler.resolve(id, value);
        }
        default:
          return filler.preview();
      }
    };

    g.__recruitAI = {
      async run(action, payload) {
        const status = await handle(action, payload);
        return window === window.top ? { ...status, iframeOrigins: iframeOrigins() } : status;
      },
    };
  },
});
