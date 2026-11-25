/* Agency OS — appearance engine (per person, saved in their preferences) and the Apparence page. */
(function (g) {
  const AOS = g.AOS;
  const { esc, ic, toast } = AOS;
  const S = AOS.S;

  const COLORS = { white: '#f4f6f8', pink: '#f472b6', violet: '#a78bfa', blue: '#5b9cf6', cyan: '#22c8dc', green: '#34d399', yellow: '#fbbf24', orange: '#fb923c', red: '#f87171' };
  const LEGACY = { teal: 'green', sky: 'blue', rose: 'pink' };
  const BGS = {
    black: { l: 'Noir', bg: '#040506', bg2: '#08090b', panel: '#0e0f12', panel2: '#15171b' },
    graphite: { l: 'Graphite', bg: '#0b0d10', bg2: '#101318', panel: '#14181e', panel2: '#1b2027' },
    night: { l: 'Bleu nuit', bg: '#060a14', bg2: '#0a1020', panel: '#0f172a', panel2: '#162036' },
    aubergine: { l: 'Aubergine', bg: '#0d0710', bg2: '#140b19', panel: '#1a1020', panel2: '#23162b' },
    forest: { l: 'Forêt', bg: '#050c09', bg2: '#08130e', panel: '#0d1914', panel2: '#14231c' }
  };
  const AMB = { neon: ['Néon', ['#f472b6', '#a78bfa', '#22d3ee']], ocean: ['Océan', ['#3b82f6', '#22c8dc', '#6366f1']], sunset: ['Sunset', ['#fb923c', '#f472b6', '#facc15']],
    gold: ['Or', ['#fbbf24', '#f59e0b', '#fde68a']], forest: ['Forêt', ['#34d399', '#14b8a6', '#a3e635']], white: ['Blanc', ['#ffffff', '#cbd5e1', '#94a3b8']] };
  const FONTS = ['Geist', 'Inter', 'DM Sans', 'Manrope', 'Poppins', 'Space Grotesk', 'Outfit', 'Sora'];
  const THEMES = {
    neon: { l: 'Néon', accent: 'pink', badge: 'violet', bg: 'aubergine', amb: 'neon', ambI: 55 },
    ocean: { l: 'Océan', accent: 'blue', badge: 'cyan', bg: 'night', amb: 'ocean', ambI: 50 },
    sunset: { l: 'Sunset', accent: 'orange', badge: 'pink', bg: 'graphite', amb: 'sunset', ambI: 50 },
    gold: { l: 'Or et noir', accent: 'yellow', badge: 'yellow', bg: 'black', amb: 'gold', ambI: 40 },
    forest: { l: 'Forêt', accent: 'green', badge: 'green', bg: 'forest', amb: 'forest', ambI: 45 },
    minimal: { l: 'Minimal', accent: 'white', badge: 'white', bg: 'graphite', amb: 'white', ambI: 12, glass: 'none' },
    cyan: { l: 'Agency (défaut)', accent: 'cyan', badge: 'cyan', bg: 'graphite', amb: 'ocean', ambI: 35 }
  };
  const DEF = { theme: 'system', accent: 'cyan', badge: 'cyan', bg: 'graphite', amb: 'ocean', ambI: 35, ambMove: true, ambCustom: ['#22c8dc', '#a78bfa', '#f472b6'], clock: true, dense: false, sideMini: false, glass: 'normal', corners: 'round2', size: 'normal', font: 'Geist', appName: '', logo: '' };
  AOS.APPEARANCE = { COLORS, BGS, AMB, FONTS, THEMES, DEF };
  const P = () => ({ ...DEF, ...(S.prefs || {}) });
  const hex = v => COLORS[LEGACY[v] || v] || (/^#[0-9a-f]{6}$/i.test(v || '') ? v : COLORS.cyan);
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lum = h => { const [r, gg, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * gg + .0722 * b; };
  const mix = (h, k, t) => '#' + rgb(h).map((v, i) => Math.round(v * (1 - t) + rgb(k)[i] * t).toString(16).padStart(2, '0')).join('');
  AOS.colorTools = { hex, lum, mix };

  let fontLoaded = {};
  function loadFont(f) {
    if (f === 'Geist' || fontLoaded[f]) return; fontLoaded[f] = 1;
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }
  const mq = g.matchMedia ? g.matchMedia('(prefers-color-scheme: light)') : null;
  AOS.applyAppearance = function () {
    const p = P(), root = document.documentElement, st = root.style;
    if (p.theme === 'dark' || p.theme === 'light') { root.dataset.theme = p.theme; root.dataset.ownTheme = '1'; }
    else if (root.dataset.ownTheme) { delete root.dataset.theme; delete root.dataset.ownTheme; }
    const light = root.dataset.theme ? root.dataset.theme === 'light' : !!(mq && mq.matches);
    /* colours: buttons and badges; a light accent gets dark ink, and is darkened on a light background */
    let a = hex(p.accent), b = hex(p.badge);
    if (light) { if (lum(a) > .35) a = mix(a, '#000000', lum(a) > .8 ? .78 : .38); if (lum(b) > .35) b = mix(b, '#000000', lum(b) > .8 ? .78 : .38); }
    st.setProperty('--accent', a); st.setProperty('--accent-ink', lum(a) > .45 ? '#0a0c0f' : '#ffffff');
    st.setProperty('--badge', b); st.setProperty('--badge-ink', lum(b) > .45 ? '#0a0c0f' : '#ffffff');
    st.setProperty('--glow', light ? 'transparent' : a + '17');
    /* background (dark mode only: light mode keeps its own neutrals) */
    const B = BGS[p.bg] || BGS.graphite;
    for (const [k, v] of [['--bg', B.bg], ['--bg-2', B.bg2], ['--panel', B.panel], ['--panel-2', B.panel2]]) light ? st.removeProperty(k) : st.setProperty(k, v);
    /* glass */
    const G = { none: [1, 0], light: [.9, 8], normal: [.76, 16], strong: [.58, 26] }[p.glass] || [.76, 16];
    st.setProperty('--card-a', String(G[0])); st.setProperty('--blur', G[1] + 'px');
    /* corners */
    const R = { square: [8, 6], round: [16, 10], round2: [24, 12] }[p.corners] || [24, 12];
    st.setProperty('--r', R[0] + 'px'); st.setProperty('--r-s', R[1] + 'px'); st.setProperty('--r-btn', p.corners === 'square' ? '8px' : '999px');
    /* text */
    loadFont(p.font); st.setProperty('--f-ui', `"${p.font}",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif`);
    st.zoom = { small: .92, normal: 1, large: 1.08, xlarge: 1.17 }[p.size] || 1;
    root.classList.toggle('dense', !!p.dense);
    /* ambient light */
    const cols = p.amb === 'custom' ? p.ambCustom : (AMB[p.amb] || AMB.ocean)[1];
    cols.forEach((c, i) => st.setProperty('--amb' + (i + 1), hex(c)));
    st.setProperty('--amb-o', String((light ? .45 : 1) * Math.max(0, Math.min(100, +p.ambI)) / 100));
    root.classList.toggle('amb-move', !!p.ambMove);
  };
  if (mq && mq.addEventListener) mq.addEventListener('change', () => AOS.applyAppearance());
  AOS.appName = () => P().appName || 'LVH Master';
  AOS.logoText = () => (P().logo || AOS.ini(S.settings.name || 'AO')).slice(0, 3);
  /* the app mark (same drawing as brand/logo.svg); custom logo letters replace it */
  const MARK = '<svg viewBox="0 0 512 512" aria-hidden="true"><defs><linearGradient id="lgm" x1="150" y1="150" x2="362" y2="380" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5eead4"/><stop offset=".5" stop-color="#22c8dc"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="#0c1016"/><path d="M164 378 L256 146 L348 378" fill="none" stroke="url(#lgm)" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="256" cy="304" rx="104" ry="30" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="12" transform="rotate(-14 256 304)"/><circle cx="256" cy="304" r="17" fill="#fff"/></svg>';
  AOS.logoHtml = () => P().logo ? `<span class="logo">${esc(P().logo.slice(0, 3))}</span>` : `<span class="logo mark">${MARK}</span>`;

  /* ---------- Apparence page ---------- */
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(P()[k]) === String(v) ? 'on' : ''}" data-a="ap" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
  const swatches = k => `<div class="sw-row">${Object.entries(COLORS).map(([n, c]) => `<button class="sw ${P()[k] === n || LEGACY[P()[k]] === n ? 'on' : ''}" style="--c:${c}" data-a="ap" data-k="${k}" data-v="${n}" aria-label="${n}"></button>`).join('')}
    <label class="sw custom ${/^#/.test(P()[k]) ? 'on' : ''}" title="Couleur libre" style="--c:${/^#/.test(P()[k]) ? P()[k] : 'transparent'}"><input type="color" data-ap="${k}" value="${hex(P()[k])}" aria-label="Couleur libre"></label></div>`;
  AOS.views['param-apparence'] = function () {
    const p = P();
    const tile = ([k, t]) => { const am = AMB[t.amb][1], bg = BGS[t.bg]; return `<button class="theme-tile" data-a="aptheme" data-v="${k}"><span class="tt-prev" style="background:radial-gradient(120% 90% at 0% 0%,${am[0]}88,transparent 60%),radial-gradient(120% 90% at 100% 100%,${am[1]}77,transparent 60%),${bg.panel}">
      <i class="tt-bar"></i><i class="tt-btn" style="background:${hex(t.accent)}"></i></span><span>${esc(t.l)}</span></button>`; };
    return AOS.header({ eyebrow: `Apparence · ${AOS.db() && AOS.me.uid ? 'enregistrée sur ton compte, sur tous tes appareils' : 'enregistrée sur cet appareil'}`, title: 'Personnaliser', actions: '<button class="btn" data-a="apreset">Tout réinitialiser</button>' }) +
    `<section class="card pad"><div class="box-h"><h3>Thèmes prêts</h3><span class="faint small">un clic pour l'essayer, tout reste modifiable</span></div><div class="themes">${Object.entries(THEMES).map(tile).join('')}</div></section>
    <div class="grid g2 top">
      <section class="card pad stack"><h3 class="h3">Couleurs</h3>
        <div class="stack tight"><span class="muted small">Boutons principaux</span>${swatches('accent')}</div>
        <div class="stack tight"><span class="muted small">Pastilles et compteurs</span>${swatches('badge')}</div>
        <div class="stack tight"><span class="muted small">Fond (mode sombre)</span>${seg('bg', Object.entries(BGS).map(([k, b]) => [k, b.l]))}</div>
        <div class="stack tight"><span class="muted small">Mode</span>${seg('theme', [['system', 'Système'], ['dark', 'Sombre'], ['light', 'Clair']])}</div></section>
      <section class="card pad stack"><h3 class="h3">Lumière d'ambiance</h3>
        <div class="stack tight"><span class="muted small">Couleurs</span><div class="chips amb">${Object.entries(AMB).map(([k, [l, c]]) => `<button class="chip ${p.amb === k ? 'on' : ''}" data-a="ap" data-k="amb" data-v="${k}"><i class="amb-sw" style="background:linear-gradient(90deg,${c[0]},${c[1]})"></i>${l}</button>`).join('')}<button class="chip ${p.amb === 'custom' ? 'on' : ''}" data-a="ap" data-k="amb" data-v="custom">Les miennes</button></div></div>
        ${p.amb === 'custom' ? `<div class="stack tight"><span class="muted small">Mes 3 couleurs</span><div class="sw-row">${[0, 1, 2].map(i => `<label class="sw custom on" style="--c:${p.ambCustom[i]}"><input type="color" data-apc="${i}" value="${hex(p.ambCustom[i])}" aria-label="Couleur ${i + 1}"></label>`).join('')}</div></div>` : ''}
        <div class="stack tight"><span class="row-between"><span class="muted small">Intensité</span><b class="mono" id="ambIv">${p.ambI} %</b></span><input type="range" id="ambI" min="0" max="100" step="5" value="${p.ambI}" class="range" aria-label="Intensité de la lumière"></div>
        <div class="stack tight"><span class="muted small">Mouvement de la lumière</span>${seg('ambMove', [['true', 'Activé'], ['false', 'Désactivé']])}</div></section>
      <section class="card pad stack"><h3 class="h3">Forme et texte</h3>
        <div class="stack tight"><span class="muted small">Effet verre</span>${seg('glass', [['none', 'Aucun'], ['light', 'Léger'], ['normal', 'Normal'], ['strong', 'Fort']])}</div>
        <div class="stack tight"><span class="muted small">Coins</span>${seg('corners', [['square', 'Carrés'], ['round', 'Arrondis'], ['round2', 'Très ronds']])}</div>
        <div class="stack tight"><span class="muted small">Taille du contenu</span>${seg('size', [['small', 'Petite'], ['normal', 'Normale'], ['large', 'Grande'], ['xlarge', 'Très grande']])}</div>
        <div class="stack tight"><span class="muted small">Densité</span>${seg('dense', [['false', 'Confortable'], ['true', 'Compacte']])}</div>
        <div class="stack tight"><span class="muted small">Police</span><div class="fonts">${FONTS.map(f => `<button class="fontbtn ${p.font === f ? 'on' : ''}" style="font-family:'${f}',system-ui" data-a="apfont" data-v="${f}">${f}</button>`).join('')}</div></div></section>
      <div class="stack">
        <section class="card pad stack"><h3 class="h3">Nom et logo</h3>
          <div class="form2"><div class="fld"><label for="apName">Nom de l'app</label><input id="apName" value="${esc(p.appName)}" placeholder="LVH Master" maxlength="30"></div>
          <div class="fld"><label for="apLogo">Lettres du logo</label><input id="apLogo" value="${esc(p.logo)}" placeholder="${esc(AOS.ini(S.settings.name || 'AO'))}" maxlength="3"></div></div></section>
        <section class="card pad stack"><h3 class="h3">Horloge de l'accueil</h3><p class="muted small">L'horloge à palettes sous le « Bonjour » en haut du dashboard.</p>${seg('clock', [['true', 'Affichée'], ['false', 'Masquée']])}</section>
        <section class="card pad stack"><h3 class="h3">Barre latérale</h3>${seg('sideMini', [['false', 'Dépliée'], ['true', 'Repliée (icônes)']])}</section>
        <section class="card pad stack"><h3 class="h3">Couleurs des statuts</h3><p class="muted small">Statuts des créatrices, tâches, disponibilités, catégories de scripts… : nom et couleur dans Paramètres › Personnalisation.</p><div><button class="btn sm" data-nav="param-perso">Ouvrir Personnalisation</button></div></section>
      </div></div>`;
  };
  const val = v => v === 'true' ? true : v === 'false' ? false : v;
  Object.assign(AOS.act, {
    ap: el => AOS.savePrefs({ [el.dataset.k]: val(el.dataset.v) }),
    apfont: el => AOS.savePrefs({ font: el.dataset.v }),
    aptheme: el => { const { l, ...t } = THEMES[el.dataset.v]; AOS.savePrefs({ glass: DEF.glass, ...t }); toast(`Thème ${l} appliqué`); },
    apreset: async () => { if (!(await AOS.confirm({ title: 'Tout réinitialiser ?', body: 'Ton apparence revient aux réglages par défaut. Tes favoris et ton menu ne changent pas.', ok: 'Réinitialiser' }))) return; AOS.savePrefs({ ...DEF }); }
  });
  const nameT = {};
  AOS.afterRender['param-apparence'] = () => {
    const r = document.getElementById('ambI');
    if (r) { r.oninput = () => { document.documentElement.style.setProperty('--amb-o', String(r.value / 100)); document.getElementById('ambIv').textContent = r.value + ' %'; }; r.onchange = () => AOS.savePrefs({ ambI: +r.value }); }
    document.querySelectorAll('[data-ap]').forEach(i => { i.onchange = () => AOS.savePrefs({ [i.dataset.ap]: i.value }); });
    document.querySelectorAll('[data-apc]').forEach(i => { i.onchange = () => { const c = [...P().ambCustom]; c[+i.dataset.apc] = i.value; AOS.savePrefs({ ambCustom: c }); }; });
    for (const [id, k] of [['apName', 'appName'], ['apLogo', 'logo']]) { const i = document.getElementById(id); if (i) i.oninput = () => { clearTimeout(nameT[k]); nameT[k] = setTimeout(() => AOS.savePrefs({ [k]: i.value.trim() }), 500); }; }
  };
})(window);
