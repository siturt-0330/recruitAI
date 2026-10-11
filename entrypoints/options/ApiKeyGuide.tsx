import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, KeyRound, Lock, MousePointerClick, Plus } from 'lucide-react';
import './guide.css';

/**
 * OpenAI の API キーを取得する手順を、図（イメージ）付きで説明するガイド。
 * OpenAI の画面は変わることがあるので、実際の画面ではなく要点だけを描いた模式図にしている。
 */

const API_KEYS_URL = 'https://platform.openai.com/api-keys';
const BILLING_URL = 'https://platform.openai.com/settings/organization/billing/overview';
const LIMITS_URL = 'https://platform.openai.com/settings/organization/limits';

interface Step {
  title: string;
  body: ReactNode;
  figure: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'API キーのページを開く',
    body: (
      <>
        <p>
          OpenAI のサイトにログインして、<strong>API keys</strong> のページを開きます。ChatGPT のアカウントでログインできます。
        </p>
        <a className="guide-link" href={API_KEYS_URL} target="_blank" rel="noreferrer">
          API keys のページを開く
          <ExternalLink size={13} />
        </a>
      </>
    ),
    figure: (
      <Browser url="platform.openai.com/api-keys">
        <div className="mock-app">
          <div className="mock-side">
            <div className="mock-side-item" />
            <div className="mock-side-item" />
            <div className="mock-side-item on">
              <KeyRound size={11} />
              API keys
            </div>
            <div className="mock-side-item" />
          </div>
          <div className="mock-main">
            <div className="mock-row-between">
              <span className="mock-h">API keys</span>
              <span className="mock-btn primary target">
                <Plus size={11} />
                Create new secret key
                <Pointer />
              </span>
            </div>
            <div className="mock-table">
              <div className="mock-line" />
              <div className="mock-line short" />
            </div>
          </div>
        </div>
      </Browser>
    ),
  },
  {
    title: '「Create new secret key」を押す',
    body: (
      <p>
        画面右上の <strong>Create new secret key</strong> ボタンを押します。キーを作る画面（ダイアログ）が開きます。
      </p>
    ),
    figure: (
      <Browser url="platform.openai.com/api-keys">
        <div className="mock-app dim">
          <div className="mock-side">
            <div className="mock-side-item" />
            <div className="mock-side-item on">API keys</div>
          </div>
          <div className="mock-main">
            <div className="mock-row-between">
              <span className="mock-h">API keys</span>
              <span className="mock-btn primary">
                <Plus size={11} />
                Create new secret key
              </span>
            </div>
          </div>
        </div>
        <div className="mock-dialog small">
          <div className="mock-h">Create new secret key</div>
          <div className="mock-line" />
          <div className="mock-line short" />
        </div>
      </Browser>
    ),
  },
  {
    title: 'キーの設定をする',
    body: (
      <ul className="guide-list">
        <li>
          <strong>Name</strong>：<code>RecruitAI</code> など、あとで分かる名前
        </li>
        <li>
          <strong>有効期限</strong>：90日くらいがおすすめ（漏れても自動で使えなくなる）
        </li>
        <li>
          <strong>Permissions</strong>：迷ったら <strong>All</strong> で OK
        </li>
        <li>
          最後に <strong>Create secret key</strong> を押します
        </li>
      </ul>
    ),
    figure: (
      <Browser url="platform.openai.com/api-keys">
        <div className="mock-dialog">
          <div className="mock-h">Create new secret key</div>
          <MockLabel>Owned by</MockLabel>
          <div className="mock-seg">
            <span className="on">You</span>
            <span>Service account</span>
          </div>
          <MockLabel>Name</MockLabel>
          <div className="mock-input filled target-soft">RecruitAI</div>
          <MockLabel>Project</MockLabel>
          <div className="mock-input">Default project</div>
          <MockLabel>有効期限</MockLabel>
          <div className="mock-input filled target-soft">90日</div>
          <MockLabel>Permissions</MockLabel>
          <div className="mock-seg">
            <span className="on">All</span>
            <span>Restricted</span>
            <span>Read only</span>
          </div>
          <div className="mock-actions">
            <span className="mock-btn">Cancel</span>
            <span className="mock-btn primary target">
              Create secret key
              <Pointer />
            </span>
          </div>
        </div>
      </Browser>
    ),
  },
  {
    title: '表示されたキーをコピーする',
    body: (
      <>
        <p>
          <code>sk-</code> で始まるキーが表示されるので、<strong>Copy</strong> を押してコピーします。
        </p>
        <p className="guide-warn">
          <Lock size={13} />
          <span>
            キーはこの画面で<strong>一度しか表示されません</strong>。人に見せたり、チャットに貼ったりしないでください。
          </span>
        </p>
      </>
    ),
    figure: (
      <Browser url="platform.openai.com/api-keys">
        <div className="mock-dialog">
          <div className="mock-h">Save your key</div>
          <div className="mock-note">Please save your secret key in a safe place…</div>
          <div className="mock-key-row">
            <div className="mock-input mono">sk-proj-••••••••••••••••</div>
            <span className="mock-btn primary target">
              <Copy size={11} />
              Copy
              <Pointer />
            </span>
          </div>
          <div className="mock-actions">
            <span className="mock-btn">Done</span>
          </div>
        </div>
      </Browser>
    ),
  },
  {
    title: 'RecruitAI に貼り付ける',
    body: (
      <p>
        このページの下にある <strong>API キー</strong> 欄に貼り付けて <strong>保存</strong> を押し、判定エンジンを{' '}
        <strong>ルール + OpenAI</strong> に切り替えれば完了です。
      </p>
    ),
    figure: (
      <div className="mock-ext">
        <div className="mock-ext-title">
          <KeyRound size={12} />
          AI 設定
        </div>
        <MockLabel>API キー</MockLabel>
        <div className="mock-key-row">
          <div className="mock-input mono filled">••••••••••••••••••••</div>
          <span className="mock-btn accent target">
            保存
            <Pointer />
          </span>
        </div>
        <MockLabel>判定エンジン</MockLabel>
        <div className="mock-seg">
          <span>ルールのみ</span>
          <span className="on target-soft">ルール + OpenAI</span>
        </div>
      </div>
    ),
  },
];

export default function ApiKeyGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [i, setI] = useState(0);
  const step = STEPS[i]!;

  if (!open) {
    return (
      <button className="guide-toggle" onClick={() => setOpen(true)}>
        API キーの取り方を見る
      </button>
    );
  }

  return (
    <section className="guide">
      <div className="guide-head">
        <div>
          <h2>API キーの取り方</h2>
          <p>5ステップ・約3分。図は実際の画面を簡略化したイメージです。</p>
        </div>
        <button className="mini" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </div>

      <ol className="guide-steps">
        {STEPS.map((s, j) => (
          <li key={s.title}>
            <button className={j === i ? 'on' : j < i ? 'done' : ''} onClick={() => setI(j)} aria-current={j === i}>
              <span className="num">{j < i ? <Check size={12} /> : j + 1}</span>
              <span className="label">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="guide-body" key={i}>
        <div className="guide-figure">{step.figure}</div>
        <div className="guide-text">
          <div className="guide-step-no">STEP {i + 1}</div>
          <h3>{step.title}</h3>
          {step.body}
          <div className="guide-nav">
            <button className="btn" onClick={() => setI(i - 1)} disabled={i === 0}>
              <ArrowLeft size={14} />
              前へ
            </button>
            {i < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setI(i + 1)}>
                次へ
                <ArrowRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setOpen(false)}>
                <Check size={14} />
                わかった
              </button>
            )}
          </div>
        </div>
      </div>

      <details className="guide-extra">
        <summary>うまくいかないとき・安心して使うために（任意）</summary>
        <ul className="guide-list">
          <li>
            <strong>クレジットの追加</strong>：残高がないと使えません。
            <a href={BILLING_URL} target="_blank" rel="noreferrer">
              Billing
            </a>{' '}
            から5ドル程度入れておけば、この拡張機能の使い方なら長く持ちます。
          </li>
          <li>
            <strong>月の上限</strong>：
            <a href={LIMITS_URL} target="_blank" rel="noreferrer">
              Limits
            </a>{' '}
            で月の上限を数ドルにしておくと、万一キーが漏れても安心です。
          </li>
          <li>
            <strong>Chrome の権限</strong>：<code>chrome://extensions</code> の RecruitAI の詳細で、
            <code>https://api.openai.com/*</code> へのアクセスをオンにしてください。
          </li>
        </ul>
      </details>
    </section>
  );
}

function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="mock-browser" aria-hidden="true">
      <div className="mock-bar">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="mock-url">
          <Lock size={9} />
          {url}
        </span>
      </div>
      <div className="mock-page">{children}</div>
    </div>
  );
}

function MockLabel({ children }: { children: ReactNode }) {
  return <div className="mock-label">{children}</div>;
}

function Pointer() {
  return (
    <span className="mock-pointer">
      <MousePointerClick size={16} />
    </span>
  );
}
