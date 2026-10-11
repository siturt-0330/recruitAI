import { describeForm, scanFields, type ScannedField } from './extract';
import { FIELD_KEYS, isFieldKey, type FieldKey } from './fieldKeys';
import { applyValue, hasUserValue, markTarget, restoreSnapshot, takeSnapshot, type Snapshot } from './fill';
import { Overlay } from './overlay';
import { classify, computeHints, type Classification } from './rules';
import type { FieldStatus, FrameStatus, Profile, RemoteAnswer, RemoteQuestion, Settings } from './types';
import { valueVariants } from './values';

export type ClassifyRemote = (formText: string, questions: RemoteQuestion[]) => Promise<RemoteAnswer[]>;

interface Result {
  field: ScannedField;
  key: FieldKey | null;
  confidence: number;
  source: 'rule' | 'ai';
  status: FieldStatus;
  value: string;
  variants: string[];
}

/** AI に問い合わせる欄の上限（1リクエストあたり） */
const MAX_REMOTE_QUESTIONS = 60;
/** これ未満の確信度では入力しない */
const MIN_CONFIDENCE = 0.5;

export class FormFiller {
  private results: Result[] = [];
  private snapshots = new Map<ScannedField, Snapshot>();
  private overlay: Overlay;

  constructor(private doc: Document) {
    this.overlay = new Overlay(doc, {
      onUndo: () => this.undo(),
      onClose: () => this.overlay.clear(),
    });
  }

  /** 入力前のプレビュー。ルールで判定できる欄の数だけ返す */
  preview(): FrameStatus {
    if (this.results.length) return this.status();
    const detected = scanFields(this.doc).filter((f) => classify(f.desc).key).length;
    return { detected, filled: 0, warn: 0, reviews: [] };
  }

  async fill(profile: Profile, settings: Settings, classifyRemote?: ClassifyRemote): Promise<FrameStatus> {
    this.undo();
    const fields = scanFields(this.doc);
    const classes = fields.map((f) => classify(f.desc));

    let aiError: string | undefined;
    if (classifyRemote) {
      try {
        await this.refineWithAi(fields, classes, settings.threshold, classifyRemote);
      } catch (e) {
        aiError = e instanceof Error ? e.message : String(e);
      }
    }

    this.results = fields.map((field, i) => {
      const { key, confidence, source } = classes[i]!;
      const result: Result = { field, key, confidence, source, status: 'skip', value: '', variants: [] };
      if (!key || confidence < MIN_CONFIDENCE || hasUserValue(field)) return result;

      result.variants = valueVariants(key, profile, computeHints(field.desc), field.desc.kind);
      this.snapshots.set(field, takeSnapshot(field));
      const applied = applyValue(field, result.variants);
      if (applied == null) {
        result.status = 'empty';
        return result;
      }
      result.value = applied;
      result.status = confidence >= settings.threshold ? 'ok' : 'warn';
      return result;
    });

    this.render();
    return { ...this.status(), aiError };
  }

  /** ルールで判定できなかった・確信度が低い欄だけ AI に聞く */
  private async refineWithAi(
    fields: ScannedField[],
    classes: Classification[],
    threshold: number,
    classifyRemote: ClassifyRemote,
  ) {
    const targets = fields
      .map((f, i) => ({ f, i }))
      .filter(({ i }) => !classes[i]!.key || classes[i]!.confidence < threshold)
      .slice(0, MAX_REMOTE_QUESTIONS);
    if (!targets.length) return;

    const answers = await classifyRemote(
      describeForm(fields),
      targets.map(({ f }) => ({
        name: f.desc.id,
        instructions: `入力欄 [${f.desc.id}] には、どのプロフィール項目を入力すべきですか？`,
      })),
    );
    const byName = new Map(answers.map((a) => [a.name, a]));
    for (const { f, i } of targets) {
      const a = byName.get(f.desc.id);
      if (!a) continue;
      if (a.choice === 'none') {
        if (a.confidence >= 0.8) classes[i] = { key: null, confidence: a.confidence, source: 'ai' };
      } else if (isFieldKey(a.choice) && a.confidence > classes[i]!.confidence) {
        classes[i] = { key: a.choice, confidence: a.confidence, source: 'ai' };
      }
    }
  }

  /** 要確認の欄をユーザーが選んだ値で確定する */
  resolve(id: string, value: string): FrameStatus {
    const r = this.results.find((r) => r.field.desc.id === id);
    if (r) {
      const applied = applyValue(r.field, [value]);
      if (applied != null) {
        r.value = applied;
        r.status = 'ok';
        r.confidence = 1;
      }
      this.render();
    }
    return this.status();
  }

  undo(): FrameStatus {
    for (const [field, snap] of this.snapshots) restoreSnapshot(field, snap);
    this.snapshots.clear();
    this.results = [];
    this.overlay.clear();
    return this.status();
  }

  status(): FrameStatus {
    const recognized = this.results.filter((r) => r.key);
    const warn = recognized.filter((r) => r.status === 'warn');
    return {
      detected: recognized.length,
      filled: recognized.filter((r) => r.status === 'ok' || r.status === 'warn').length,
      warn: warn.length,
      reviews: warn.map((r) => ({
        id: r.field.desc.id,
        label: r.field.desc.label || r.field.desc.context || r.field.desc.placeholder,
        keyLabel: FIELD_KEYS[r.key!].label,
        confidence: r.confidence,
        source: r.source,
        current: r.value,
        alternatives: r.variants.filter((v) => v !== r.value).slice(0, 2),
      })),
    };
  }

  private render() {
    const filled = this.results.filter((r) => r.status === 'ok' || r.status === 'warn');
    this.overlay.render(
      filled.map((r) => ({ el: markTarget(r.field), status: r.status as 'ok' | 'warn', ai: r.source === 'ai' })),
      { filled: filled.length, warn: filled.filter((r) => r.status === 'warn').length },
    );
  }
}
