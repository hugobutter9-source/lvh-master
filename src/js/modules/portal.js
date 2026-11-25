/* Creator Portal — direct access to the content-production portal from the CRM.
   Step 1 (this file): one click to every page of the portal. Nothing is simulated: the figures of the
   portal are not read yet. Step 2 will read them from the portal's database. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, toast } = AOS;
  const S = AOS.S, me = AOS.me;

  AOS.PORTAL_DEFAULT = 'https://lvhcontentmanager.netlify.app';
  const clean = u => { u = String(u || '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };
  AOS.portalUrl = () => clean(S.settings.portalUrl) || AOS.PORTAL_DEFAULT;
  const to = path => esc(AOS.portalUrl() + path);
  const host = () => AOS.portalUrl().replace(/^https?:\/\//i, '');
  const link = 'target="_blank" rel="noopener"';

  /* the four things done most often in the portal */
  AOS.PORTAL_QUICK = [
    { p: '/requests/new', i: 'plus', l: 'Créer un contenu', s: 'Un brief en 30 secondes' },
    { p: '/requests', i: 'ok', l: 'Valider les envois', s: 'Vidéos et photos reçues' },
    { p: '/library', i: 'sparkles', l: 'Trouver des idées', s: 'Suggestions et bibliothèque' },
    { p: '/messages', i: 'script', l: 'Répondre aux modèles', s: 'Messagerie du portal' }];
  const PAGES = [
    { p: '/overview', i: 'home', l: "Vue d'ensemble", s: 'Les chiffres de la semaine et ce qui attend une action.' },
    { p: '/creators', i: 'users', l: 'Modèles', s: 'Chaque modèle, son objectif de la semaine et son activité.' },
    { p: '/requests', i: 'film', l: 'Demandes de contenu', s: 'Les briefs à produire, à valider ou à corriger.' },
    { p: '/library', i: 'sparkles', l: "Bibliothèque d'inspiration", s: 'Références Instagram et TikTok, idées prêtes à lancer.' },
    { p: '/calendar', i: 'cal', l: 'Calendrier éditorial', s: 'Ce qui sort, et quand.' },
    { p: '/media', i: 'image', l: 'Médiathèque', s: 'Toutes les vidéos et photos envoyées.' },
    { p: '/messages', i: 'script', l: 'Messages', s: 'Les conversations avec les modèles.' },
    { p: '/analytics', i: 'chart', l: 'Statistiques', s: 'Production livrée et approuvée dans le temps.' },
    { p: '/assistant', i: 'zap', l: 'Assistant IA', s: 'Idées et briefs générés.' }];
  const LATER = ['Modèles actives', 'À produire', 'À valider', 'Approuvés cette semaine', 'En retard'];

  AOS.views.portal = function () {
    const canSet = AOS.can(me.role, 'parametres', 'u');
    return AOS.header({ eyebrow: 'Agence', title: 'Creator Portal <span class="soft">· la production de contenu.</span>',
      actions: `<a class="btn pri" href="${to('/overview')}" ${link}>${ic('ext', 15)}Ouvrir le portal</a>` }) +
    `<div class="pt-quick">${AOS.PORTAL_QUICK.map((q, n) => `<a class="card pt-qa ${n ? '' : 'first'}" href="${to(q.p)}" ${link}><span class="pt-ic">${ic(q.i, 18)}</span><span class="grow"><b>${q.l}</b><small>${q.s}</small></span>${ic('ext', 14)}</a>`).join('')}</div>
    <section class="card box"><div class="box-h"><span class="lbl">${AOS.dot('var(--faint)')}Chiffres du portal</span><span class="pill" style="--c:var(--warn)">Pas encore relié</span></div>
      <div class="pt-later">${LATER.map(l => `<div><b>—</b><span>${l}</span></div>`).join('')}</div>
      <p class="pad-x muted small">Ces chiffres vivent dans le portal. Ils s'afficheront ici, et sur le dashboard, à l'étape suivante : la liaison des données. Pour l'instant chaque bouton ouvre le portal sur la bonne page.</p></section>
    <h2 class="sh">Toutes les pages</h2>
    <div class="pt-pages">${PAGES.map(q => `<a class="card pt-page" href="${to(q.p)}" ${link}><span class="pt-ic">${ic(q.i, 18)}</span><b>${q.l}</b><small>${q.s}</small></a>`).join('')}</div>
    <section class="card pad stack tight"><div class="row-between"><b>Adresse du portal</b><a class="linkbtn mono small" href="${to('')}" ${link}>${esc(host())}</a></div>
      ${canSet ? `<form class="pt-url" id="portalUrlForm"><input class="input" name="u" type="url" value="${esc(AOS.portalUrl())}" placeholder="${esc(AOS.PORTAL_DEFAULT)}" aria-label="Adresse du portal"><button class="btn sm">Enregistrer</button></form>
      <p class="faint small" style="margin:0">À changer seulement si le portal déménage (nouveau domaine).</p>` : ''}</section>`;
  };
  document.addEventListener('submit', async e => {
    const f = e.target; if (f.id !== 'portalUrlForm') return; e.preventDefault();
    const u = clean(f.u.value);
    if (!u) { toast("Adresse invalide : elle doit commencer par https://", 'bad'); f.u.focus(); return; }
    if (await AOS.setDoc('settings/agency', { ...S.settings, portalUrl: u }, 'settings')) toast('Adresse du portal enregistrée');
  });

  /* dashboard block */
  AOS.portalBox = function () {
    if (!AOS.modOn('portal')) return '';
    return `<section class="card box"><div class="box-h"><span class="lbl">${AOS.dot('var(--violet)')}Creator Portal</span><button class="linkbtn" data-nav="portal">Tout voir</button></div>
      ${AOS.PORTAL_QUICK.map(q => `<a class="line" href="${to(q.p)}" ${link}><span class="pt-ic sm">${ic(q.i, 15)}</span><span class="what"><span class="ttl">${q.l}</span><span class="sub">${q.s}</span></span>${ic('ext', 15)}</a>`).join('')}</section>`;
  };
})();
