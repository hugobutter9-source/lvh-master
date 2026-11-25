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
  AOS.views.portal = function () {
    const canSet = AOS.can(me.role, 'parametres', 'u');
    return AOS.header({ eyebrow: 'Agence', title: 'Creator Portal <span class="soft">· la production de contenu.</span>',
      actions: `<a class="btn" href="${to('/overview')}" ${link}>${ic('ext', 15)}Ouvrir le portal</a><a class="btn pri" href="${to('/requests/new')}" ${link}>${ic('plus', 15)}Créer un contenu</a>` }) +
    `<div class="pt-pages">${PAGES.map(q => `<a class="card pt-page" href="${to(q.p)}" ${link}><span class="row-between"><span class="pt-ic">${ic(q.i, 18)}</span>${ic('ext', 14)}</span><b>${q.l}</b><small>${q.s}</small></a>`).join('')}</div>
    <p class="faint hint">Chaque carte ouvre le portal sur la bonne page, dans un nouvel onglet. Les chiffres du portal (à produire, à valider, en retard) arriveront ici quand les données seront reliées.</p>
    ${canSet ? `<details class="pt-set"><summary>Adresse du portal : <span class="mono">${esc(host())}</span></summary>
      <form class="pt-url" id="portalUrlForm"><input class="input" name="u" type="url" value="${esc(AOS.portalUrl())}" placeholder="${esc(AOS.PORTAL_DEFAULT)}" aria-label="Adresse du portal"><button class="btn sm">Enregistrer</button></form>
      <p class="faint small">À changer seulement si le portal déménage (nouveau domaine).</p></details>` : ''}`;
  };
  document.addEventListener('submit', async e => {
    const f = e.target; if (f.id !== 'portalUrlForm') return; e.preventDefault();
    const u = clean(f.u.value);
    if (!u) { toast("Adresse invalide : elle doit commencer par https://", 'bad'); f.u.focus(); return; }
    if (await AOS.setDoc('settings/agency', { ...S.settings, portalUrl: u }, 'settings')) toast('Adresse du portal enregistrée');
  });

  /* dashboard: one line of shortcuts */
  AOS.portalBox = function () {
    if (!AOS.modOn('portal')) return '';
    return `<section class="card pt-strip"><span class="lbl">${AOS.dot('var(--violet)')}Creator Portal</span>
      ${AOS.PORTAL_QUICK.map(q => `<a class="btn sm" href="${to(q.p)}" ${link} title="${q.s}">${ic(q.i, 14)}${q.l}</a>`).join('')}
      <button class="linkbtn" data-nav="portal">Tout voir</button></section>`;
  };
})();
