// コラムの書く画面。/column/write は白紙のエディタ、/column/write/<id> は下書きのエディタ
import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Me } from './api';
import { Editor } from './Editor';
import './write.css';

function App({ me, id }: { me: Me; id?: string }) {
  const [message, setMessage] = useState('');
  const toast = useCallback((text: string) => setMessage(text), []);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(''), 2800);
    return () => window.clearTimeout(t);
  }, [message]);

  return (
    <>
      {id ? <Editor id={id} me={me} toast={toast} /> : <Editor me={me} toast={toast} />}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </>
  );
}

const root = document.getElementById('app')!;
const me = JSON.parse(root.dataset.me ?? '{}') as Me;
// id は開いたときの URL から一度だけ読む（白紙から書いて下書きができると URL がかわるが、読み直さない）
const id = location.pathname.match(/^\/column\/write\/([A-Za-z0-9_-]+)$/)?.[1];
createRoot(root).render(<App me={me} id={id} />);
