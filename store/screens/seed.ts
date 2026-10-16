// スクリーンショット用：スタブのストレージにサンプルのプロフィールを入れてから iframe を開く
import { testProfile } from '../../test/fixtures/profile';

const p = testProfile({ id: 'shot', label: '新卒用', lastName: '山田', firstName: '花子', lastNameKana: 'ヤマダ', firstNameKana: 'ハナコ', birthDate: '2004-05-12', gender: 'female', school: 'サンプル大学' });
localStorage.setItem('stub:local:profiles', JSON.stringify([p]));
localStorage.setItem('stub:local:activeProfileId', JSON.stringify(p.id));
localStorage.setItem('stub:local:settings', JSON.stringify({ engine: 'openai', threshold: 0.9 }));
localStorage.setItem('stub:filled', '1');
localStorage.removeItem('stub:local:sophonData');
localStorage.removeItem('stub:tabUrl');
localStorage.setItem('stub:local:sponsorCache', JSON.stringify({ at: Date.now(), sponsor: null }));
const frame = document.querySelector<HTMLIFrameElement>('iframe[data-src]')!;
frame.src = frame.dataset.src!;
