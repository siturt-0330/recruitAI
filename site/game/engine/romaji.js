/*
 * ひらがなの読みを、ローマ字の打ち方（いくつもの書き方を認める）で判定する。
 * 例：「し」は shi / si / ci、「っ」は次の子音を重ねるか xtu / ltu、「ん」は nn（次が母音・y・n でなければ n だけでもよい）。
 */
(function () {
  'use strict';

  // 先頭がいちばんよく使う書き方（ガイドに出す）
  var SINGLE = {
    'あ': ['a'], 'い': ['i', 'yi'], 'う': ['u', 'wu', 'whu'], 'え': ['e'], 'お': ['o'],
    'か': ['ka', 'ca'], 'き': ['ki'], 'く': ['ku', 'cu', 'qu'], 'け': ['ke'], 'こ': ['ko', 'co'],
    'さ': ['sa'], 'し': ['shi', 'si', 'ci'], 'す': ['su'], 'せ': ['se', 'ce'], 'そ': ['so'],
    'た': ['ta'], 'ち': ['chi', 'ti'], 'つ': ['tsu', 'tu'], 'て': ['te'], 'と': ['to'],
    'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
    'は': ['ha'], 'ひ': ['hi'], 'ふ': ['fu', 'hu'], 'へ': ['he'], 'ほ': ['ho'],
    'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
    'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
    'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
    'わ': ['wa'], 'を': ['wo'],
    'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
    'ざ': ['za'], 'じ': ['ji', 'zi'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
    'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
    'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
    'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
    'ゔ': ['vu'],
    'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li'], 'ぅ': ['xu', 'lu'], 'ぇ': ['xe', 'le'], 'ぉ': ['xo', 'lo'],
    'ゃ': ['xya', 'lya'], 'ゅ': ['xyu', 'lyu'], 'ょ': ['xyo', 'lyo'], 'ゎ': ['xwa', 'lwa'],
    'っ': ['xtu', 'ltu', 'xtsu', 'ltsu'],
    'ー': ['-'],
  };

  var DOUBLE = {
    'きゃ': ['kya'], 'きゅ': ['kyu'], 'きょ': ['kyo'], 'きぇ': ['kye'],
    'しゃ': ['sha', 'sya'], 'しゅ': ['shu', 'syu'], 'しょ': ['sho', 'syo'], 'しぇ': ['she', 'sye'],
    'ちゃ': ['cha', 'tya', 'cya'], 'ちゅ': ['chu', 'tyu', 'cyu'], 'ちょ': ['cho', 'tyo', 'cyo'], 'ちぇ': ['che', 'tye', 'cye'],
    'にゃ': ['nya'], 'にゅ': ['nyu'], 'にょ': ['nyo'],
    'ひゃ': ['hya'], 'ひゅ': ['hyu'], 'ひょ': ['hyo'],
    'みゃ': ['mya'], 'みゅ': ['myu'], 'みょ': ['myo'],
    'りゃ': ['rya'], 'りゅ': ['ryu'], 'りょ': ['ryo'],
    'ぎゃ': ['gya'], 'ぎゅ': ['gyu'], 'ぎょ': ['gyo'],
    'じゃ': ['ja', 'zya', 'jya'], 'じゅ': ['ju', 'zyu', 'jyu'], 'じょ': ['jo', 'zyo', 'jyo'], 'じぇ': ['je', 'zye', 'jye'],
    'ぢゃ': ['dya'], 'ぢゅ': ['dyu'], 'ぢょ': ['dyo'],
    'びゃ': ['bya'], 'びゅ': ['byu'], 'びょ': ['byo'],
    'ぴゃ': ['pya'], 'ぴゅ': ['pyu'], 'ぴょ': ['pyo'],
    'ふぁ': ['fa'], 'ふぃ': ['fi'], 'ふぇ': ['fe'], 'ふぉ': ['fo'],
    'てぃ': ['thi'], 'でぃ': ['dhi'], 'うぃ': ['wi'], 'うぇ': ['we'],
  };

  var SMALL = 'ぁぃぅぇぉゃゅょゎ';

  function uniq(a) {
    var out = [];
    for (var i = 0; i < a.length; i++) if (out.indexOf(a[i]) < 0) out.push(a[i]);
    return out;
  }

  /** 読みを、打つ単位（かな 1〜2 文字と、そのローマ字の書き方）に分ける */
  function units(reading) {
    var raw = [];
    for (var i = 0; i < reading.length; ) {
      var two = reading.substr(i, 2);
      if (two.length === 2 && SMALL.indexOf(two[1]) >= 0 && DOUBLE[two]) {
        // 「きゃ」は kya のほか、ki + xya と分けて打ってもよい
        var opts = DOUBLE[two].slice();
        var a = SINGLE[two[0]] || [], b = SINGLE[two[1]] || [];
        for (var x = 0; x < a.length; x++) for (var y = 0; y < b.length; y++) opts.push(a[x] + b[y]);
        raw.push({ kana: two, opts: uniq(opts) });
        i += 2;
      } else {
        var ch = reading[i];
        raw.push({ kana: ch, opts: (SINGLE[ch] || [ch]).slice() });
        i += 1;
      }
    }
    // 「っ」は次の単位とまとめる（kka のように子音を重ねるか、xtu + ka）
    var out = [];
    for (var j = 0; j < raw.length; j++) {
      var u = raw[j];
      if (u.kana === 'っ' && j + 1 < raw.length) {
        var next = raw[j + 1];
        var o = [];
        next.opts.forEach(function (n) {
          if (/^[bcdfghjkmpqrstvwxyz]/.test(n)) o.push(n[0] + n);
        });
        u.opts.forEach(function (s) { next.opts.forEach(function (n) { o.push(s + n); }); });
        out.push({ kana: 'っ' + next.kana, opts: uniq(o) });
        j++;
      } else {
        out.push(u);
      }
    }
    // 「ん」は nn。次が母音・y・n で始まらなければ n だけでもよい（最後の「ん」は nn）
    for (var k = 0; k < out.length; k++) {
      if (out[k].kana !== 'ん') continue;
      var after = out[k + 1];
      var single = after && after.opts.every(function (n) { return !/^[aiueoyn]/.test(n); });
      out[k].opts = single ? ['n', 'nn', 'xn', "n'"] : ['nn', 'xn', "n'"];
    }
    return out;
  }

  /** 1 つの読みの判定 */
  function Matcher(reading) {
    this.reading = reading;
    this.units = units(reading);
    this.ui = 0;
    this.buf = '';
    this.typed = [];
  }

  Matcher.prototype.done = function () {
    return this.ui >= this.units.length;
  };

  /** 1 文字打つ。受け付けたら true */
  Matcher.prototype.input = function (ch) {
    for (var attempt = 0; attempt < 2; attempt++) {
      var u = this.units[this.ui];
      if (!u) return false;
      var next = this.buf + ch;
      var cand = u.opts.filter(function (o) { return o.indexOf(next) === 0; });
      if (cand.length) {
        this.buf = next;
        var exact = cand.indexOf(next) >= 0;
        var longer = cand.some(function (o) { return o.length > next.length; });
        if (exact && !longer) this.finishUnit();
        return true;
      }
      // 「n」のように、打ち終わっているが続きもありうる単位は、ここで確定して次の単位で打ち直す
      if (this.buf && u.opts.indexOf(this.buf) >= 0) {
        this.finishUnit();
        continue;
      }
      return false;
    }
    return false;
  };

  Matcher.prototype.finishUnit = function () {
    this.typed.push(this.buf);
    this.ui++;
    this.buf = '';
  };

  /** ガイドの表示：打ったところと、これから打つところ（いちばん使う書き方） */
  Matcher.prototype.guide = function () {
    var done = this.typed.join('') + this.buf;
    var rest = '';
    var self = this;
    this.units.forEach(function (u, i) {
      if (i < self.ui) return;
      if (i === self.ui) {
        var b = self.buf;
        var c = u.opts.filter(function (o) { return o.indexOf(b) === 0; })[0] || u.opts[0];
        rest += c.slice(b.length);
      } else {
        rest += u.opts[0];
      }
    });
    // 打ったかなの数（読みの色を変える位置）
    var kana = 0;
    for (var i = 0; i < this.ui; i++) kana += this.units[i].kana.length;
    return { done: done, rest: rest, kana: kana };
  };

  /** 読みが 2 通りある言葉は、どちらで打っても正解にする */
  function Word(readings) {
    this.ms = readings.map(function (r) { return new Matcher(r); });
  }
  Word.prototype.input = function (ch) {
    var ok = this.ms.filter(function (m) {
      var copy = Object.create(Matcher.prototype);
      copy.reading = m.reading; copy.units = m.units; copy.ui = m.ui; copy.buf = m.buf; copy.typed = m.typed.slice();
      return copy.input(ch);
    });
    if (!ok.length) return false;
    this.ms = this.ms.filter(function (m) { return ok.some(function (o) { return o.reading === m.reading; }); });
    this.ms.forEach(function (m) { m.input(ch); });
    return true;
  };
  Word.prototype.done = function () {
    return this.ms.some(function (m) { return m.done(); });
  };
  Word.prototype.current = function () {
    return this.ms[0];
  };

  window.Romaji = { Word: Word, units: units };
})();
