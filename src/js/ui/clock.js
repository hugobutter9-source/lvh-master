/* Agency OS — dashboard welcome: greeting above a flip clock (hours : minutes, local time zone),
   a one-line status of the day and the date. Each card flips when its value changes. */
(function (g) {
  const AOS = g.AOS, { esc, ic } = AOS;
  const card = id => `<div class="flip" id="${id}"><span class="fl fl-u"></span><span class="fl fl-l"></span><i class="hinge l"></i><i class="hinge r"></i></div>`;
  const zone = () => { try { return (new Intl.DateTimeFormat('fr-FR', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName') || {}).value || ''; } catch (e) { return ''; } };

  /* the clock alone (two cards), for a page that lays out its own greeting */
  AOS.clockCards = () => `<div class="flipclock" role="timer" aria-live="off" aria-label="Heure"><span id="flipTxt" class="sr"></span>${card('flipH')}<span class="fc-colon" aria-hidden="true"><i></i><i></i></span>${card('flipM')}<span class="fc-zone" id="flipZ">${esc(zone())}</span></div>`;
  AOS.clockHtml = function ({ title, mood, date }) {
    return `<section class="welcome" aria-label="Accueil">
      <div class="wc-act"><button class="iconbtn" data-nav="param-apparence" title="Modifier l'horloge" aria-label="Modifier l'horloge">${ic('pen', 16)}</button></div>
      <h1 class="wc-hi">${title}</h1>
      <div class="flipclock" role="timer" aria-live="off" aria-label="Heure"><span id="flipTxt" class="sr"></span>
        ${card('flipH')}<span class="fc-colon" aria-hidden="true"><i></i><i></i></span>${card('flipM')}<span class="fc-zone" id="flipZ">${esc(zone())}</span></div>
      <button class="wc-mood" data-nav="taches"><span class="wc-dot" style="background:${mood.c}"></span>${esc(mood.t)}</button>
      <div class="wc-date">${esc(date)}</div></section>`;
  };

  /* classic split-flap: upper half shows the new value, lower half the old one until the two leaves have turned */
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
  function tick() {
    const d = new Date(), H = String(d.getHours()).padStart(2, '0'), M = String(d.getMinutes()).padStart(2, '0');
    const reduce = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setCard(document.getElementById('flipH'), H, !reduce); setCard(document.getElementById('flipM'), M, !reduce);
    const t = document.getElementById('flipTxt'); if (t && t.textContent !== H + ':' + M) t.textContent = H + ':' + M;
  }
  AOS.clockTick = tick;
  let timer = null;
  AOS.startClock = function () {
    tick(); if (timer) return;
    timer = setInterval(() => { if (document.getElementById('flipH')) tick(); }, 1000);
  };
})(window);
