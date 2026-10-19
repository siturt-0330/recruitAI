/*
 * 使い方の動画（ブラウザ上で動くアニメーション）。
 * 画面はすべて時刻 t（秒）から決まるので、再生・シーク・1コマずつの書き出しができる。
 * <div data-howto></div> に自動で組み込まれる。書き出し用に window.__howtoRender(t) も用意する。
 */
(function () {
  'use strict';

  var W = 960;
  var H = 540;
  var DURATION = 28;

  /** ステップ（ホームページの「3ステップ」と同じ区切り） */
  var STEPS = [
    { from: 0, to: 10, title: 'Chrome に追加', subs: [[0, '「Chrome に追加」→「拡張機能を追加」'], [5.5, 'パズルのアイコンから、ピンを押してツールバーに固定']] },
    { from: 10, to: 17, title: 'プロフィールを登録', subs: [[10, 'アイコンを押して「プロフィールを作成」'], [12.8, 'まずは氏名と連絡先だけで OK。自動で保存されます']] },
    { from: 17, to: DURATION, title: '応募フォームでクリック', subs: [[17, 'アイコンを押して「このページに入力」（Alt+Shift+F でも OK）'], [23.4, '「確認」の欄だけ見直して、送信はご自身で']] },
  ];

  var ICON = '<svg viewBox="0 0 128 128" aria-hidden="true"><rect x="4" y="4" width="120" height="120" rx="28" fill="#0F1419"/><rect x="22" y="28" width="84" height="16" rx="8" fill="#2EE6C5"/><rect x="22" y="54" width="84" height="16" rx="8" fill="#2EE6C5"/><rect x="22" y="80" width="46" height="16" rx="8" fill="#2EE6C5" fill-opacity=".35"/><path transform="translate(74 70)" d="M0 0 v34 l8.5 -8 l6.5 14 l6.5 -3 l-6.5 -13.5 h12 z" fill="#fff" stroke="#0F1419" stroke-width="4" stroke-linejoin="round"/></svg>';
  var PUZZLE = '<svg viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5a2 2 0 0 1 4 0V5h4a1 1 0 0 1 1 1v4h-1.5a2 2 0 0 0 0 4H19v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 0 0-4 0V19H6a1 1 0 0 1-1-1v-4h1.5a2 2 0 0 0 0-4H5V6a1 1 0 0 1 1-1h4z"/></svg>';
  var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/></svg>';
  var CURSOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.5 21 L11 14.2 L18 14.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  var CSS = [
    // 埋め込み先のページの行間などに左右されないよう、動画の中の基本の文字設定を決めておく
    '.ht{position:relative;width:100%;font-family:inherit;color:#14161a;line-height:1.5}',
    '.ht-viewport{position:relative;width:100%;overflow:hidden;border-radius:22px;background:#f6f4fb}',
    '.ht-stage{position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;transform-origin:0 0;overflow:hidden;background:linear-gradient(135deg,#efeaff 0%,#fff4ec 55%,#e6f7ef 100%)}',
    '.ht-stage *{box-sizing:border-box}',
    '.ht-abs{position:absolute}',
    '.ht-browser{left:40px;top:22px;width:880px;height:448px;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(60,50,140,.16),0 2px 8px rgba(20,22,26,.06);overflow:hidden}',
    '.ht-top{left:0;top:0;width:880px;height:46px;background:#f1f3f4;border-bottom:1px solid #e3e5e8}',
    '.ht-dot{width:11px;height:11px;border-radius:50%;top:17px}',
    '.ht-addr{left:84px;top:9px;width:640px;height:28px;border-radius:14px;background:#fff;font-size:13px;color:#5f6368;line-height:28px;padding:0 16px;white-space:nowrap;overflow:hidden}',
    '.ht-tbicon{width:30px;height:30px;top:8px;border-radius:50%;display:flex;align-items:center;justify-content:center}',
    '.ht-tbicon svg{width:20px;height:20px}',
    '.ht-avatar{background:#c7b8ff;color:#3b2a8a;font-size:13px;font-weight:700}',
    '.ht-content{left:0;top:46px;width:880px;height:402px}',
    '.ht-page{left:0;top:0;width:880px;height:402px}',
    '.ht-btn{display:flex;align-items:center;justify-content:center;border-radius:999px;font-size:14px;font-weight:700;white-space:nowrap}',
    '.ht-blue{background:#1a73e8;color:#fff}',
    '.ht-dark{background:#14161a;color:#fff}',
    '.ht-line{border-radius:6px;background:#eceef1}',
    '.ht-card{background:#fff;border-radius:14px;box-shadow:0 12px 32px rgba(20,22,26,.18),0 0 0 1px rgba(20,22,26,.06)}',
    '.ht-field{border:1px solid #d5d9de;border-radius:8px;background:#fff;font-size:14px;padding:0 10px;display:flex;align-items:center;white-space:nowrap;overflow:hidden}',
    '.ht-fl{border:1px solid #cfd9de;border-radius:10px;background:#fff;padding:6px 12px;display:flex;flex-direction:column;justify-content:center}',
    '.ht-fl small{display:block;font-size:11px;line-height:15px;color:#536471}',
    '.ht-fl b{display:block;font-size:15px;line-height:22px;font-weight:500;min-height:22px}',
    '.ht-stamp{width:22px;height:22px;border-radius:50%;border:1.5px solid #e0563f;color:#e0563f;background:#fffaf4;font:700 11px/1 "Yu Mincho","Hiragino Mincho ProN",serif;display:flex;align-items:center;justify-content:center}',
    '.ht-stamp.warn{width:auto;border-radius:4px;padding:0 4px;border-color:#e3a008;color:#9a6c17;font-size:10px}',
    '.ht-cursor{width:26px;height:26px;left:0;top:0;z-index:20;pointer-events:none}',
    '.ht-ripple{width:40px;height:40px;border-radius:50%;border:3px solid rgba(91,76,240,.55);z-index:19;pointer-events:none}',
    '.ht-cap{left:40px;top:482px;width:880px;height:44px;display:flex;align-items:center;gap:14px}',
    '.ht-badge{flex-shrink:0;background:#14161a;color:#fff;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:800;letter-spacing:.04em}',
    '.ht-title{font-size:19px;font-weight:900;white-space:nowrap}',
    '.ht-sub{font-size:14px;color:#57606a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ht-end{left:0;top:0;width:' + W + 'px;height:' + H + 'px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(255,255,255,.96);z-index:30}',
    '.ht-end svg{width:84px;height:84px}',
    '.ht-end h3{margin:0;font-size:34px;font-weight:900}',
    '.ht-end p{margin:0;font-size:17px;color:#57606a}',
    '.ht-controls{display:flex;align-items:center;gap:12px;margin-top:14px}',
    '.ht-play{flex-shrink:0;width:40px;height:40px;border-radius:50%;border:1px solid #ece9f2;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}',
    '.ht-play svg{width:16px;height:16px}',
    // min-width:0 がないと、手順名の長さより縮まず、スマホでページが横にはみ出す
    '.ht-segs{flex:1;min-width:0;display:flex;gap:8px}',
    '.ht-seg{position:relative;min-width:0;border:0;padding:0;background:none;cursor:pointer;text-align:left;font:inherit;color:#57606a}',
    '.ht-seg i{display:block;height:5px;border-radius:999px;background:#ece9f2;overflow:hidden}',
    '.ht-seg i span{display:block;height:100%;width:0;background:linear-gradient(90deg,#5b4cf0,#ff7a59)}',
    '.ht-seg em{display:block;font-style:normal;font-size:12px;font-weight:700;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ht-seg.on em{color:#14161a}',
    '.ht-seg em b{font-weight:inherit}',
    // スマホでは手順名が入りきらないので「STEP 1」だけにする
    '@media (max-width:600px){.ht-seg em b{display:none}}',
  ].join('\n');

  function clamp(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }
  function ease(x) {
    x = clamp(x);
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
  /** a〜b 秒の間の進み具合（0〜1） */
  function prog(t, a, b) {
    return clamp((t - a) / (b - a));
  }
  /** a 秒から d 秒かけて現れ、b 秒から d 秒かけて消える */
  function vis(t, a, b, d) {
    d = d || 0.25;
    return Math.min(prog(t, a, a + d), 1 - prog(t, b, b + d));
  }
  function typed(text, t, a, b) {
    var chars = Array.from(text);
    return chars.slice(0, Math.round(chars.length * prog(t, a, b))).join('');
  }

  // カーソルの通り道（時刻, x, y）。座標はステージ（960×540）基準
  var PATH = [
    [0, 690, 420], [0.5, 690, 420], [1.6, 775, 158],
    [2.6, 775, 158], [3.4, 625, 226],
    [5.7, 625, 226], [6.8, 840, 45],
    [7.4, 840, 45], [8.3, 878, 140],
    [9.0, 878, 140], [9.8, 700, 300],
    [10.2, 700, 300], [11.0, 808, 45],
    [11.6, 808, 45], [12.5, 730, 258],
    [13.0, 730, 258], [13.8, 900, 440],
    [17.0, 900, 440], [18.0, 808, 45],
    [18.6, 808, 45], [19.4, 730, 240],
    [19.8, 730, 240], [20.6, 905, 430],
    [23.6, 905, 430], [24.6, 345, 404],
    [25.4, 345, 404], [26.4, 305, 447],
    [28, 305, 447],
  ];
  var CLICKS = [1.8, 3.6, 7.0, 8.5, 11.2, 12.7, 18.2, 19.6, 26.6];

  function cursorAt(t) {
    for (var i = 0; i < PATH.length - 1; i++) {
      var a = PATH[i];
      var b = PATH[i + 1];
      if (t >= a[0] && t <= b[0]) {
        var p = ease(prog(t, a[0], b[0]));
        return [a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];
      }
    }
    var last = PATH[PATH.length - 1];
    return [last[1], last[2]];
  }

  // 応募フォームの欄（ラベル, [値, x, 幅]…）。最後の行は「確認」になる
  var FORM = [
    ['氏名', [['山田', 200, 170], ['花子', 380, 170]]],
    ['フリガナ', [['ヤマダ', 200, 170], ['ハナコ', 380, 170]]],
    ['生年月日', [['2004', 200, 90], ['5', 300, 60], ['12', 370, 60]]],
    ['郵便番号', [['1500041', 200, 130]]],
    ['住所', [['東京都渋谷区神南1-2-3', 200, 350]]],
    ['携帯電話', [['090-1234-5678', 200, 200]]],
    ['メールアドレス', [['hanako@example.com', 200, 350]]],
    ['保護者連絡先', [['090-0000-0000', 200, 200]]],
  ];
  // 設定画面で入力するプロフィール（ラベル, 値, x, y）
  var PROFILE = [
    ['姓', '山田', 200, 70], ['名', '花子', 540, 70],
    ['セイ', 'ヤマダ', 200, 128], ['メイ', 'ハナコ', 540, 128],
    ['生年月日', '2004/05/12', 200, 186], ['性別', '女性', 540, 186],
    ['携帯電話', '090-1234-5678', 200, 244], ['メールアドレス', 'hanako@example.com', 540, 244],
  ];

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function place(e, x, y, w, hh) {
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    if (w != null) e.style.width = w + 'px';
    if (hh != null) e.style.height = hh + 'px';
    return e;
  }

  function build(root, options) {
    if (!document.getElementById('ht-style')) {
      var st = h('style');
      st.id = 'ht-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    root.classList.add('ht');
    var viewport = h('div', 'ht-viewport');
    var stage = h('div', 'ht-stage');
    viewport.appendChild(stage);
    root.appendChild(viewport);
    viewport.setAttribute('role', 'img');
    viewport.setAttribute('aria-label', 'らくらくエントリーを Chrome に追加し、プロフィールを登録して、応募フォームに入力するまでの操作の動画');

    var el = {};
    var browser = stage.appendChild(h('div', 'ht-abs ht-browser'));
    var top = browser.appendChild(h('div', 'ht-abs ht-top'));
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (c, i) {
      var d = top.appendChild(h('div', 'ht-abs ht-dot'));
      d.style.background = c;
      d.style.left = 18 + i * 18 + 'px';
    });
    el.addr = top.appendChild(h('div', 'ht-abs ht-addr'));
    el.pinned = place(top.appendChild(h('div', 'ht-abs ht-tbicon', ICON)), 753, 8);
    place(top.appendChild(h('div', 'ht-abs ht-tbicon', PUZZLE)), 785, 8);
    place(top.appendChild(h('div', 'ht-abs ht-tbicon ht-avatar', '山')), 821, 8);
    el.pinRing = place(top.appendChild(h('div', 'ht-abs')), 750, 5, 36, 36);
    el.pinRing.style.borderRadius = '50%';
    el.pinRing.style.boxShadow = '0 0 0 3px rgba(91,76,240,.6)';

    var content = browser.appendChild(h('div', 'ht-abs ht-content'));

    // ストアのページ
    var store = (el.store = content.appendChild(h('div', 'ht-abs ht-page')));
    place(store.appendChild(h('div', 'ht-abs', ICON)), 56, 40, 72, 72);
    var name = place(store.appendChild(h('div', 'ht-abs', 'らくらくエントリー｜就活エントリー自動入力')), 150, 46);
    name.style.cssText += 'font-size:21px;font-weight:900;white-space:nowrap';
    var meta = place(store.appendChild(h('div', 'ht-abs', 'rakuraku-entry.com ・ 仕事効率化')), 150, 80);
    meta.style.cssText += 'font-size:13px;color:#5f6368';
    el.addBtn = place(store.appendChild(h('div', 'ht-abs ht-btn ht-blue', 'Chrome に追加')), 650, 50, 170, 40);
    el.addedBtn = place(store.appendChild(h('div', 'ht-abs ht-btn', 'Chrome から削除')), 650, 50, 170, 40);
    el.addedBtn.style.cssText += 'border:1px solid #dadce0;color:#1a73e8;background:#fff';
    [56, 300, 544].forEach(function (x, i) {
      var shot = place(store.appendChild(h('div', 'ht-abs')), x, 150, 230, 200);
      shot.style.cssText += 'border-radius:12px;background:' + ['#f3f0ff', '#fff4ec', '#e8f7ef'][i];
      for (var k = 0; k < 4; k++) place(shot.appendChild(h('div', 'ht-abs ht-line')), 24, 34 + k * 36, k === 3 ? 100 : 180, 16);
    });

    // 追加の確認ダイアログ（Chrome が出すもの）
    var dlg = (el.dialog = place(content.appendChild(h('div', 'ht-abs ht-card')), 240, 8, 420, 190));
    dlg.innerHTML =
      '<div style="position:absolute;left:22px;top:18px;right:22px;font-size:15px;font-weight:700;line-height:1.5">「らくらくエントリー｜就活エントリー自動入力」を追加しますか？</div>' +
      '<div style="position:absolute;left:22px;top:74px;right:22px;font-size:12.5px;color:#5f6368;line-height:1.6">次の権限が必要です：<br>・api.rakuraku-entry.com 上にある自分のデータの読み取りと変更</div>';
    place(dlg.appendChild(h('div', 'ht-abs ht-btn', 'キャンセル')), 180, 140, 100, 34).style.cssText += 'border:1px solid #dadce0;color:#1a73e8';
    el.dlgAdd = place(dlg.appendChild(h('div', 'ht-abs ht-btn ht-blue', '拡張機能を追加')), 290, 140, 112, 34);

    // 追加できたお知らせ
    var toast = (el.toast = place(content.appendChild(h('div', 'ht-abs ht-card')), 520, 6, 340, 74));
    place(toast.appendChild(h('div', 'ht-abs', ICON)), 16, 16, 40, 40);
    var tt = place(toast.appendChild(h('div', 'ht-abs', '「らくらくエントリー」が追加されました<br><span style="font-weight:400;color:#5f6368;font-size:12px">パズルのアイコンから使えます</span>')), 68, 14);
    tt.style.cssText += 'font-size:13.5px;font-weight:700;line-height:1.6;white-space:nowrap';

    // パズルのアイコンのメニュー
    var menu = (el.menu = place(content.appendChild(h('div', 'ht-abs ht-card')), 556, 4, 310, 120));
    var mh = place(menu.appendChild(h('div', 'ht-abs', '拡張機能')), 18, 14);
    mh.style.cssText += 'font-size:14px;font-weight:700';
    place(menu.appendChild(h('div', 'ht-abs', ICON)), 18, 60, 28, 28);
    var mn = place(menu.appendChild(h('div', 'ht-abs', 'らくらくエントリー')), 56, 63);
    mn.style.cssText += 'font-size:14px;white-space:nowrap';
    el.pin = place(menu.appendChild(h('div', 'ht-abs', PIN)), 270, 62, 22, 22);

    // 設定画面（プロフィールの登録）
    var opt = (el.options = content.appendChild(h('div', 'ht-abs ht-page')));
    opt.style.background = '#fff';
    var nav = place(opt.appendChild(h('div', 'ht-abs')), 0, 0, 170, 402);
    nav.style.cssText += 'border-right:1px solid #eff3f4';
    ['基本情報', '連絡先・住所', '学歴', '資格・スキル'].forEach(function (n, i) {
      var it = place(nav.appendChild(h('div', 'ht-abs', n)), 14, 22 + i * 40, 142, 32);
      it.style.cssText += 'border-radius:999px;font-size:13.5px;line-height:32px;padding-left:14px;' + (i === 0 ? 'background:#f1f2fd;font-weight:700;color:#2f3380' : 'color:#536471');
    });
    var ot = place(opt.appendChild(h('div', 'ht-abs', '氏名・生年月日')), 200, 26);
    ot.style.cssText += 'font-size:17px;font-weight:900';
    el.saved = place(opt.appendChild(h('div', 'ht-abs', '')), 720, 28);
    el.saved.style.cssText += 'font-size:13px;font-weight:700;white-space:nowrap';
    el.pf = PROFILE.map(function (p) {
      var f = place(opt.appendChild(h('div', 'ht-abs ht-fl')), p[2], p[3], 320, 50);
      f.innerHTML = '<small>' + p[0] + '</small><b></b>';
      return f.querySelector('b');
    });
    var note = place(opt.appendChild(h('div', 'ht-abs', '細かい項目は、聞かれたときに足していけます')), 200, 320);
    note.style.cssText += 'font-size:13px;color:#8b98a5';

    // 応募フォーム
    var form = (el.form = content.appendChild(h('div', 'ht-abs ht-page')));
    form.style.background = '#fff';
    var fh = place(form.appendChild(h('div', 'ht-abs', 'エントリー')), 60, 16);
    fh.style.cssText += 'font-size:18px;font-weight:900';
    el.fields = [];
    FORM.forEach(function (row, i) {
      var y = 56 + i * 37;
      var lb = place(form.appendChild(h('div', 'ht-abs', row[0])), 60, y + 6);
      lb.style.cssText += 'font-size:13px;color:#536471;white-space:nowrap';
      row[1].forEach(function (f) {
        var box = place(form.appendChild(h('div', 'ht-abs ht-field')), f[1], y, f[2], 30);
        var stamp = place(form.appendChild(h('div', 'ht-abs ht-stamp' + (i === 7 ? ' warn' : ''), i === 7 ? '確認' : '済')), f[1] + f[2] - (i === 7 ? 22 : 12), y - 10);
        el.fields.push({ box: box, stamp: stamp, value: f[0], row: i });
      });
    });
    el.submit = place(form.appendChild(h('div', 'ht-abs ht-btn ht-blue', '送信する')), 200, 360, 130, 34);
    var fbar = (el.fbar = place(form.appendChild(h('div', 'ht-abs ht-btn ht-dark')), 590, 352, 270, 40));
    fbar.style.cssText += 'justify-content:flex-start;gap:10px;padding:0 6px 0 16px;font-size:13px';
    fbar.innerHTML = '<span>12 件入力 ・ <span style="color:#ffc53d">1 件要確認</span></span><span style="margin-left:auto;background:#fff;color:#14161a;border-radius:999px;padding:5px 12px;font-size:12px">元に戻す</span>';

    // 拡張機能のポップアップ（最初とプロフィール登録後の2種類）
    var pop1 = (el.pop1 = place(content.appendChild(h('div', 'ht-abs ht-card')), 540, 4, 300, 230));
    place(pop1.appendChild(h('div', 'ht-abs', '<div style="width:56px;height:56px;border-radius:50%;background:#eff3f4;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">?</div>')), 122, 20);
    var p1t = place(pop1.appendChild(h('div', 'ht-abs', 'プロフィールを作りましょう')), 0, 88, 300);
    p1t.style.cssText += 'text-align:center;font-size:15px;font-weight:700';
    var p1s = place(pop1.appendChild(h('div', 'ht-abs', '一度登録すると、応募フォームに<br>ワンクリックで入力できます')), 0, 116, 300);
    p1s.style.cssText += 'text-align:center;font-size:12px;color:#536471;line-height:1.6';
    el.createBtn = place(pop1.appendChild(h('div', 'ht-abs ht-btn ht-dark', 'プロフィールを作成')), 20, 166, 260, 40);

    var pop2 = (el.pop2 = place(content.appendChild(h('div', 'ht-abs ht-card')), 540, 4, 300, 212));
    pop2.innerHTML =
      '<div style="position:absolute;left:20px;top:18px;width:40px;height:40px;border-radius:50%;background:#eff3f4;display:flex;align-items:center;justify-content:center;font-weight:700">山</div>' +
      '<div style="position:absolute;left:72px;top:18px;font-size:15px;font-weight:700">山田 花子</div>' +
      '<div style="position:absolute;left:72px;top:40px;font-size:12px;color:#536471">@新卒用</div>' +
      '<div style="position:absolute;left:20px;top:78px;width:260px;display:flex;justify-content:space-around;text-align:center;font-size:11px;color:#536471">' +
      '<div><b style="display:block;font-size:17px;color:#14161a">12</b>検出</div><div><b style="display:block;font-size:17px;color:#14161a">0</b>入力済み</div><div><b style="display:block;font-size:17px;color:#14161a">0</b>要確認</div></div>';
    el.fillBtn = place(pop2.appendChild(h('div', 'ht-abs ht-btn ht-dark', 'このページに入力')), 20, 150, 260, 42);

    // 最後の画面
    var end = (el.end = stage.appendChild(h('div', 'ht-abs ht-end')));
    end.innerHTML = ICON + '<h3>準備完了！</h3><p>次のエントリーから、入力はワンクリック。</p>';

    // 説明（下の帯）
    var cap = stage.appendChild(h('div', 'ht-abs ht-cap'));
    el.badge = cap.appendChild(h('span', 'ht-badge'));
    el.title = cap.appendChild(h('span', 'ht-title'));
    el.sub = cap.appendChild(h('span', 'ht-sub'));

    el.ripple = stage.appendChild(h('div', 'ht-abs ht-ripple'));
    el.cursor = stage.appendChild(h('div', 'ht-abs ht-cursor', CURSOR));

    // 操作部分（再生・停止と、ステップごとのシーク）。書き出しでは出さない
    var controls = null;
    if (!options.capture) {
      controls = root.appendChild(h('div', 'ht-controls'));
      el.play = controls.appendChild(h('button', 'ht-play'));
      el.play.type = 'button';
      var segs = controls.appendChild(h('div', 'ht-segs'));
      el.segs = STEPS.map(function (s, i) {
        var b = segs.appendChild(h('button', 'ht-seg', '<i><span></span></i><em>STEP ' + (i + 1) + '<b>　' + s.title + '</b></em>'));
        b.type = 'button';
        b.style.flex = String(s.to - s.from);
        b.setAttribute('aria-label', 'STEP ' + (i + 1) + ' ' + s.title + ' から再生');
        return b;
      });
    }

    function render(t) {
      t = Math.max(0, Math.min(DURATION, t));
      var show = function (e, o) {
        e.style.opacity = String(o);
        e.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
      };

      // 画面（ページ）の切り替え
      var onStore = t < 12.9;
      var onOptions = t >= 12.9 && t < 16.9;
      show(store, onStore ? 1 : 0);
      show(opt, onOptions ? 1 : 0);
      show(form, t >= 16.9 ? 1 : 0);
      el.addr.textContent = onStore
        ? 'chromewebstore.google.com/detail/rakuraku-entry'
        : onOptions
          ? 'らくらくエントリー 設定'
          : 'recruit.example.co.jp/entry';

      // STEP 1：ストアで追加 → ツールバーに固定
      var installed = t >= 3.7;
      show(el.addBtn, installed ? 0 : 1);
      show(el.addedBtn, installed ? 1 : 0);
      el.addBtn.style.transform = t >= 1.8 && t < 2.0 ? 'scale(.95)' : 'none';
      show(dlg, vis(t, 2.0, 3.7, 0.2));
      el.dlgAdd.style.transform = t >= 3.6 && t < 3.75 ? 'scale(.95)' : 'none';
      show(toast, vis(t, 3.9, 5.6));
      show(menu, vis(t, 7.1, 9.0, 0.2));
      var pinned = t >= 8.55;
      el.pin.style.color = pinned ? '#1a73e8' : '#5f6368';
      show(el.pinned, pinned ? 1 : 0);
      show(el.pinRing, vis(t, 8.6, 10.2) * (0.5 + 0.5 * Math.sin(t * 6)));

      // STEP 2：プロフィールを登録
      show(pop1, vis(t, 11.3, 12.8, 0.2));
      el.createBtn.style.transform = t >= 12.7 && t < 12.85 ? 'scale(.96)' : 'none';
      PROFILE.forEach(function (p, i) {
        var a = 13.3 + i * 0.36;
        el.pf[i].textContent = typed(p[1], t, a, a + 0.3);
      });
      el.saved.innerHTML = t < 13.3 ? '' : t < 16.4 ? '<span style="color:#8b98a5">保存中…</span>' : '<span style="color:#00875a">✓ 保存済み</span>';

      // STEP 3：応募フォームで入力 → 確認して送信
      show(pop2, vis(t, 18.3, 19.7, 0.2));
      el.fillBtn.style.transform = t >= 19.6 && t < 19.75 ? 'scale(.96)' : 'none';
      el.fields.forEach(function (f, i) {
        var a = 19.85 + i * 0.16;
        var filled = t >= a;
        f.box.textContent = filled ? f.value : '';
        f.box.style.boxShadow = filled ? (f.row === 7 ? '0 0 0 2px rgba(227,160,8,.5)' : '0 0 0 2px rgba(224,86,63,.22)') : 'none';
        var s = prog(t, a + 0.05, a + 0.3);
        show(f.stamp, s);
        f.stamp.style.transform = 'rotate(-12deg) scale(' + (1.8 - 0.8 * ease(s)) + ')';
      });
      show(fbar, prog(t, 21.6, 21.9));
      el.fields.forEach(function (f) {
        if (f.row === 7) f.box.style.outline = t >= 24.4 && t < 25.6 ? '3px solid rgba(227,160,8,.35)' : 'none';
      });
      el.submit.style.transform = t >= 26.6 && t < 26.8 ? 'scale(.95)' : 'none';
      show(end, prog(t, 27.0, 27.4));

      // カーソルとクリックの波紋
      var c = cursorAt(t);
      var pressed = CLICKS.some(function (k) {
        return t >= k && t < k + 0.14;
      });
      el.cursor.style.transform = 'translate(' + (c[0] - 4) + 'px,' + (c[1] - 3) + 'px) scale(' + (pressed ? 0.85 : 1) + ')';
      show(el.cursor, t < 27.0 ? 1 : 0);
      var last = -1;
      CLICKS.forEach(function (k) {
        if (t >= k && t < k + 0.45) last = k;
      });
      if (last >= 0) {
        var r = prog(t, last, last + 0.45);
        show(el.ripple, 1 - r);
        el.ripple.style.transform = 'translate(' + (c[0] - 20) + 'px,' + (c[1] - 20) + 'px) scale(' + (0.4 + r) + ')';
      } else {
        show(el.ripple, 0);
      }

      // 説明
      var stepIndex = STEPS.findIndex(function (s) {
        return t < s.to;
      });
      if (stepIndex < 0) stepIndex = STEPS.length - 1;
      var step = STEPS[stepIndex];
      var sub = step.subs[0][1];
      step.subs.forEach(function (s) {
        if (t >= s[0]) sub = s[1];
      });
      el.badge.textContent = 'STEP ' + (stepIndex + 1);
      el.title.textContent = step.title;
      el.sub.textContent = sub;

      if (el.segs) {
        el.segs.forEach(function (b, i) {
          var s = STEPS[i];
          b.querySelector('span').style.width = prog(t, s.from, s.to) * 100 + '%';
          b.classList.toggle('on', i === stepIndex);
        });
      }
    }

    // 枠の幅に合わせてステージを縮小する
    function fit() {
      var scale = viewport.clientWidth / W;
      stage.style.transform = 'scale(' + scale + ')';
      viewport.style.height = H * scale + 'px';
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(viewport);

    var t = options.start || 0;
    render(t);
    if (options.capture) return render;

    // 再生
    var playing = false;
    var userPaused = false;
    var lastTs = 0;
    var ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z" fill="#14161a"/></svg>';
    var ICON_PAUSE = '<svg viewBox="0 0 16 16"><rect x="3" y="2.5" width="3.5" height="11" rx="1" fill="#14161a"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1" fill="#14161a"/></svg>';
    function setPlaying(p) {
      playing = p;
      el.play.innerHTML = p ? ICON_PAUSE : ICON_PLAY;
      el.play.setAttribute('aria-label', p ? '一時停止' : '再生');
      if (p) {
        lastTs = 0;
        requestAnimationFrame(tick);
      }
    }
    function tick(ts) {
      if (!playing) return;
      if (lastTs) {
        t += (ts - lastTs) / 1000;
        if (t >= DURATION + 1.5) t = 0;
        render(Math.min(t, DURATION));
      }
      lastTs = ts;
      requestAnimationFrame(tick);
    }
    el.play.addEventListener('click', function () {
      userPaused = playing;
      setPlaying(!playing);
    });
    el.segs.forEach(function (b, i) {
      b.addEventListener('click', function () {
        t = STEPS[i].from;
        render(t);
        userPaused = false;
        if (!playing) setPlaying(true);
      });
    });

    // 画面に入ったら自動で再生し、外れたら止める（動きを減らす設定のときは自動再生しない）
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlaying(false);
    if (reduce) {
      t = 21;
      render(t);
    } else if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        var on = entries[0].isIntersecting;
        if (on && !playing && !userPaused) setPlaying(true);
        if (!on && playing) setPlaying(false);
      }, { threshold: 0.35 }).observe(viewport);
    } else {
      setPlaying(true);
    }
    return render;
  }

  window.RakurakuHowto = { mount: build, duration: DURATION, width: W, height: H };
  function auto() {
    document.querySelectorAll('[data-howto]').forEach(function (n) {
      var capture = n.hasAttribute('data-capture');
      var render = build(n, { capture: capture });
      if (capture) window.__howtoRender = render;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})();
