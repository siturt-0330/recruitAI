import { describeForm, scanFields, type ScannedField } from './extract';
import { FIELD_KEYS, isFieldKey, type FieldKey } from './fieldKeys';
import { applyValue, hasUserValue, markTarget, restoreSnapshot, takeSnapshot, type Snapshot } from './fill';
import { Overlay } from './overlay';
import { adjustForForm, classify, computeHints, type Classification } from './rules';
import type { FieldStatus, FrameStatus, Profile, RemoteAnswer, RemoteQuestion, Settings } from './types';
import { SAYS_NONE, valueVariants } from './values';
import { norm } from './japanese';

export type ClassifyRemote = (formText: string, questions: RemoteQuestion[]) => Promise<RemoteAnswer[]>;

interface Result {
  field: ScannedField;
  key: FieldKey | null;
  confidence: number;
  source: 'rule' | 'ai';
  status: FieldStatus;
  value: string;
  variants: string[];
  /** 欄は判定できたが、プロフィールにその項目が未登録だった */
  noData: boolean;
}

/** AI に問い合わせる欄の上限（1リクエストあたり） */
const MAX_REMOTE_QUESTIONS = 60;
/** これ未満の確信度では入力しない */
const MIN_CONFIDENCE = 0.5;
/** 連動するプルダウン（年→月→日）の選択肢が作られるのを待つ間隔 */
const RETRY_DELAYS = [150, 300, 600];
/** 入力したあと、新しく入力できるようになった欄を探すまでの待ち時間 */
const NEW_FIELD_DELAY = 200;
/** サイト側の自動入力（郵便番号からの住所検索など）が終わるのを待つ時間 */
const OVERWRITE_CHECK_DELAY = 500;

/** 未登録の項目として案内するときは、分割欄や自動生成の項目を元の入力項目にまとめる */
const MISSING_ALIAS: Partial<Record<FieldKey, FieldKey>> = {
  emailConfirm: 'email',
  phone1: 'phone',
  phone2: 'phone',
  phone3: 'phone',
  landline1: 'landline',
  landline2: 'landline',
  landline3: 'landline',
  cityAddressLine: 'city',
  postalCode1: 'postalCode',
  postalCode2: 'postalCode',
  kiseiPostalCode1: 'kiseiPostalCode',
  kiseiPhone1: 'kiseiPhone',
  kiseiPhone2: 'kiseiPhone',
  kiseiPhone3: 'kiseiPhone',
  kiseiCityAddressLine: 'kiseiCity',
  highSchoolGraduationYear: 'highSchoolGraduation',
  highSchoolGraduationMonth: 'highSchoolGraduation',
  highSchoolGraduated: 'highSchool',
  schoolInitial: 'schoolKana',
  emailLocal: 'email',
  emailSubLocal: 'emailSub',
  emailSubConfirm: 'emailSub',
  emailSubDomain: 'emailSub',
  emailDomain: 'email',
  birthEra: 'birthDate',
  birthEraYear: 'birthDate',
  availableDate: 'graduation',
  kiseiPostalCode2: 'kiseiPostalCode',
  birthYear: 'birthDate',
  birthMonth: 'birthDate',
  birthDay: 'birthDate',
  age: 'birthDate',
  admissionYear: 'admission',
  admissionMonth: 'admission',
  graduationYear: 'graduation',
  graduationMonth: 'graduation',
  prefectureKana: 'prefecture',
  fullAddressKana: 'cityKana',
  educationHistory: 'admission',
  hobbiesAndSkills: 'hobbies',
  desiredLocation2: 'desiredLocation1',
  desiredLocation3: 'desiredLocation1',
};

/**
 * 「現住所と同じ場合はチェック（チェックしたら休暇中住所は入力しない）」という形式に合わせる。
 * 帰省先が現住所と同じなら、チェックを入れて同じフォームの帰省先の欄には何も入れない。
 */
function skipKiseiWhenSame(fields: ScannedField[], classes: Classification[], profile: Profile) {
  if (!profile.kiseiSame) return;
  const formOf = (f: ScannedField) => (f.elements[0] as HTMLInputElement).form ?? null;
  const formsWithCheck = new Set(fields.filter((_, i) => classes[i]!.key === 'kiseiSameCheck').map(formOf));
  if (!formsWithCheck.size) return;
  fields.forEach((f, i) => {
    const key = classes[i]!.key;
    if (key?.startsWith('kisei') && key !== 'kiseiSameCheck' && formsWithCheck.has(formOf(f))) {
      classes[i] = { key: null, confidence: 0, source: 'rule' };
    }
  });
}

/** 入れたプルダウンの選択が、今も残っているか */
function stillSelected(r: Result): boolean {
  const el = r.field.elements[0] as HTMLSelectElement;
  return el.selectedIndex >= 0 && el.options[el.selectedIndex]?.text.trim() === r.value;
}

/** 「※大学院に所属している方のみ」のような条件付きの欄と、その条件をプロフィールが満たすか */
const CONDITIONS: [RegExp, (p: Profile) => boolean][] = [
  [/博士.{0,8}(の方|方|者)のみ/, (p) => p.schoolType === '大学院（博士）'],
  [/大学院.{0,12}(の方|方|者|生)のみ|大学院に(所属|在籍)/, (p) => p.schoolType.startsWith('大学院')],
  [/(既卒|社会人|卒業された|卒業済).{0,8}(の方|方|者)のみ/, (p) => p.graduationStatus === 'graduated'],
  [/留学.{0,12}(の方|方|者)のみ/, (p) => !!p.studyAbroad && !SAYS_NONE.test(p.studyAbroad.normalize('NFKC'))],
];

/** 卒業年月の欄が、直前のどの欄（高校・在籍校・条件付きで飛ばした欄）に続くものかを見る範囲 */
const OWNER_DISTANCE = 3;

/**
 * 条件に合わない欄を飛ばし、「卒業年月」がどの学校のものかを直前の欄から決める。
 * 例：「出身高校」の直後の卒業年月は高校の卒業年月、飛ばした「出身大学（大学院生のみ）」の直後の卒業年月も飛ばす。
 */
function applyConditions(fields: ScannedField[], classes: Classification[], profile: Profile) {
  let owner: { kind: 'current' | 'high' | 'skip'; index: number } = { kind: 'current', index: -Infinity };
  fields.forEach((f, i) => {
    const c = classes[i]!;
    if (!c.key) return;
    const d = f.desc;
    const text = norm(`${d.label} ${d.prefix} ${d.context}`);
    if (CONDITIONS.some(([re, ok]) => re.test(text) && !ok(profile))) {
      classes[i] = { key: null, confidence: 0, source: c.source };
      owner = { kind: 'skip', index: i };
      return;
    }
    if (c.key === 'highSchool') owner = { kind: 'high', index: i };
    else if (/^(school|schoolKana|faculty|department|lab)$/.test(c.key)) owner = { kind: 'current', index: i };
    else if (/^graduation(Year|Month)?$/.test(c.key) && i - owner.index <= OWNER_DISTANCE) {
      if (owner.kind === 'skip') classes[i] = { key: null, confidence: 0, source: c.source };
      if (owner.kind === 'high') {
        classes[i] = { ...c, key: c.key.replace('graduation', 'highSchoolGraduation') as FieldKey };
      }
    }
  });
}

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
    const classes = adjustForForm(
      fields,
      fields.map((f) => classify(f.desc)),
    );

    let aiError: string | undefined;
    if (classifyRemote) {
      try {
        await this.refineWithAi(fields, classes, settings.threshold, classifyRemote);
      } catch (e) {
        aiError = e instanceof Error ? e.message : String(e);
      }
    }
    skipKiseiWhenSame(fields, classes, profile);
    applyConditions(fields, classes, profile);

    this.results = fields.map((field, i) => this.fillField(field, classes[i]!, profile, settings));

    await this.retryDependentSelects(settings.threshold);
    await this.fillNewlyAvailable(profile, settings);
    await this.reapplyOverwritten(settings.threshold);

    this.render();
    return { ...this.status(), aiError };
  }

  private fillField(field: ScannedField, c: Classification, profile: Profile, settings: Settings): Result {
    const { key, confidence, source } = c;
    const result: Result = { field, key, confidence, source, status: 'skip', value: '', variants: [], noData: false };
    if (!key || confidence < MIN_CONFIDENCE || hasUserValue(field)) return result;

    result.variants = valueVariants(key, profile, computeHints(field.desc), field.desc.kind, field.desc.options);
    if (!result.variants.length) {
      result.status = 'empty';
      result.noData = true;
      return result;
    }
    this.snapshots.set(field, takeSnapshot(field));
    this.apply(result, settings.threshold);
    return result;
  }

  /**
   * 郵便番号を入れると住所を自動で埋めるサイト（ajaxzip3 など）は、少し遅れて住所の欄を書き換える。
   * そのせいで入れた番地が消えることがあるので、書き換わった文字の欄を入れ直す。
   */
  private async reapplyOverwritten(threshold: number) {
    await new Promise((resolve) => setTimeout(resolve, OVERWRITE_CHECK_DELAY));
    for (const r of this.results) {
      if (r.status !== 'ok' && r.status !== 'warn') continue;
      const el = r.field.elements[0];
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
      if (el.type === 'radio' || el.type === 'checkbox' || el.type === 'file') continue;
      if (el.value !== r.value) this.apply(r, threshold);
    }
  }

  /**
   * 「入学年月を選ぶと卒業年月が選べるようになる」「学校区分を選ぶと欄が出てくる」フォームがある。
   * 入力後にもう一度ページを調べ、新しく入力できるようになった欄にも入れる（AI には聞かずルールだけ）。
   */
  private async fillNewlyAvailable(profile: Profile, settings: Settings) {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve, NEW_FIELD_DELAY));
      const known = new Set(this.results.flatMap((r) => r.field.elements));
      const fields = scanFields(this.doc);
      const freshIndexes = fields.map((f, i) => (f.elements.some((e) => known.has(e)) ? -1 : i)).filter((i) => i >= 0);
      if (!freshIndexes.length) return;
      const classes = adjustForForm(fields, fields.map((f) => classify(f.desc)));
      skipKiseiWhenSame(fields, classes, profile);
      applyConditions(fields, classes, profile);
      for (const i of freshIndexes) this.results.push(this.fillField(fields[i]!, classes[i]!, profile, settings));
    }
  }

  private apply(result: Result, threshold: number): boolean {
    const applied = applyValue(result.field, result.variants);
    if (applied == null) {
      result.status = 'empty';
      return false;
    }
    result.value = applied;
    result.status = result.confidence >= threshold ? 'ok' : 'warn';
    return true;
  }

  /**
   * 年を選ぶと月の選択肢が、月を選ぶと日の選択肢が作られるフォームがある。
   * 選択肢が見つからなかったプルダウンは、少し待ってから入れ直す。
   */
  private async retryDependentSelects(threshold: number) {
    const selects = this.results.filter((r) => r.field.desc.kind === 'select' && r.variants.length && !r.noData);
    if (!selects.length) return;
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
      // 選択肢が後から作られたもの、作り直されて選択が消えたものを入れ直す
      const pending = selects.filter((r) => r.status === 'empty' || !stillSelected(r));
      if (!pending.length) return;
      for (const r of pending) this.apply(r, threshold);
    }
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

  /**
   * 不具合を調べるための診断情報。各欄の手がかりと判定結果を並べる。
   * 入力した値やプロフィールの中身は含めない（ページ側の文言と判定結果だけ）。
   */
  diagnose(): string {
    const rows = this.results.length
      ? this.results.map((r) => ({ desc: r.field.desc, key: r.key, confidence: r.confidence, source: r.source, status: r.status }))
      : (() => {
          const fields = scanFields(this.doc);
          const classes = adjustForForm(fields, fields.map((f) => classify(f.desc)));
          return fields.map((f, i) => ({ desc: f.desc, ...classes[i]!, status: '未入力' as const }));
        })();
    const q = (s: string) => (s ? JSON.stringify(s.slice(0, 50)) : '-');
    const lines = rows.map(({ desc: d, key, confidence, source, status }) =>
      [
        `[${d.id}] ${d.kind}`,
        `label=${q(d.label)}`,
        `見出し=${q(d.context)}`,
        `区切り=${q(d.section)}`,
        `前=${q(d.prefix)}`,
        `後=${q(d.suffix)}`,
        `name=${q(d.name || d.htmlId)}`,
        d.options.length ? `選択肢=${d.options.length}件${q(d.options.slice(0, 4).join('/'))}` : '',
        `group=${d.groupIndex + 1}/${d.groupSize} line=${d.lineIndex + 1}/${d.lineSize}`,
        `→ ${key ?? 'なし'} (${Math.round(confidence * 100)}% ${source}) ${status}`,
      ]
        .filter(Boolean)
        .join(' | '),
    );
    return [`URL: ${location.host}${location.pathname}`, `欄: ${rows.length}件`, ...lines].join('\n');
  }

  /** ページ右下に短いお知らせを出す（ショートカットで入力しようとしたが、できなかったときなど） */
  notice(message: string) {
    this.overlay.notice(message);
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
    const missing = new Map<string, { key: string; label: string }>();
    for (const r of recognized) {
      const key = MISSING_ALIAS[r.key!] ?? r.key!;
      if (r.noData && !missing.has(key)) missing.set(key, { key, label: FIELD_KEYS[key].label });
    }
    return {
      missing: [...missing.values()],
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
