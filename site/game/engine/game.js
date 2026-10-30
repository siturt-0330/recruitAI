/*
 * 単語タイピングゲームの共通エンジン。カードがベルトコンベアで左から右へ流れてくるので、
 * 右端から落ちる前に「義憤を覚える」のような短い言い回しを打つ。下の枠には例文全体と言葉の意味を出す。
 * スマホでは意味を 4 択で選ぶ。4 択で間違えた言葉だけを「苦手」として記録する（タイピングの打ちそびれは記録しない）。
 *
 * ゲームごとの違い（題名・コース・カードの名前・言葉）は、ページに埋め込んだ設定（#game-config）と
 * /game/<slug>/words.json で決まる。新しいゲームの作り方は games/README.md
 */
(function () {
  'use strict';

  var CFG = JSON.parse(document.getElementById('game-config').textContent);
  var COURSES = CFG.courses;
  var REVIEW = { id: 'review', name: '苦手の復習', sec: 60, levels: COURSES.reduce(function (a, c) { return a.concat(c.levels); }, []), cross: COURSES[0].cross };
  // ストアの統計で、SPI 用語集から来た人を見分けられるように印を付ける
  var STORE_URL = 'https://chromewebstore.google.com/detail/kdppelkdplekjbiehpodfmmfcpbbfeho?utm_source=rakuraku-entry.com&utm_campaign=game';

  var $ = function (id) { return document.getElementById(id); };
  var words = [];
  var course = COURSES[CFG.defaultCourse || 0];
  // 画面の幅ではなく入力の種類で決める（タブレットにキーボードをつないだときや、狭いウィンドウのパソコンでも正しく分かれるように）
  var mobile = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;

  // ---- 保存（ブラウザの中だけ。使えなくても遊べる） ----
  function load(key, fallback) {
    try {
      var v = localStorage.getItem('rkgame:' + CFG.slug + ':' + key);
      if (!v) return fallback;
      v = JSON.parse(v);
      // 壊れた値（配列のはずが {} など）は使わない
      return kind(v) === kind(fallback) ? v : fallback;
    } catch (e) { return fallback; }
  }
  function kind(v) { return Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v; }
  function save(key, value) {
    try { localStorage.setItem('rkgame:' + CFG.slug + ':' + key, JSON.stringify(value)); } catch (e) { /* 保存できなくても続ける */ }
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  /** 例文の中の言葉に印をつける（「煌煌」は例文では「煌々」と書くので両方さがす） */
  function highlight(example, word) {
    var forms = [word];
    if (word.length === 2 && word[0] === word[1]) forms.push(word[0] + '々');
    if (word.length === 4 && word.slice(0, 2) === word.slice(2)) forms.push(word.slice(0, 2) + '々々');
    var html = esc(example);
    forms.forEach(function (f) { html = html.split(esc(f)).join('<mark>' + esc(f) + '</mark>'); });
    return html;
  }

  // ---- スタート画面 ----
  function renderCourses() {
    var best = load('best', {});
    $('courses').innerHTML = COURSES.map(function (c, i) {
      return '<button class="course" data-i="' + i + '" aria-pressed="' + (c === course) + '">' +
        '<span class="tag">' + c.tag + '</span><b>' + c.name + '</b>' +
        '<div class="sec">' + c.sec + '<small> 秒</small></div><div class="ex">' + c.ex + '</div>' +
        '<div class="best">' + (best[c.id] ? '自己ベスト ' + best[c.id].toLocaleString() + ' 点' : '') + '</div></button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.course'), function (b) {
      b.addEventListener('click', function () { course = COURSES[+b.dataset.i]; renderCourses(); });
    });
    var weak = weakList();
    $('weakStart').hidden = !weak.length;
    $('weakStart').textContent = '苦手な言葉（' + weak.length + ' 語）だけ復習する';
    $('play').textContent = mobile ? 'スタート' : 'スペースキーでスタート';
    $('keys').hidden = mobile;
    // スマホはもともと意味の 4 択なので、「意味クイズ」はパソコンだけ
    $('quizStart').hidden = mobile;
    $('empty').hidden = true;
  }

  function show(id) {
    ['start', 'play-pc', 'play-sp', 'result', 'wordbook'].forEach(function (s) { $(s).hidden = s !== id; });
    $('toast').hidden = true;
    window.scrollTo(0, 0);
    loadAds();
  }

  // ---- 広告（games/ads.json に ID があるときだけ、スタート・結果の画面とパソコンのプレイ中の画面に枠が入る） ----
  /** 見えている枠だけ読み込む。隠れた画面の枠は幅が 0 で読み込めないので、その画面を出したときに読み込む（1 枠 1 回まで） */
  function loadAds() {
    Array.prototype.forEach.call(document.querySelectorAll('ins.ad-unit'), function (el) {
      if (!el.offsetWidth) return;
      el.className = 'adsbygoogle';
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 広告が出なくても遊べる */ }
    });
  }

  // ---- 単語帳（出題しない言葉を選ぶ） ----
  /** 単語帳で「出題しない」にした言葉か */
  function isOff(w) { return load('off', []).indexOf(typeof w === 'string' ? w : w.w) >= 0; }
  /** 保存した一覧（出題しない・苦手）から、いまの言葉のリストにない言葉（名前を直した言葉など）を除く */
  function known(list) {
    return list.filter(function (n) { return words.some(function (w) { return w.w === n; }); });
  }
  /** 苦手な言葉のうち、出題するもの */
  function weakList() {
    var off = load('off', []);
    return known(load('weak', [])).filter(function (n) { return off.indexOf(n) < 0; });
  }

  var bookTab = 'all';
  function openBook() { bookTab = 'all'; renderWordbook(); show('wordbook'); }

  function renderWordbook() {
    var off = known(load('off', [])), weak = known(load('weak', []));
    $('wbCount').textContent = '出題する言葉 ' + (words.length - off.length) + ' / ' + words.length;
    Array.prototype.forEach.call($('wbTabs').children, function (b) {
      var n = b.dataset.t === 'off' ? off.length : b.dataset.t === 'weak' ? weak.length : words.length;
      b.textContent = b.dataset.label + ' ' + n;
      b.setAttribute('aria-pressed', String(b.dataset.t === bookTab));
    });
    var names = CFG.levelNames || {};
    var levels = words.map(function (w) { return w.lv; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    var html = levels.map(function (lv) {
      var list = words.filter(function (w) {
        if (w.lv !== lv) return false;
        if (bookTab === 'off') return off.indexOf(w.w) >= 0;
        if (bookTab === 'weak') return weak.indexOf(w.w) >= 0;
        return true;
      });
      if (!list.length) return '';
      var allOn = list.every(function (w) { return off.indexOf(w.w) < 0; });
      return '<div class="wbg"><div class="wbgh"><h3>' + esc(names[lv] || 'レベル ' + lv) + '<small>' + list.length + ' 語</small></h3>' +
        '<button class="wball" data-lv="' + lv + '" data-on="' + (allOn ? 0 : 1) + '">' + (allOn ? 'すべて出題しない' : 'すべて出題する') + '</button></div>' +
        list.map(function (w) {
          var on = off.indexOf(w.w) < 0;
          return '<label class="wbr' + (on ? '' : ' off') + '"><input type="checkbox" data-w="' + esc(w.w) + '"' + (on ? ' checked' : '') + ' /><span class="sw"></span>' +
            '<b>' + esc(w.w) + '</b><span class="y">' + esc(w.y) + '</span>' +
            '<span class="mn">' + esc(w.m) + '<span class="ex">例：' + highlight(w.e, w.w) + '</span></span></label>';
        }).join('') + '</div>';
    }).join('');
    $('wbList').innerHTML = html || '<p class="note">言葉がありません</p>';
  }

  function setOff(names, offNow) {
    var off = load('off', []);
    names.forEach(function (n) {
      var i = off.indexOf(n);
      if (offNow && i < 0) off.push(n);
      if (!offNow && i >= 0) off.splice(i, 1);
    });
    save('off', off);
    renderWordbook();
  }

  // ---- 出題する言葉 ----
  function pickWords(c, choice) {
    // 単語帳で「出題しない」にした言葉は出さない
    var off = load('off', []);
    var all = words.filter(function (w) { return off.indexOf(w.w) < 0; });
    var weak = choice ? load('weak', []) : [];
    if (c === REVIEW) return shuffle(all.filter(function (w) { return weak.indexOf(w.w) >= 0; }));
    // 満遍なく出すため、これまでに出した回数が少ない言葉から並べる（同じ回数どうしはランダム）
    var seen = load('seen', {});
    var pool = shuffle(all.filter(function (w) { return c.levels.indexOf(w.lv) >= 0; }))
      .sort(function (a, b) { return (seen[a.w] || 0) - (seen[b.w] || 0); });
    // 苦手な言葉を先頭のほうに混ぜる（3 割くらい）
    var weakIn = pool.filter(function (w) { return weak.indexOf(w.w) >= 0; });
    var rest = pool.filter(function (w) { return weak.indexOf(w.w) < 0; });
    var out = [];
    while (weakIn.length || rest.length) {
      if (weakIn.length && (Math.random() < 0.3 || !rest.length)) out.push(weakIn.shift());
      else out.push(rest.shift());
    }
    return out;
  }

  // ---- ゲームの状態 ----
  var G = null;

  /** quiz：意味の 4 択で遊ぶ（スマホはいつも 4 択。苦手の復習も 4 択） */
  function start(c, quiz) {
    // 苦手の復習のあとも、スタート画面では元のコースを選んだままにする
    if (c !== REVIEW) course = c;
    var choice = mobile || !!quiz || c === REVIEW;
    var queue = pickWords(c, choice);
    if (!queue.length) {
      if (!$('start').hidden) { $('empty').textContent = c === REVIEW ? '復習する言葉がありません' : 'このコースの言葉は、すべて「出題しない」になっています'; $('empty').hidden = false; }
      // 結果の画面から押したときは、その場で知らせる（ボタンが反応しないように見えないように）
      else toast(c === REVIEW ? '復習する言葉がありません（苦手な言葉は、すべて「出題しない」になっています）' : 'このコースの言葉は、すべて「出題しない」になっています');
      return;
    }
    stop();
    G = {
      course: c, choice: choice, queue: queue, qi: 0, score: 0, combo: 0, maxCombo: 0,
      keys: 0, misses: 0, left: c.sec, results: [], cards: [], running: false, last: 0,
    };
    if (choice) startChoice(); else startTyping();
  }

  /** 前のゲームのタイマーを止める（カウントダウン中にやめたり、すぐやり直したりしても前のが動かないように） */
  function stop() {
    if (!G) return;
    G.running = false;
    clearInterval(G.countdown);
    clearTimeout(G.nextTimer);
  }

  function record(w, ok) {
    G.results.push({ w: w, ok: ok });
    // 苦手として残すのは、4 択で意味を間違えたときだけ
    if (!G.choice) return;
    var weak = load('weak', []);
    var i = weak.indexOf(w.w);
    if (!ok && i < 0) weak.push(w.w);
    if (ok && i >= 0 && G.course === REVIEW) weak.splice(i, 1);
    save('weak', weak);
  }

  function nextWord() {
    // 苦手の復習は、それぞれの言葉を 1 回ずつ出したら終わり
    if (G.qi >= G.queue.length && G.course === REVIEW) return null;
    if (G.qi >= G.queue.length) { G.queue = G.queue.concat(shuffle(G.queue.slice())); }
    var w = G.queue[G.qi++];
    // 出した回数を数える（次のゲームで、まだ出ていない言葉を先に出すため）
    var seen = load('seen', {});
    seen[w.w] = (seen[w.w] || 0) + 1;
    save('seen', seen);
    return w;
  }

  // ---- パソコン：ベルトコンベア ----
  // ES は 1 枚ずつ流す。打ち終わったら（または右に落ちたら）次の 1 枚が左から入ってくる
  // カードの幅は game.json の cardWidth で変えられる（テーマで大きいカードにするとき）
  var CARD_W = CFG.cardWidth || 150, EDGE = 16, FAST = 900;
  // 意味の 2 択を出す間隔（語数）
  var QUIZ_EVERY = 5;

  function startTyping() {
    show('play-pc');
    $('cname').textContent = G.course.name;
    $('cards').innerHTML = '';
    G.mode = 'type';
    G.recent = [];
    setPanel('fs');
    $('score').textContent = '0';
    $('combo').textContent = '';
    $('left').textContent = G.course.sec;
    $('timer').style.transform = 'scaleX(1)';
    $('sent').innerHTML = '';
    $('sent').dataset.w = '';
    $('yomi').innerHTML = '';
    $('roma').innerHTML = '';
    $('ime').hidden = true;
    // 3・2・1 のあとに始める
    var n = 3;
    $('countdown').hidden = false;
    $('countdown').textContent = n;
    G.countdown = setInterval(function () {
      n--;
      if (n > 0) { $('countdown').textContent = n; return; }
      clearInterval(G.countdown);
      $('countdown').hidden = true;
      G.running = true;
      G.last = performance.now();
      spawn();
      requestAnimationFrame(tick);
    }, 650);
  }

  function spawn() {
    var w = nextWord();
    if (!w) return;
    var el = document.createElement('div');
    el.className = 'es';
    // テーマ（games/<slug>/game.json の theme）がレベルごとのイラストを出せるように、レベルを持たせる
    el.dataset.lv = w.lv;
    if (w.st) el.dataset.st = w.st;
    el.innerHTML = '<i class="il"></i><div class="t"><span>' + esc(CFG.card) + '</span><span>No.' + (G.n = (G.n || 0) + 1) + '</span></div>' +
      '<div class="w' + (w.w.length >= 3 ? ' long' : '') + (w.w.length >= 6 ? ' xlong' : '') + (w.w.length >= 9 ? ' xxlong' : '') + (w.w.length >= 12 ? ' xxxlong' : '') + '">' + esc(w.w) + '</div>' +
      '<div class="m"><b>意味</b>' + esc(w.m) + '</div>';
    $('cards').appendChild(el);
    // 打つのは言い回し（例：義憤を覚える）。言葉の読みが 2 通りあるときは、どちらの読みでもよい
    var readings = [w.y].concat(w.alt || []).map(function (y) { return (w.pre || '') + y + (w.post || ''); });
    var card = { w: w, el: el, x: -CARD_W, word: new window.Romaji.Word(readings), state: 'wait' };
    G.cards.push(card);
    place(card);
    setTarget();
  }

  function place(card) {
    card.el.style.transform = 'translateX(' + card.x + 'px)';
  }

  function target() {
    for (var i = 0; i < G.cards.length; i++) if (G.cards[i].state === 'wait') return G.cards[i];
    return null;
  }

  function setTarget() {
    G.cards.forEach(function (c) { c.el.classList.toggle('on', c === target()); });
    renderGuide();
  }

  /**
   * 工程の流れ図（game.json の steps）。言葉の st がその工程なら光らせる。ranges の名前なら範囲ごと、others の名前なら流れの外の言葉として見出しを出す
   */
  function renderProc(box, w) {
    if (!box || !CFG.steps) return;
    // 打つたびに呼ばれるので、言葉が変わったときだけ描き直す
    if (box.dataset.w === (w ? w.w : '')) return;
    box.dataset.w = w ? w.w : '';
    var st = w && w.st;
    var range = (CFG.ranges || {})[st];
    var ids = CFG.steps.map(function (s) { return s.id; });
    var on = function (id) {
      if (range) return ids.indexOf(id) >= ids.indexOf(range[0]) && ids.indexOf(id) <= ids.indexOf(range[1]);
      return id === st;
    };
    var other = (CFG.others || {})[st];
    box.hidden = !w;
    var step = CFG.steps.filter(function (s) { return s.id === st; })[0];
    // 見出し：流れの外の言葉はその説明、範囲の言葉は ranges の 3 つ目（説明）、1 つの工程なら工程の名前
    var head = other || (range ? range[2] || '' : step ? '製造工程：' + step.name : '');
    box.innerHTML = '<div class="ph">' + esc(head) + '</div><ol>' +
      CFG.steps.map(function (s) { return '<li data-st="' + s.id + '"' + (on(s.id) ? ' class="on"' : '') + '><i></i><span>' + esc(s.name) + '</span></li>'; }).join('') + '</ol>';
    box.classList.toggle('other', !!other);
  }

  function renderGuide() {
    var t = target();
    renderProc($('proc'), t && t.w);
    if (!t) { $('sent').innerHTML = ''; $('sent').dataset.w = ''; $('yomi').innerHTML = ''; $('roma').innerHTML = ''; return; }
    var w = t.w;
    // 例文全体を出し、打つ言い回しの部分に色をつける。意味は言い回しの真上に出す（打つときに目に入るように）
    if ($('sent').dataset.w !== w.w) {
      var at = w.e.indexOf(w.p);
      $('sent').dataset.w = w.w;
      $('sent').innerHTML = esc(w.e.slice(0, at)) + '<span class="gl"><span class="gloss" id="gloss">' + esc(w.w) + '＝' + esc(w.m) + '</span>' +
        '<span class="tp">' + highlight(w.p, w.w) + '</span></span>' + esc(w.e.slice(at + w.p.length));
      fitGloss();
    }
    var m = t.word.current();
    var g = m.guide();
    $('yomi').innerHTML = '<span class="dn">' + esc(m.reading.slice(0, g.kana)) + '</span>' + esc(m.reading.slice(g.kana));
    $('roma').innerHTML = '<span class="dn">' + esc(g.done) + '</span>' + (g.rest ? '<span class="cu">' + esc(g.rest[0]) + '</span>' + esc(g.rest.slice(1)) : '');
  }

  /** 意味の吹き出しが枠からはみ出さないように、左右にずらす */
  function fitGloss() {
    var g = $('gloss'), box = $('type').getBoundingClientRect();
    g.style.marginLeft = '0px';
    g.style.setProperty('--sh', '0px');
    var r = g.getBoundingClientRect(), pad = 16, shift = 0;
    if (r.right > box.right - pad) shift = box.right - pad - r.right;
    if (r.left + shift < box.left + pad) shift = box.left + pad - r.left;
    g.style.marginLeft = shift + 'px';
    g.style.setProperty('--sh', shift + 'px');
  }

  /** 下の枠に出すもの（fs：打つ・qz：意味の 2 択） */
  function setPanel(id) {
    ['fs', 'qz'].forEach(function (p) { $(p).hidden = p !== id; });
    $('paused').hidden = id === 'fs';
  }

  function tick(now) {
    if (!G || !G.running) return;
    // タブを切りかえて戻ったときに、一気に進まないように（重い端末でカードが遅れすぎないよう、少しは追いつく）
    var dt = Math.min(0.25, (now - G.last) / 1000);
    G.last = now;
    // 2 択の間は、残り時間を止める
    if (G.mode === 'type') G.left -= dt;
    var width = $('stage').clientWidth;
    // cross 秒でベルトの端から端まで流れる。時間がたつほど少しずつ速く
    var speed = (width - EDGE) / G.course.cross * (1 + (1 - G.left / G.course.sec) * 0.35);
    G.cards.forEach(function (c) {
      // 左から入ってくるときと、打ち終わって流れていくときは速く
      c.x += (c.state === 'done' || c.x < EDGE ? Math.max(speed, FAST) : speed) * dt;
      place(c);
    });
    // 右端から落ちた ES
    G.cards = G.cards.filter(function (c) {
      if (c.x > width) {
        if (c.state === 'wait') { record(c.w, false); G.combo = 0; $('combo').textContent = ''; }
        c.el.remove();
        return false;
      }
      return true;
    });
    if (G.mode === 'answered') {
      G.wait -= dt;
      if (G.wait <= 0) { G.mode = 'type'; setPanel('fs'); }
    }
    // 打つ ES がなくなったら、次の 1 枚
    if (G.mode === 'type' && !target()) spawn();
    G.belt = ((G.belt || 0) + speed * dt) % 48;
    $('belt').style.backgroundPosition = G.belt + 'px 0';
    $('left').textContent = Math.max(0, Math.ceil(G.left));
    $('timer').style.transform = 'scaleX(' + Math.max(0, G.left / G.course.sec) + ')';
    var reviewDone = G.course === REVIEW && G.qi >= G.queue.length && !target();
    if (G.left <= 0 || reviewDone) return finish();
    requestAnimationFrame(tick);
  }

  function onKey(e) {
    if (!$('start').hidden) {
      // ボタンやリンクにフォーカスがあるときは、そちらを押す（単語帳などを Tab と Enter で開けるように）
      var focused = e.target.closest && e.target.closest('button, a, input');
      if ((e.key === ' ' || e.key === 'Enter') && !focused) { e.preventDefault(); start(course); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var i = COURSES.indexOf(course) + (e.key === 'ArrowRight' ? 1 : -1);
        course = COURSES[(i + COURSES.length) % COURSES.length];
        renderCourses();
      }
      return;
    }
    if (!$('result').hidden) {
      if (e.key === 'r' || e.key === 'R') start(G.course, G.choice);
      if (e.key === 'Escape') toStart();
      return;
    }
    if (!$('wordbook').hidden) { if (e.key === 'Escape') toStart(); return; }
    if (!$('play-sp').hidden && G) {
      if (e.key === 'Escape') { toStart(); return; }
      var b = $('opts').querySelectorAll('[data-w]')[fj(e.key)];
      if (b) answer(b);
      else if (G.answered && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skipChoice(); }
      return;
    }
    if ($('play-pc').hidden || !G) return;
    if (e.key === 'Escape') { toStart(); return; }
    if (e.key === ' ') e.preventDefault();
    if (!G.running) return;
    if (G.mode === 'quiz') { if (fj(e.key) >= 0) answerQuiz(fj(e.key)); return; }
    if (G.mode === 'answered') { if ((fj(e.key) >= 0 || e.key === ' ' || e.key === 'Enter') && performance.now() - G.answeredAt >= SKIP_AFTER) G.wait = 0; return; }
    if (G.mode !== 'type') return;
    // 日本語入力のままだと打てないので知らせる
    if (e.isComposing || e.key === 'Process' || e.keyCode === 229) { $('ime').hidden = false; return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    var ch = e.key.toLowerCase();
    if (!/[a-z\-']/.test(ch)) return;
    e.preventDefault();
    $('ime').hidden = true;
    var t = target();
    if (!t) return;
    G.keys++;
    if (t.word.input(ch)) {
      G.score += Math.round(10 * (1 + Math.min(G.combo, 30) * 0.05));
      if (t.word.done()) complete(t);
      else renderGuide();
    } else {
      G.misses++;
      G.combo = 0;
      $('combo').textContent = '';
      var box = $('type');
      box.classList.remove('shake');
      void box.offsetWidth;
      box.classList.add('shake');
    }
    $('score').textContent = G.score.toLocaleString();
  }

  function complete(card) {
    card.state = 'done';
    card.el.classList.remove('on');
    card.el.classList.add('done');
    var stamp = document.createElement('div');
    stamp.className = 'stamp';
    stamp.textContent = '済';
    card.el.appendChild(stamp);
    G.combo++;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    G.score += 30 + G.combo * 5;
    $('combo').textContent = G.combo >= 3 ? '×' + G.combo + ' COMBO' : '';
    record(card.w, true);
    G.recent.push(card.w);
    setTarget();
    // QUIZ_EVERY 語打つごとに、少し前に打った言葉の意味を 2 択で聞く（直前の言葉だと簡単すぎるので外す）
    if (G.recent.length >= QUIZ_EVERY) startQuiz();
  }

  /** F／J の 2 択。キーボードの手の位置どおり、F は左・J は右に置く */
  function twoHTML(opts) {
    return '<div class="two">' + opts.map(function (o, i) {
      return '<button class="op k' + i + '" data-w="' + esc(o.w) + '"><kbd>' + (i ? 'J' : 'F') + '</kbd><span>' + esc(o.m) + '</span></button>';
    }).join('') + '</div>';
  }
  /** 押したキーが沈んで見えるように */
  function pressKey(btn) {
    var k = btn.querySelector('kbd');
    if (!k) return;
    k.classList.remove('press');
    void k.offsetWidth;
    k.classList.add('press');
  }
  /** 選択肢に混ぜる言葉。同じ意味の言葉と、意味の近い言葉（words.json の syn）は、どちらも正解に見えるので外す */
  function distractors(w) {
    return words.filter(function (x) {
      return x.w !== w.w && x.m !== w.m && (w.syn || []).indexOf(x.w) < 0 && (x.syn || []).indexOf(w.w) < 0;
    });
  }
  function fj(key) { return key === 'f' || key === 'F' ? 0 : key === 'j' || key === 'J' ? 1 : -1; }

  function startQuiz() {
    var pool = G.recent.slice(0, -1);
    var w = pool[Math.floor(Math.random() * pool.length)];
    G.recent = [];
    var other = shuffle(distractors(w))[0];
    var opts = shuffle([w, other]);
    G.quiz = { w: w, opts: opts };
    G.mode = 'quiz';
    $('qz').innerHTML = '<div class="q"><b>' + esc(w.w) + '</b>の意味は？<small>正解で +200</small></div>' + twoHTML(opts);
    Array.prototype.forEach.call($('qz').querySelectorAll('.op'), function (b, i) {
      b.addEventListener('click', function () {
        if (G && G.mode === 'quiz') answerQuiz(i);
        else if (G && G.mode === 'answered' && performance.now() - G.answeredAt >= SKIP_AFTER) G.wait = 0;
      });
    });
    setPanel('qz');
  }

  function answerQuiz(i) {
    var q = G.quiz, ok = q.opts[i] === q.w;
    var btns = $('qz').querySelectorAll('.op');
    pressKey(btns[i]);
    if (ok) G.score += 200;
    q.opts.forEach(function (o, j) {
      if (o === q.w) btns[j].classList.add('right');
      else if (j === i) btns[j].classList.add('wrong');
    });
    $('score').textContent = G.score.toLocaleString();
    // 正解・不正解と例文を少し見せてから戻る（キーで先へ進める）
    $('qz').querySelector('.q').innerHTML = '<span class="exs">' + exampleHTML(q.w) + '</span>';
    G.mode = 'answered';
    G.wait = EXAMPLE_SEC[ok ? 0 : 1];
    G.answeredAt = performance.now();
  }

  // ---- スマホ：意味を 4 択で選ぶ ----
  function startChoice() {
    show('play-sp');
    $('play-sp').classList.toggle('pc', !mobile);
    G.running = true;
    G.last = performance.now();
    $('score-sp').textContent = '0';
    askChoice();
    requestAnimationFrame(tickChoice);
  }

  /** 答えたあとに例文を出しておく秒数（正解・不正解）。この間は残り時間を止め、キーやタップで先へ進める */
  var EXAMPLE_SEC = [1.2, 2.0];
  /** 押しまちがいで飛ばさないよう、答えてからこの時間（ミリ秒）は先へ進めない */
  var SKIP_AFTER = 300;

  /** 例文の HTML（言葉に印をつける） */
  function exampleHTML(w) {
    return '<b>例文</b>' + highlight(w.e, w.w);
  }

  function askChoice() {
    if (!G || !G.running) return;
    clearTimeout(G.nextTimer);
    var w = nextWord();
    if (!w) return finish();
    G.cur = w;
    G.answered = false;
    $('q-word').textContent = w.w;
    $('q-word').parentNode.dataset.lv = w.lv;
    if (w.st) $('q-word').parentNode.dataset.st = w.st;
    renderProc($('proc-sp'), w);
    $('q-yomi').textContent = '';
    $('q-ask').hidden = false;
    $('q-ex').hidden = true;
    var others = shuffle(distractors(w)).slice(0, mobile ? 3 : 1);
    var opts = shuffle([w].concat(others));
    $('opts').innerHTML = mobile ? opts.map(function (o) { return '<button class="opt" data-w="' + esc(o.w) + '">' + esc(o.m) + '</button>'; }).join('') : twoHTML(opts);
    Array.prototype.forEach.call($('opts').querySelectorAll('[data-w]'), function (b) {
      b.addEventListener('click', function () { answer(b); });
    });
  }

  function answer(btn) {
    if (!G || !G.running) return;
    // 例文を出しているときにもう一度押したら、次の問題へ
    if (G.answered) return skipChoice();
    G.answered = true;
    G.answeredAt = performance.now();
    var ok = btn.dataset.w === G.cur.w;
    G.keys++;
    if (ok) { G.combo++; G.score += 50 + Math.min(G.combo, 20) * 5; } else { G.misses++; G.combo = 0; }
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    record(G.cur, ok);
    pressKey(btn);
    Array.prototype.forEach.call($('opts').querySelectorAll('[data-w]'), function (b) {
      if (b.dataset.w === G.cur.w) b.classList.add('right');
      else if (b === btn) b.classList.add('wrong');
    });
    $('q-yomi').textContent = G.cur.y;
    // 答えたら、言葉のカードに例文を出す（使い方ごと覚えられるように）
    $('q-ask').hidden = true;
    $('q-ex').innerHTML = exampleHTML(G.cur);
    $('q-ex').hidden = false;
    $('score-sp').textContent = G.score.toLocaleString();
    G.nextTimer = setTimeout(askChoice, EXAMPLE_SEC[ok ? 0 : 1] * 1000);
  }

  function skipChoice() {
    if (performance.now() - G.answeredAt < SKIP_AFTER) return;
    askChoice();
  }

  function tickChoice(now) {
    if (!G || !G.running) return;
    // アプリを切りかえて戻ったときに、残り時間が一気に減らないように。例文を出している間は止める
    if (!G.answered) G.left -= Math.min(0.25, (now - G.last) / 1000);
    G.last = now;
    $('left-sp').textContent = Math.max(0, Math.ceil(G.left));
    $('timer-sp').style.transform = 'scaleX(' + Math.max(0, G.left / G.course.sec) + ')';
    if (G.left <= 0) return finish();
    requestAnimationFrame(tickChoice);
  }

  // ---- 結果 ----
  function finish() {
    stop();
    show('result');
    var ok = G.results.filter(function (r) { return r.ok; });
    var ng = G.results.filter(function (r) { return !r.ok; });
    var acc = G.keys ? Math.round(((G.keys - G.misses) / G.keys) * 100) : 0;
    // 称号は 1 分あたりの点数で決める（コースの長さが違っても比べられるように）
    var perMin = G.score / (G.course.sec / 60);
    // 称号はゲームごとに決められる（[1 分あたりの点数, 称号] の高い順）
    var ranks = CFG.ranks || [[6000, 'マスター'], [3500, 'エキスパート'], [1500, 'ルーキー'], [0, '見習い']];
    var rankAt = ranks.findIndex(function (r) { return perMin >= r[0]; });
    var rank = ranks[rankAt][1];
    $('rank').textContent = rank;
    $('r-score').textContent = G.score.toLocaleString();
    $('r-ok').textContent = ok.length;
    $('r-weak').textContent = ng.length;
    $('r-weak-label').textContent = G.choice ? '苦手' : '見送り';
    $('again').textContent = mobile ? 'もう一度' : 'もう一度（R キー）';
    $('r-acc').textContent = acc + '%';
    var best = load('best', {});
    // パソコンの意味クイズは、タイピングとは別に自己ベストをとる
    var bestId = G.course.id + (G.choice && !mobile ? ':quiz' : '');
    var isBest = G.course !== REVIEW && G.score > (best[bestId] || 0);
    if (isBest) { best[bestId] = G.score; save('best', best); }
    $('r-best').textContent = isBest && G.score > 0 ? '自己ベスト更新！' : '';
    var text = CFG.title + '（' + G.course.name + '）で ' + G.score.toLocaleString() + ' 点！' + ok.length + (G.choice ? ' 語の意味を当てました。' : ' 語を打てました。');
    $('share').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(CFG.url + '/r/' + rankAt) + '&hashtags=' + encodeURIComponent(CFG.hashtags.join(','));
    G.tab = 'all';
    renderBook();
  }

  function renderBook() {
    var seen = {};
    var list = G.results.filter(function (r) {
      // 同じ言葉が 2 回出たら、まとめて 1 行に（1 回でも打ちそびれたら ×）
      if (seen[r.w.w]) { if (!r.ok) seen[r.w.w].ok = false; return false; }
      seen[r.w.w] = r;
      return true;
    });
    var ng = list.filter(function (r) { return !r.ok; });
    $('tab-all').textContent = 'すべて ' + list.length;
    $('tab-weak').textContent = '苦手 ' + ng.length;
    $('tab-weak').hidden = !G.choice;
    $('tab-all').setAttribute('aria-pressed', String(G.tab === 'all'));
    $('tab-weak').setAttribute('aria-pressed', String(G.tab === 'weak'));
    var rows = G.tab === 'weak' ? ng : list.slice();
    if (G.choice) rows.sort(function (a, b) { return a.ok - b.ok; });
    $('words').innerHTML = rows.length ? rows.map(function (r) {
      var w = r.w;
      var off = isOff(w);
      // タイピングで打ちそびれた言葉は「見送り」（間違いではない）
      var mark = r.ok ? 'o">○' : G.choice ? 'x">✕' : 's">－';
      return '<div class="wrow' + (r.ok || !G.choice ? '' : ' miss') + (off ? ' gone' : '') + '"><span class="mk ' + mark + '</span>' +
        '<b>' + esc(w.w) + '</b><span class="y">' + esc(w.y) + '</span>' +
        '<span>' + esc(w.m) + '<span class="ex">例：' + esc(w.e) + '</span></span>' +
        '<button class="hide' + (off ? ' on' : '') + '" data-w="' + esc(w.w) + '" aria-pressed="' + off + '" title="' + (off ? '次のゲームから出しません（押すと戻す）' : '次のゲームから出さない') + '">' +
        (off ? ICON_CHECK : ICON_EYE_OFF) + '<span class="lb">' + (off ? '出さない' : 'もう出さない') + '</span></button></div>';
    }).join('') : '<p class="note">まだ言葉がありません</p>';
    // 正解した言葉（まだ外していないもの）をまとめて外すボタン
    var okNames = list.filter(function (r) { return r.ok && !isOff(r.w); }).map(function (r) { return r.w.w; });
    $('hideOk').hidden = !okNames.length;
    $('hideOk').innerHTML = '<span class="o">○</span>正解した ' + okNames.length + ' 語を、もう出さない';
    $('hideOk').dataset.names = JSON.stringify(okNames);
    // 苦手の復習（「もう出さない」にした言葉は数えない。外したり戻したりしたら数え直す）
    var weak = weakList();
    $('review').hidden = !G.choice || !weak.length;
    $('review-text').innerHTML = '苦手な言葉が <b>' + weak.length + ' 語</b>';
  }

  // ---- 結果の単語帳から言葉を外す（単語帳の「出題しない」と同じ一覧に入れる） ----
  var ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c5 0 9 4.5 10 8a13 13 0 0 1-2.2 3.6M6.6 6.6C4.4 8 2.8 10.1 2 12c1 3.5 5 8 10 8a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  // コースの言葉がこれより少なくなるほどは外せない（遊べる言葉がなくならないように）
  var MIN_WORDS = 10;

  /** names を外しても、選んでいるコースに MIN_WORDS 語以上残るか。残らないときは知らせて false */
  function canHide(names) {
    var off = load('off', []);
    var left = words.filter(function (w) {
      return course.levels.indexOf(w.lv) >= 0 && off.indexOf(w.w) < 0 && names.indexOf(w.w) < 0;
    }).length;
    if (left >= MIN_WORDS) return true;
    toast('これ以上外すと「' + course.name + '」の言葉が ' + MIN_WORDS + ' 語より少なくなります');
    return false;
  }

  var toastTimer;
  /** 画面の下に一言出す。undo があれば「元に戻す」も出す */
  function toast(text, undo) {
    $('toastText').textContent = text;
    $('toastUndo').hidden = !undo;
    $('toastUndo').onclick = function () { $('toast').hidden = true; if (undo) undo(); };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').hidden = true; }, 6000);
  }

  function toggleHide(name) {
    if (isOff(name)) setOff([name], false);
    else if (canHide([name])) setOff([name], true);
    renderBook();
  }

  function hideCorrect() {
    var names = JSON.parse($('hideOk').dataset.names || '[]');
    if (!names.length || !canHide(names)) return;
    setOff(names, true);
    renderBook();
    toast('正解した ' + names.length + ' 語を、次から出さないようにしました', function () { setOff(names, false); renderBook(); });
  }

  function toStart() {
    stop();
    G = null;
    show('start');
    renderCourses();
  }

  // ---- はじめに ----
  document.addEventListener('keydown', onKey);
  $('play').addEventListener('click', function () { start(course); });
  $('weakStart').addEventListener('click', function () { start(REVIEW); });
  $('reviewBtn').addEventListener('click', function () { start(REVIEW); });
  $('again').addEventListener('click', function () { start(G.course, G.choice); });
  $('quizStart').addEventListener('click', function () { start(course, true); });
  $('bookOpen').addEventListener('click', openBook);
  $('bookBack').addEventListener('click', toStart);
  $('wbTabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { bookTab = b.dataset.t; renderWordbook(); } });
  $('wbList').addEventListener('change', function (e) { if (e.target.dataset.w) setOff([e.target.dataset.w], !e.target.checked); });
  $('wbList').addEventListener('click', function (e) {
    var b = e.target.closest('.wball');
    if (!b) return;
    var names = Array.prototype.map.call(b.closest('.wbg').querySelectorAll('input'), function (i) { return i.dataset.w; });
    setOff(names, b.dataset.on === '0');
  });
  $('back').addEventListener('click', toStart);
  $('quitSp').addEventListener('click', toStart);
  $('tab-all').addEventListener('click', function () { G.tab = 'all'; renderBook(); });
  $('tab-weak').addEventListener('click', function () { G.tab = 'weak'; renderBook(); });
  $('words').addEventListener('click', function (e) { var b = e.target.closest('.hide'); if (b) toggleHide(b.dataset.w); });
  $('hideOk').addEventListener('click', hideCorrect);
  $('bookLink').addEventListener('click', openBook);
  // 裏のタブで開いたときなど、画面を出した時点で幅がなかった枠は、見えるようになってから読み込む
  window.addEventListener('resize', loadAds);
  document.addEventListener('visibilitychange', loadAds);
  document.querySelector('.cta .btn').href = STORE_URL;

  fetch('/game/' + CFG.slug + '/words.json?v=' + CFG.version)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      words = data;
      renderCourses();
      show('start');
      // ?mode=quiz で意味クイズ、?mode=book で単語帳をすぐ開く（マイページのホームなどから来たとき）
      var mode = new URLSearchParams(location.search).get('mode');
      if (mode) history.replaceState(null, '', location.pathname);
      if (mode === 'quiz') start(course, true);
      if (mode === 'book') openBook();
    });
})();
