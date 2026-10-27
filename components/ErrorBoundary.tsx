import { Component, type ReactNode } from 'react';

/**
 * 画面の組み立て中にエラーが起きても、真っ白にしないための囲い。
 * エラーの内容と「開き直す」ボタンを出す（ストアの審査は英語で読むので、英語も添える）
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('[らくらくエントリー] 画面を表示できませんでした', error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, maxWidth: 560 }}>
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>画面を表示できませんでした / Something went wrong</h1>
        <p style={{ margin: '0 0 12px', fontSize: 14 }}>
          開き直すと直ることがあります。直らないときは contact@rakuraku-entry.com までお知らせください。
          <br />
          Please reload this page. If it keeps happening, contact contact@rakuraku-entry.com.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.7, margin: '0 0 12px' }}>{String(this.state.error.message || this.state.error)}</pre>
        <button type="button" onClick={() => location.reload()} style={{ padding: '8px 16px', fontSize: 14 }}>
          開き直す / Reload
        </button>
      </div>
    );
  }
}
