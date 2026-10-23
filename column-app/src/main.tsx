// コラムの書く画面。/column/write は書きはじめる画面、/column/write/<id> はエディタ
import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Me } from './api';
import { Editor } from './Editor';
import { NewArticle } from './NewArticle';
import './write.css';

function App({ me }: { me: Me }) {
  const [message, setMessage] = useState('');
  const toast = useCallback((text: string) => setMessage(text), []);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(''), 2800);
    return () => window.clearTimeout(t);
  }, [message]);

  const id = location.pathname.match(/^\/column\/write\/([A-Za-z0-9_-]+)$/)?.[1];
  return (
    <>
      {id ? <Editor id={id} me={me} toast={toast} /> : <NewArticle toast={toast} />}
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
createRoot(root).render(<App me={me} />);
