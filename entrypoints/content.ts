import { browser, defineContentScript } from '#imports';
import { FormFiller, type ClassifyRemote } from '@/lib/engine';
import { getActiveProfile, getSettings } from '@/lib/store';
import type { FrameStatus, RemoteAnswer } from '@/lib/types';

type Global = typeof globalThis & { __recruitAI?: { run(action: string, payload: unknown): Promise<FrameStatus> } };

export default defineContentScript({
  // manifest には登録せず、ポップアップ・ショートカットから executeScript で注入する
  registration: 'runtime',
  main() {
    const g = globalThis as Global;
    if (g.__recruitAI) return;

    const filler = new FormFiller(document);

    const classifyRemote: ClassifyRemote = async (formText, questions) => {
      const res = (await browser.runtime.sendMessage({ type: 'classify', formText, questions })) as
        | { answers: RemoteAnswer[] }
        | { error: string };
      if ('error' in res) throw new Error(res.error);
      return res.answers;
    };

    g.__recruitAI = {
      async run(action, payload) {
        switch (action) {
          case 'fill': {
            const [profile, settings] = await Promise.all([getActiveProfile(), getSettings()]);
            if (!profile) return { detected: 0, filled: 0, warn: 0, reviews: [], error: 'no-profile' };
            return filler.fill(profile, settings, settings.engine === 'openai' ? classifyRemote : undefined);
          }
          case 'undo':
            return filler.undo();
          case 'resolve': {
            const { id, value } = payload as { id: string; value: string };
            return filler.resolve(id, value);
          }
          default:
            return filler.preview();
        }
      },
    };
  },
});
