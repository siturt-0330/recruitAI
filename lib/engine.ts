import { applyCombo, comboStill, comboText, restoreCombo } from './combo';
import { describeForm, scanFields, type ScannedField } from './extract';
import { FIELD_KEYS, isFieldKey, type FieldKey } from './fieldKeys';
import { applyValue, hasUserValue, markTarget, restoreSnapshot, takeSnapshot, type Snapshot } from './fill';
import { Overlay, type BarLink } from './overlay';
import { adjustForForm, classify, computeHints, type Classification } from './rules';
import type { FieldStatus, FrameStatus, Profile, RemoteAnswer, RemoteQuestion, Settings } from './types';
import { kiseiIsSame, SAYS_NONE, valueVariants } from './values';
import { norm } from './japanese';
import { jqDecoy } from './jqtransform';

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
/** それでも選択肢が出てこないプルダウンが残っているときだけ、さらに待つ間隔（サーバーに聞いてから選択肢を作る遅いサイト） */
const SLOW_RETRY_DELAYS = [1000, 1500];
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
  highSchoolAdmissionYear: 'highSchoolAdmission',
  highSchoolAdmissionMonth: 'highSchoolAdmission',
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
  if (!kiseiIsSame(profile)) return;
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
/** 欄が画面に表示されているか（隠れたページ・消えた要素は false）。飾りで本体を隠したラジオなどはラベルで見る */
function onScreen(field: ScannedField): boolean {
  return field.elements.some(
    (el) =>
      el.isConnected &&
      (el.getClientRects().length > 0 ||
        Array.from((el as HTMLInputElement).labels ?? []).some((l) => l.getClientRects().length > 0) ||
        (jqDecoy(el)?.getClientRects().length ?? 0) > 0),
  );
}

/**
 * 入れた値と今の値が同じか。サイトが少し遅れて書式を整える（ハイフン・スペースを消すなど）こともあるので、
 * 全角半角・スペース・ハイフンの違いは無視する
 */
function sameText(a: string, b: string): boolean {
  const loose = (s: string) => s.normalize('NFKC').replace(/[\s\-‐－−ー―]/g, '');
  return a === b || loose(a) === loose(b);
}

/** 入れた値がそのまま残っているか（入力できなかった欄・ユーザーが書き直した欄は false） */
function keptAsFilled(r: Result): boolean {
  if (r.status !== 'ok' && r.status !== 'warn') return false;
  const el = r.field.elements[0]!;
  if (r.field.combo) return comboStill(el, r.value);
  if (r.field.desc.kind === 'file') return true;
  if (r.field.desc.kind === 'checkbox') return (el as HTMLInputElement).checked === (r.value === 'チェックあり');
  if (r.field.desc.kind === 'radio') {
    const i = r.field.elements.findIndex((e) => (e as HTMLInputElement).checked);
    return i >= 0 && r.field.desc.options[i] === r.value;
  }
  if (el instanceof HTMLSelectElement) return stillSelected(r);
  return sameText((el as HTMLInputElement | HTMLTextAreaElement).value, r.value);
}

function stillSelected(r: Result): boolean {
  const el = r.field.elements[0] as HTMLSelectElement;
  return el.selectedIndex >= 0 && el.options[el.selectedIndex]?.text.trim() === r.value;
}

/** 「※大学院に所属している方のみ」のような条件付きの欄と、その条件をプロフィールが満たすか */
const isGrad = (p: Profile) => p.schoolType.startsWith('大学院');
const CONDITIONS: [RegExp, (p: Profile) => boolean][] = [
  // 博士の人の修士課程の学校（「博士（博士後期課程）の方は修士課程の〜」）はプロフィールにない
  [/博士.{0,10}の方は.{0,3}修士/, () => false],
  // 博士課程の人だけ（「修士・博士課程の方のみ」は大学院生）。「上記で『博士』を選択し〜」「『博士』を選択した場合のみ」も
  [/(?<![・、/／])(?<!修士.{0,8})(博士(後期)?課程|博士|ドクター)(に)?(在籍|在学)?(している|中)?の?(方|者|生)?(のみ|だけ|に限り)|博士.{0,3}を?選択/, (p) => p.schoolType === '大学院（博士）'],
  // 修士課程の人だけ
  [/(修士(課程)?|博士前期(課程)?)(に)?(在籍|在学)?(している|中)?の?(方|者|生)?(のみ|だけ|に限り)(?![・、]?博士)/, (p) => p.schoolType === '大学院（修士）'],
  // 大学院生だけ。「院生の方のみこちらを」「大学院（修士・博士）の方のみ」「大学院に在籍している方は記入」「『最終学歴』で「大学院（修士）」を選択された方は」
  [
    /(大学院|院生).{0,12}(の方|方|者|生)(のみ|だけ|に限り)|修士.{0,4}博士.{0,4}(の方|方|者|生)?(のみ|だけ|に限り)|院生.{0,3}のみ|大学院に(所属|在籍|在学)|(大学院生|院生)の方は.{0,2}(ご)?(記入|入力|回答)|大学院.{0,24}(選択さ?れ?た|選ばれた)方/,
    isGrad,
  ],
  // 学部生だけ
  [/学部生(の方|方|者)?(のみ|だけ|に限り)|学部(に)?(在籍|在学)(している|中)?の?(方|者)?(のみ|だけ)/, (p) => p.schoolType === '大学'],
  [/(既卒|社会人|卒業された|卒業済).{0,8}(の方|方|者)のみ/, (p) => p.graduationStatus === 'graduated'],
  // 「その他学校情報」「ダブルスクール」は、プロフィールにない別の学校
  [/その他.{0,2}学校情報|ダブルスクール/, () => false],
  // 「文理区分で理系を選択された方は、下記A〜Eまでの設問にお答えください」（区切りの見出し）
  [/理系.{0,4}選(択さ?れ?た|んだ|ばれた)(方|場合)|理系の(方|者)のみ/, (p) => p.bunri === '理系'],
  [/文系.{0,4}選(択さ?れ?た|んだ|ばれた)(方|場合)|文系の(方|者)のみ/, (p) => p.bunri === '文系'],
  // 編入した学校はプロフィールにないので、「大学編入歴のある方のみ」の欄には入れない
  [/編入.{0,12}(の方|方|者)のみ|編入(歴|経験)のある/, () => false],
  // 進学予定の大学院はプロフィールにない（「大学院進学予定［あり／なし］」「進学予定の大学院名」）
  [/進学(予定|先|希望)/, () => false],
  [/留学.{0,12}(の方|方|者)のみ/, (p) => !!p.studyAbroad && !SAYS_NONE.test(p.studyAbroad.normalize('NFKC'))],
];

/**
 * 大学院生の「学部のときの学校」の欄。プロフィールには今の学校しかないので入れない。
 * 「出身大学」はふつう今の大学のことだが、大学院生の人や、大学院の話が出てくる区切り（「院生の方のみ」「修士課程の方は『学部』時の情報を」）の中では学部の大学
 */
const PREVIOUS_SCHOOL = /出身大学(?!院)|出身学部|学部.{0,2}(時|時代|在籍時|卒業時)|学士課程|学部の(情報|学校)/;
const MENTIONS_GRAD = /院生|大学院|修士|博士/;
const EDUCATION_KEY = /^(school|faculty|department|fieldCategory|degree|admission|graduation|lab|advisor|researchTheme|bunri)/;
/** 欄の見出しが「大学院の〜」「大学院名」（大学院生だけの欄）。「大学・大学院名」「大学（院）」は含めない */
const GRAD_LABEL = /^[◆■●▲※*＊\s]*大学院(?!生)(の|名|での|研究科|専攻|[／/])/;
/** 行見出しが「大学」「学部」で列見出しもある表の行（「大学 学校名」）。大学院生にとっては学部のときの学校 */
const UNDERGRAD_ROW = /^[◆■●▲※*＊\s]*(大学|学部|学士)[／/]/;

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
    // 条件の注意書きは、欄と同じセルの中（欄の上の説明文）にあることも多い
    const cell = f.elements[0]!.closest('td, dd')?.textContent?.slice(0, 200) ?? '';
    const text = norm(`${d.label} ${d.prefix} ${d.context} ${d.section} ${d.sectionNote ?? ''} ${cell}`);
    const own = norm(`${d.label} ${d.prefix} ${d.context} ${cell}`);
    const scope = norm(`${d.section} ${d.sectionNote ?? ''}`);
    const previousSchool =
      EDUCATION_KEY.test(c.key) &&
      ((PREVIOUS_SCHOOL.test(`${own} ${scope}`) && (isGrad(profile) || MENTIONS_GRAD.test(`${own} ${scope}`))) ||
        (UNDERGRAD_ROW.test(norm(d.context)) && isGrad(profile)));
    const gradLabel = GRAD_LABEL.test(norm(d.context)) || GRAD_LABEL.test(norm(d.label));
    if (previousSchool || (gradLabel && !isGrad(profile)) || CONDITIONS.some(([re, ok]) => re.test(text) && !ok(profile))) {
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
  /** 独自プルダウンは開いて選ぶのに時間がかかるので、ほかの欄を入れたあとで順に入れる */
  private comboQueue: Result[] = [];
  /** 独自プルダウンの、入力前に表示されていた値（元に戻す用） */
  private comboBefore = new Map<ScannedField, string>();
  /** 元に戻している途中の独自プルダウン */
  private restoring: Promise<void> = Promise.resolve();
  private overlay: Overlay;

  constructor(private doc: Document) {
    this.overlay = new Overlay(doc, {
      onUndo: () => this.undo(),
      onClose: () => this.overlay.clear(),
    });
  }

  /** 応募先の企業（Sophon とつながっているとき）。フローティングバーに出す */
  setLink(link: BarLink | null) {
    this.overlay.setLink(link);
  }

  /** 入力前のプレビュー。ルールで判定できる欄の数だけ返す */
  preview(): FrameStatus {
    if (this.results.length) return this.status();
    const detected = scanFields(this.doc).filter((f) => classify(f.desc).key).length;
    return { detected, filled: 0, warn: 0, reviews: [] };
  }

  async fill(profile: Profile, settings: Settings, classifyRemote?: ClassifyRemote): Promise<FrameStatus> {
    // 前回の入力は、いま画面に見えている欄だけ戻して入れ直す。
    // 手順型のフォームで隠れた前のページの欄まで戻すと、入力済みの値が消えてしまう
    this.undo(true);
    await this.restoring;
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
    await this.fillCombos(settings.threshold);

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
    if (field.combo) {
      this.comboBefore.set(field, comboText(field.elements[0]!));
      result.status = 'empty';
      this.comboQueue.push(result);
      return result;
    }
    this.snapshots.set(field, takeSnapshot(field));
    this.apply(result, settings.threshold);
    return result;
  }

  /** 待っている独自プルダウンを、ページの上から順に1つずつ開いて選ぶ（年→月→日の連動にも対応できる） */
  private async fillCombos(threshold: number) {
    while (this.comboQueue.length) {
      const r = this.comboQueue.shift()!;
      const el = r.field.elements[0]!;
      // 自由入力の欄（入力候補つきの学校名など）は、候補になくても文字のまま入れてよい
      const freeText = el instanceof HTMLInputElement && !el.readOnly;
      let applied: string | null = null;
      try {
        applied = await applyCombo(el, r.variants, freeText);
      } catch {
        applied = null;
      }
      if (applied == null) continue;
      r.value = applied;
      r.status = r.confidence >= threshold ? 'ok' : 'warn';
    }
  }

  /**
   * 郵便番号を入れると住所を自動で埋めるサイト（ajaxzip3 など）は、少し遅れて住所の欄を書き換える。
   * そのせいで入れた番地が消えることがあるので、書き換わった文字の欄を入れ直す。
   */
  private async reapplyOverwritten(threshold: number) {
    await new Promise((resolve) => setTimeout(resolve, OVERWRITE_CHECK_DELAY));
    for (const r of this.results) {
      if ((r.status !== 'ok' && r.status !== 'warn') || r.field.combo) continue;
      const el = r.field.elements[0];
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
      if (el.type === 'radio' || el.type === 'checkbox' || el.type === 'file') continue;
      if (!sameText(el.value, r.value)) this.apply(r, threshold);
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
      await this.fillCombos(settings.threshold);
    }
  }

  private apply(result: Result, threshold: number): boolean {
    const applied = applyValue(result.field, result.variants);
    if (applied == null) {
      result.status = 'empty';
      return false;
    }
    // サイト側が書式を整えた（ハイフンを消したなど）ときは、整えたあとの値を覚えておく。
    // そうしないと「ユーザーが書き直した」と誤って判断し、元に戻せなくなる
    const el = result.field.elements[0];
    const typed = (el instanceof HTMLInputElement && !/^(radio|checkbox|file)$/.test(el.type)) || el instanceof HTMLTextAreaElement;
    result.value = typed && el.value ? el.value : applied;
    result.status = result.confidence >= threshold ? 'ok' : 'warn';
    return true;
  }

  /**
   * 年を選ぶと月の選択肢が、月を選ぶと日の選択肢が作られるフォームがある。
   * 選択肢が見つからなかったプルダウンは、少し待ってから入れ直す。
   */
  private async retryDependentSelects(threshold: number) {
    const selects = this.results.filter((r) => r.field.desc.kind === 'select' && !r.field.combo && r.variants.length && !r.noData);
    if (!selects.length) return;
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
      // 選択肢が後から作られたもの、作り直されて選択が消えたものを入れ直す
      // 作り直しが遅れて来ることもあるので、待ちきるまで見続ける
      const pending = selects.filter((r) => r.status === 'empty' || !stillSelected(r));
      for (const r of pending) this.apply(r, threshold);
    }
    for (const delay of SLOW_RETRY_DELAYS) {
      const pending = selects.filter((r) => r.status === 'empty');
      if (!pending.length) return;
      await new Promise((resolve) => setTimeout(resolve, delay));
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
    // 「090」「1234」「5678」のように分かれた欄の何番目かは、並びから決めたもので確か。
    // AI に聞くと「電話番号（まとめて）」と答えることがあり、3 つ目にだけ全部が入ってしまう（Speee）ので聞かない
    const splitPart = (i: number) => fields[i]!.desc.groupSize > 1 && /\d$/.test(classes[i]!.key ?? '');
    const targets = fields
      .map((f, i) => ({ f, i }))
      .filter(({ i }) => (!classes[i]!.key || classes[i]!.confidence < threshold) && !splitPart(i))
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
  async resolve(id: string, value: string): Promise<FrameStatus> {
    const r = this.results.find((r) => r.field.desc.id === id);
    if (r) {
      const el = r.field.elements[0]!;
      const applied = r.field.combo ? await applyCombo(el, [value], el instanceof HTMLInputElement) : applyValue(r.field, [value]);
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

  undo(onScreenOnly = false): FrameStatus {
    const byField = new Map(this.results.map((r) => [r.field, r]));
    for (const [field, snap] of this.snapshots) {
      // 入力のあとにユーザーが書き直した欄は、その内容を消さない
      const r = byField.get(field);
      if (r && !keptAsFilled(r)) continue;
      if (onScreenOnly && !onScreen(field)) continue;
      restoreSnapshot(field, snap);
    }
    // 独自プルダウンは開いて選び直すので時間がかかる。次の入力はこれが終わるのを待つ
    const combos = this.results.filter((r) => r.field.combo && keptAsFilled(r) && (!onScreenOnly || onScreen(r.field)));
    const before = new Map(this.comboBefore);
    this.restoring = this.restoring.then(async () => {
      for (const r of combos) await restoreCombo(r.field.elements[0]!, before.get(r.field) ?? '').catch(() => {});
    });
    this.comboBefore.clear();
    this.comboQueue = [];
    this.snapshots.clear();
    this.results = [];
    this.overlay.clear();
    return this.status();
  }

  /** 独自プルダウンを元に戻し終わるまで待つ */
  whenRestored(): Promise<void> {
    return this.restoring;
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
