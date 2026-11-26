/* Home-page clock, in several styles (chosen in Paramètres > Apparence, per device):
   two-digit cards (bubbles, split-flap, plain digits, neon), a digital readout with seconds, hands,
   a ring that fills with the day, the time in words, or a small pill. One timer drives whichever is shown. */
(function (g) {
  const AOS = g.AOS, { esc } = AOS;
  const STYLES = [['bulles', 'Bulles'], ['palettes', 'Palettes'], ['chiffres', 'Chiffres'], ['neon', 'Néon'], ['digitale', 'Digitale'],
    ['aiguilles', 'Aiguilles'], ['anneau', 'Anneau'], ['lettres', 'En lettres'], ['discrete', 'Discrète']];
  const CARDS = ['bulles', 'palettes', 'chiffres', 'neon'];
  AOS.CLOCK_STYLES = STYLES;
  /* no choice yet: the clock follows the look of the app */
  AOS.clockStyle = () => { const s = (AOS.S.prefs || {}).clockStyle; return STYLES.some(x => x[0] === s) ? s : (document.documentElement.dataset.style === 'flat' ? 'chiffres' : 'bulles'); };

  const two = n => String(n).padStart(2, '0');
  const zone = () => { try { return (new Intl.DateTimeFormat('fr-FR', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName') || {}).value || ''; } catch (e) { return ''; } };
  /* the time in French words: "vingt et une heures dix-huit", "midi", "minuit cinq" */
  const U = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const T = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante' };
  const word = n => n < 20 ? U[n] : n % 10 === 0 ? T[Math.floor(n / 10)] : n % 10 === 1 ? T[Math.floor(n / 10)] + ' et une' : T[Math.floor(n / 10)] + '-' + U[n % 10];
  AOS.timeWords = (h, m) => (h === 0 ? 'minuit' : h === 12 ? 'midi' : `${word(h)} heure${h > 1 ? 's' : ''}`) + (m ? ' ' + word(m) : '');

  const card = (id, v) => `<div class="flip" ${id ? `id="${id}"` : ''}><span class="fl fl-u">${v}</span><span class="fl fl-l">${v}</span><i class="hinge l"></i><i class="hinge r"></i></div>`;
  const hands = (h, m, s) => [(h % 12) * 30 + m / 2, m * 6 + s / 10, s * 6];
  const dayPct = (h, m) => Math.round((h * 60 + m) / 1440 * 100);

  /* one clock. `at` = a fixed time for a preview (no ids, never updated); without it, the live clock. */
  function build(style, at) {
    const live = !at, d = at || new Date(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds(), H = two(h), M = two(m);
    const id = k => live ? `id="${k}"` : '';
    if (CARDS.includes(style)) return `<div class="flipclock cs-${style}" ${live ? 'role="timer" aria-live="off" aria-label="Heure"' : 'aria-hidden="true"'}>${live ? '<span id="flipTxt" class="sr"></span>' : ''}${card(live ? 'flipH' : '', live ? '' : H)}<span class="fc-colon" aria-hidden="true"><i></i><i></i></span>${card(live ? 'flipM' : '', live ? '' : M)}${live ? `<span class="fc-zone" id="flipZ">${esc(zone())}</span>` : ''}</div>`;
    const a = live ? 'role="timer" aria-live="off" aria-label="Heure"' : 'aria-hidden="true"';
    if (style === 'digitale') return `<div class="ck ck-digi" ${a}><span ${id('ckT')}>${H}:${M}</span><small ${id('ckS')}>${two(s)}</small></div>`;
    if (style === 'discrete') return `<div class="ck ck-pill" ${a}><span ${id('ckT')}>${H}:${M}</span></div>`;
    if (style === 'lettres') return `<div class="ck ck-words" ${a}><span ${id('ckW')}>${esc(AOS.timeWords(h, m))}</span></div>`;
    if (style === 'anneau') { const p = dayPct(h, m); return `<div class="ck ck-ring" ${a}><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="r-bg" cx="50" cy="50" r="44"/><circle class="r-fg" ${id('ckArc')} cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${p} 100"/></svg><span class="ck-ring-t"><b ${id('ckT')}>${H}:${M}</b><small ${id('ckP')}>${p} % du jour</small></span></div>`; }
    if (style === 'aiguilles') { const [a1, a2, a3] = hands(h, m, s);
      return `<div class="ck ck-analog" ${a}><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ca-face" cx="50" cy="50" r="47"/>${Array.from({ length: 12 }, (_, i) => `<line class="ca-tick ${i % 3 ? '' : 'q'}" x1="50" y1="${i % 3 ? 8 : 7}" x2="50" y2="${i % 3 ? 11 : 13}" transform="rotate(${i * 30} 50 50)"/>`).join('')}
        <line class="ca-h" ${id('ckHh')} x1="50" y1="50" x2="50" y2="27" transform="rotate(${a1} 50 50)"/><line class="ca-m" ${id('ckMh')} x1="50" y1="50" x2="50" y2="15" transform="rotate(${a2} 50 50)"/><line class="ca-s" ${id('ckSh')} x1="50" y1="56" x2="50" y2="12" transform="rotate(${a3} 50 50)"/><circle class="ca-pin" cx="50" cy="50" r="2.6"/></svg><span ${id('ckT')} class="sr">${H}:${M}</span></div>`; }
    return '';
  }
  AOS.clockCards = () => build(AOS.clockStyle());
  /* a small still clock for the style picker, always showing 10:08 */
  AOS.clockPreview = style => build(style, new Date(2024, 0, 1, 10, 8, 36));
  AOS.clockHtml = AOS.clockCards;   // kept for callers that only test that a clock exists

  /* split-flap: the upper half shows the new value, the lower half the old one until the two leaves have turned */
  function setCard(el, v, animate) {
    if (!el || el.dataset.v === v) return;
    const old = el.dataset.v; el.dataset.v = v;
    const u = el.querySelector('.fl-u'), l = el.querySelector('.fl-l');
    el.querySelectorAll('.leaf').forEach(x => x.remove());
    u.textContent = v;
    if (!animate || old === undefined) { l.textContent = v; return; }
    l.textContent = old;
    const a = document.createElement('span'); a.className = 'fl leaf leaf-u'; a.textContent = old;
    const b = document.createElement('span'); b.className = 'fl leaf leaf-l'; b.textContent = v;
    el.append(a, b);
    b.addEventListener('animationend', () => { l.textContent = v; a.remove(); b.remove(); }, { once: true });
  }
  const $ = k => document.getElementById(k);
  const put = (k, v) => { const el = $(k); if (el && el.textContent !== v) el.textContent = v; };
  function tick() {
    const d = new Date(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds(), H = two(h), M = two(m);
    const flap = $('flipH') && $('flipH').closest('.cs-palettes') && !(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setCard($('flipH'), H, flap); setCard($('flipM'), M, flap);
    put('flipTxt', H + ':' + M); put('ckT', H + ':' + M); put('ckS', two(s)); put('ckW', AOS.timeWords(h, m)); put('ckP', dayPct(h, m) + ' % du jour');
    const arc = $('ckArc'); if (arc) arc.setAttribute('stroke-dasharray', dayPct(h, m) + ' 100');
    if ($('ckHh')) { const [a1, a2, a3] = hands(h, m, s); $('ckHh').setAttribute('transform', `rotate(${a1} 50 50)`); $('ckMh').setAttribute('transform', `rotate(${a2} 50 50)`); $('ckSh').setAttribute('transform', `rotate(${a3} 50 50)`); }
  }
  AOS.clockTick = tick;
  let timer = null;
  AOS.startClock = function () {
    tick(); if (timer) return;
    timer = setInterval(() => { if (document.querySelector('#view .flipclock, #view .ck')) tick(); }, 1000);
  };
})(window);
