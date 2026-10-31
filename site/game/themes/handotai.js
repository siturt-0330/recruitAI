/*
 * 半導体用語タイピングの演出。共通のエンジン（game.js）が出す gamefx の合図を聞いて、アニメーションを付ける。
 * 「動きを減らす」設定のときは、動き（飛ぶ・流れる・舞う）は出さず、色の変化だけにする
 */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  /** 同じアニメーションをもう一度最初から動かす */
  var replay = function (el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  var after = function (ms, fn) { return setTimeout(fn, ms); };
  var center = function (r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  /* ---- 1. 背景：回路の線を光が流れる ---- */
  function circuit() {
    if (reduce) return;
    var w = window.innerWidth, h = Math.max(window.innerHeight, 900);
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'fx-circuit');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 16; i++) {
      // 縦横に折れる回路の線を、画面の端から端まで引く
      var x = Math.random() * w, y = Math.random() * h, d = 'M' + x.toFixed(0) + ' ' + y.toFixed(0);
      for (var k = 0; k < 6; k++) {
        if (k % 2) y += (Math.random() - 0.5) * 360; else x += (Math.random() * 0.6 + 0.2) * w * (Math.random() < 0.5 ? -0.5 : 0.5);
        d += ' L' + x.toFixed(0) + ' ' + y.toFixed(0);
      }
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.style.animationDuration = (5 + Math.random() * 7).toFixed(1) + 's';
      p.style.animationDelay = (-Math.random() * 10).toFixed(1) + 's';
      svg.appendChild(p);
    }
    document.body.prepend(svg);
  }

  /* ---- 16. 点数がパラパラと回って増える（エンジンが点数を書いたあとに、前の値から数え上げる） ---- */
  var rolls = {};
  function roll(id) {
    var el = $(id);
    if (!el) return;
    var st = rolls[id] || (rolls[id] = { shown: 0, raf: 0 });
    var to = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
    cancelAnimationFrame(st.raf);
    if (to <= st.shown || reduce) { st.shown = to; return; }
    var from = st.shown, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / 260);
      st.shown = Math.round(from + (to - from) * k);
      el.textContent = st.shown.toLocaleString();
      if (k < 1) st.raf = requestAnimationFrame(step);
    })(t0);
    replay(el, 'fx-pop');
  }
  /** エンジンは合図のあとで点数を書くので、書き終わってから数える */
  var rollSoon = function () { setTimeout(function () { roll('score'); roll('score-sp'); }, 0); };

  /* ---- 30. タップ・クリックした場所から波紋 ---- */
  document.addEventListener('pointerdown', function (e) {
    if (reduce) return;
    var el = e.target.closest && e.target.closest('.course, .mode, .btn, .opt, .op, .weak-link');
    if (!el) return;
    var r = el.getBoundingClientRect();
    var dot = document.createElement('span');
    dot.className = 'fx-ripple';
    dot.style.left = e.clientX - r.left + 'px';
    dot.style.top = e.clientY - r.top + 'px';
    el.appendChild(dot);
    after(650, function () { dot.remove(); });
  });

  /* ---- 4. コースを選ぶと、チップのように沈み込む ---- */
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.course');
    if (c) replay(c, 'fx-press');
  });

  /* ---- 32. 単語帳で「出題しない」を切り替えた行を光らせる（行は描き直されるので、描き直したあとで探す） ---- */
  document.addEventListener('change', function (e) {
    var name = e.target && e.target.dataset && e.target.dataset.w;
    if (!name) return;
    after(0, function () {
      var input = document.querySelector('#wbList input[data-w="' + CSS.escape(name) + '"]');
      if (input) replay(input.closest('.wbr'), 'fx-toggled');
    });
  }, true);

  /* ---- 31. 単語一覧：スクロールすると、言葉の行が下から順に出てくる ---- */
  function revealList() {
    var items = document.querySelectorAll('.wl .it');
    if (!items.length || reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('fx-show');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    Array.prototype.forEach.call(items, function (it) {
      // 最初から見えている行は隠さない（隠すのは、下のほうの行だけ）
      if (it.getBoundingClientRect().top < window.innerHeight) return;
      it.classList.add('fx-hide');
      io.observe(it);
    });
  }

  /* ---- 演出の部品 ---- */
  /** ステージの中に一言を大きく出す（コンボ・全工程コンプリート） */
  function banner(text, cls) {
    var stage = $('stage');
    if (!stage) return;
    var b = document.createElement('div');
    b.className = 'fx-banner' + (cls ? ' ' + cls : '');
    b.textContent = text;
    stage.appendChild(b);
    after(1700, function () { b.remove(); });
  }

  /** 13・14. 正解したカードが光になって、流れ図のその工程へ吸い込まれる */
  function flyToProc(el, w) {
    var proc = $('proc');
    if (!proc || proc.hidden) return;
    var lit = Array.prototype.slice.call(proc.querySelectorAll('li.on'));
    var ids = lit.map(function (li) { return li.dataset.st; });
    var goal = lit.length ? lit[Math.floor(lit.length / 2)] : proc.querySelector('.ph');
    if (!goal) return;
    var from = center(el.getBoundingClientRect()), to = center(goal.getBoundingClientRect());
    var hit = function () {
      // 流れ図は次の言葉で描き直されているので、同じ工程を探し直して光らせる
      var targets = ids.length ? ids.map(function (id) { return proc.querySelector('li[data-st="' + id + '"]'); }) : [proc];
      targets.forEach(function (t) { replay(t, 'fx-hit'); });
      var plus = document.createElement('div');
      plus.className = 'fx-plus';
      plus.textContent = '+1';
      plus.style.left = to.x + 'px';
      plus.style.top = to.y - 18 + 'px';
      document.body.appendChild(plus);
      after(900, function () { plus.remove(); });
    };
    if (reduce) return hit();
    var ghost = document.createElement('div');
    ghost.className = 'fx-ghost';
    ghost.textContent = w.w;
    ghost.style.left = from.x + 'px';
    ghost.style.top = from.y + 'px';
    document.body.appendChild(ghost);
    var dx = to.x - from.x, dy = to.y - from.y;
    ghost.animate(
      [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.25)', opacity: 0.2 }],
      { duration: 620, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' },
    ).onfinish = function () { ghost.remove(); hit(); };
    for (var i = 0; i < 10; i++) {
      var s = document.createElement('div');
      s.className = 'fx-spark';
      s.style.left = from.x + (Math.random() - 0.5) * 120 + 'px';
      s.style.top = from.y + (Math.random() - 0.5) * 90 + 'px';
      document.body.appendChild(s);
      var sx = to.x - parseFloat(s.style.left), sy = to.y - parseFloat(s.style.top);
      s.animate(
        [{ transform: 'translate(0, 0) scale(1)', opacity: 1 }, { transform: 'translate(' + sx + 'px, ' + sy + 'px) scale(.3)', opacity: 0 }],
        { duration: 500 + Math.random() * 300, delay: Math.random() * 120, easing: 'ease-in', fill: 'forwards' },
      ).onfinish = (function (n) { return function () { n.remove(); }; })(s);
    }
  }

  /** 21. 光の点が、前に光っていた工程から次の工程へ流れ図を伝って移る */
  var lastDot = null;
  function moveDot(box) {
    var lit = box.querySelectorAll('li.on');
    box.classList.toggle('fx-sweep', lit.length > 1);
    if (lit.length !== 1) { lastDot = null; return; }
    var to = center(lit[0].getBoundingClientRect());
    if (lastDot && !reduce) {
      var dot = document.createElement('div');
      dot.className = 'fx-dot';
      document.body.appendChild(dot);
      dot.animate(
        [{ left: lastDot.x + 'px', top: lastDot.y + 'px', opacity: 1 }, { left: to.x + 'px', top: to.y + 'px', opacity: 0.9 }],
        { duration: 420, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' },
      ).onfinish = function () { dot.remove(); };
    }
    lastDot = to;
  }

  /** 12. 右端に近づいたカードは、枠を赤く点滅させて急かす */
  var watching = false;
  function watchEdge() {
    if (watching) return;
    watching = true;
    (function loop() {
      var stage = $('stage'), play = $('play-pc');
      if (!stage || !play || play.hidden) { watching = false; return; }
      var right = stage.getBoundingClientRect().right;
      Array.prototype.forEach.call(stage.querySelectorAll('.es'), function (c) {
        c.classList.toggle('fx-danger', !c.classList.contains('done') && c.getBoundingClientRect().right > right - 90);
      });
      requestAnimationFrame(loop);
    })();
  }

  /** 11. ベルトは、残り時間が減るほど速く流れる */
  var beltAnim = null, beltTimer = 0;
  function runBelt(sec) {
    var belt = document.querySelector('#stage .belt');
    if (!belt || reduce) return;
    if (beltAnim) beltAnim.cancel();
    beltAnim = belt.animate([{ backgroundPositionX: '0px' }, { backgroundPositionX: '48px' }], { duration: 900, iterations: Infinity });
    var t0 = performance.now();
    clearInterval(beltTimer);
    beltTimer = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / (sec * 1000));
      beltAnim.playbackRate = 1 + k * 1.6;
    }, 500);
  }
  function stopBelt() {
    clearInterval(beltTimer);
    if (beltAnim) { beltAnim.cancel(); beltAnim = null; }
  }

  /** 25. 結果の点数を数えながら、ウエハーに 1 チップずつ描いていく */
  function waferScore(score) {
    var box = document.querySelector('#result .score');
    var num = $('r-score');
    if (!box || !num) return;
    var wafer = box.querySelector('.fx-wafer');
    if (!wafer) {
      wafer = document.createElement('div');
      wafer.className = 'fx-wafer';
      var cells = '';
      for (var y = 0; y < 11; y++) for (var x = 0; x < 11; x++) {
        var cx = x * 10 + 5 - 55, cy = y * 10 + 5 - 55;
        if (cx * cx + cy * cy < 47 * 47) cells += '<rect x="' + (x * 10 + 1) + '" y="' + (y * 10 + 1) + '" width="8" height="8" rx="1.5"/>';
      }
      wafer.innerHTML = '<svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="53"/>' + cells + '</svg>';
      box.insertBefore(wafer, box.firstChild);
    }
    var rects = wafer.querySelectorAll('rect');
    Array.prototype.forEach.call(rects, function (r) { r.classList.remove('on'); });
    // 点数の高さで、いくつのチップを描くか決める（6000 点で全部）
    var lit = Math.round(rects.length * Math.min(1, score / 6000));
    var t0 = performance.now(), dur = reduce ? 0 : 1300;
    (function step(now) {
      var k = dur ? Math.min(1, (now - t0) / dur) : 1;
      var e = 1 - Math.pow(1 - k, 3);
      num.textContent = Math.round(score * e).toLocaleString();
      for (var i = 0; i < Math.round(lit * e); i++) rects[i].classList.add('on');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /** 27. 自己ベストで、光の粒が舞う */
  function burst() {
    if (reduce) return;
    var cv = document.createElement('canvas');
    cv.className = 'fx-burst';
    var w = (cv.width = window.innerWidth), h = (cv.height = window.innerHeight);
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    var ps = [];
    for (var i = 0; i < 140; i++) {
      var a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
      ps.push({ x: w / 2, y: h * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 2.5, c: Math.random() < 0.5 ? '34,211,238' : '52,211,153' });
    }
    var t0 = performance.now();
    (function frame(now) {
      var k = (now - t0) / 2200;
      ctx.clearRect(0, 0, w, h);
      ps.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.99;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + p.c + ',' + Math.max(0, 1 - k) + ')';
        ctx.shadowColor = 'rgba(' + p.c + ',1)';
        ctx.shadowBlur = 12;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  /* ---- エンジンの合図ごとの演出 ---- */
  var COMBO = { 5: '歩留まり上昇中', 10: '歩留まり 100%！', 20: '量産体制に入った！', 30: '最先端ノード到達！' };
  var doneSteps = {}, allShown = false, dark = null;
  var on = {
    // 34. 画面の切り替えをフェードとスライドでつなぐ
    screen: function (d) {
      replay(d.el, 'fx-enter');
      if (dark && d.id !== 'play-pc' && d.id !== 'play-sp') { dark.remove(); dark = null; }
      if (d.id !== 'play-pc') stopBelt();
      // 31. 単語帳を開いたときは、行を順に出す
      if (d.id === 'wordbook' && !reduce) {
        Array.prototype.forEach.call(document.querySelectorAll('#wbList .wbr'), function (r, i) { r.style.setProperty('--n', Math.min(i, 24)); });
        replay($('wbList'), 'fx-reveal');
      }
    },
    // 6. カウントダウンの数字が、ウエハーの上に露光されるように浮かび上がる
    count: function () { replay($('countdown'), 'fx-expose'); },
    // 7. スタートの瞬間、ステージをスキャンラインが走る
    go: function (d) {
      rolls = {};
      doneSteps = {};
      allShown = false;
      lastDot = null;
      $('stage') && ($('stage').dataset.combo = '0');
      replay($('stage'), 'fx-scan');
      runBelt(d.sec || 60);
      watchEdge();
    },
    // 8. 新しいカードは、上から降りてきてベルトに乗る
    spawn: function (d) { if (!reduce) d.el.classList.add('fx-drop'); },
    // 10. 1 文字打つたびに、カードの絵が脈打つ
    key: function (d) { replay(d.el.querySelector('.il'), 'fx-pulse'); rollSoon(); },
    // 17・18. ミス：間違えた文字が赤く光り、ステージにノイズが走る
    miss: function () {
      replay($('roma'), 'fx-miss');
      replay($('stage'), 'fx-glitch');
      $('stage') && ($('stage').dataset.combo = '0');
    },
    drop: function () { $('stage') && ($('stage').dataset.combo = '0'); },
    done: function (d) {
      rollSoon();
      flyToProc(d.el, d.w);
      // 19・20. コンボで一言と、ベルトの光の色が変わる
      if (COMBO[d.combo]) banner(d.combo + ' 連続　' + COMBO[d.combo]);
      var stage = $('stage');
      if (stage) stage.dataset.combo = d.combo >= 20 ? '3' : d.combo >= 10 ? '2' : d.combo >= 5 ? '1' : '0';
      // 23. 11 の工程をすべて 1 回ずつ打つと「全工程コンプリート」
      var steps = (window.__gameSteps || []);
      if (d.w.st && steps.indexOf(d.w.st) >= 0) doneSteps[d.w.st] = true;
      if (!allShown && steps.length && steps.every(function (s) { return doneSteps[s]; })) {
        allShown = true;
        after(700, function () { banner('全工程コンプリート！', 'fx-complete'); });
      }
    },
    // 21・22. 流れ図：光の点が工程を移る。範囲の言葉は左から順に光る
    target: function (d) { if (d.w) moveDot(d.box); },
    // 29. 次の問題へ移るとき、カードが横から入れ替わる
    question: function () {
      var card = $('q-word') && $('q-word').parentNode;
      replay(card, 'fx-slide');
      replay($('opts'), 'fx-slide');
    },
    // 28. 答えたボタンを光らせる（正解は弾む、不正解は震える。CSS で right・wrong に付ける）
    answer: function (d) {
      rollSoon();
      if (d.ok && COMBO[d.combo] && $('play-sp') && !$('play-sp').hidden) {
        var card = $('q-word').parentNode;
        replay(card, 'fx-combo');
      }
    },
    // 24. 時間切れ：照明が落ちるように暗くなってから結果へ
    ending: function () {
      stopBelt();
      if (dark) dark.remove();
      dark = document.createElement('div');
      dark.className = 'fx-dark';
      document.body.appendChild(dark);
    },
    // 25・26・27. 結果：点数をウエハーに描きながら数え、称号のカードを裏返し、自己ベストなら光の粒
    finish: function (d) {
      if (dark) { dark.remove(); dark = null; }
      waferScore(d.score);
      replay($('rank'), 'fx-flip');
      if (d.best) after(500, burst);
    },
  };
  document.addEventListener('gamefx', function (e) {
    var fn = on[e.detail.type];
    if (fn) fn(e.detail);
  });

  function init() {
    var cfg = document.getElementById('game-config');
    try {
      window.__gameSteps = cfg ? (JSON.parse(cfg.textContent).steps || []).map(function (s) { return s.id; }) : [];
    } catch (e) {
      window.__gameSteps = [];
    }
    circuit();
    revealList();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
