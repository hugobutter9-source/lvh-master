/* Creator Portal — the content-production portal seen from the CRM: one click to every page, and, once
   the person has signed in with their portal manager account, the requests sent to the models and what
   the models sent back. Nothing is simulated. */
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
  /* ---------- live link: the same account as the portal, read through its own access rules ----------
     Each person signs in on their own device with their portal manager account. What they may read is
     decided by the portal's database (a manager sees the whole agency), not by this page. */
  AOS.PORTAL_DB = { url: 'https://togzyxnopontjwjkxcod.supabase.co', key: 'sb_publishable_us2r8IWoBcu-LAbtVVSnSw_JF2WZW3L' };
  const CACHE = 'lvh.portal.cache', STALE = 60000;
  const PL = AOS.portalLink = { state: 'off', me: null, data: null, at: 0, busy: false, error: '', who: '' };
  let sb = null;
  function client() {
    if (sb) return sb;
    if (window.claude || !window.supabase || !window.supabase.createClient) return null;   // a preview frame cannot reach the portal
    try { sb = window.supabase.createClient(AOS.PORTAL_DB.url, AOS.PORTAL_DB.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'lvh.portal.auth' } }); } catch (e) { sb = null; }
    return sb;
  }
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { return null; } };
  const writeCache = v => { try { v ? localStorage.setItem(CACHE, JSON.stringify(v)) : localStorage.removeItem(CACHE); } catch (e) { } };
  const fail = e => (e && /fetch|network|load failed/i.test(e.message || '')) ? 'Connexion au portal impossible. Vérifie ta connexion internet.' : 'Le portal n\'a pas répondu correctement. Réessaie dans un instant.';

  async function load() {
    const c = client(); if (!c || PL.busy) return;
    PL.busy = true; PL.tried = Date.now();   // a failed refresh is not retried on every render
    try {
      const { data: ses } = await c.auth.getSession(), user = ses && ses.session && ses.session.user;
      if (!user) { PL.state = 'off'; PL.me = PL.data = null; writeCache(null); return; }
      const prof = await c.from('profiles').select('id, full_name, role, status').eq('id', user.id).single();
      if (prof.error) throw prof.error;
      if (prof.data.role !== 'manager' || prof.data.status !== 'active') { await c.auth.signOut(); PL.state = 'off'; PL.me = PL.data = null; writeCache(null); PL.error = 'Ce compte n\'est pas un compte manager du portal.'; return; }
      const [people, reqs, media] = await Promise.all([
        c.from('profiles').select('id, full_name, role, status').limit(500),
        c.from('content_requests').select('id, title, status, platform, deadline, creator_id, created_by, created_at, updated_at, submitted_at, approved_at').neq('status', 'archived').order('updated_at', { ascending: false }).limit(300),
        c.from('media_assets').select('id, request_id, creator_id, kind, review_state, created_at').eq('review_state', 'pending').order('created_at', { ascending: false }).limit(200)]);
      const err = people.error || reqs.error || media.error; if (err) throw err;
      PL.me = { id: prof.data.id, name: prof.data.full_name };
      PL.data = { people: people.data, requests: reqs.data, media: media.data };
      PL.at = Date.now(); PL.state = 'on'; PL.error = '';
      writeCache({ me: PL.me, data: PL.data, at: PL.at });
      if (AOS.syncKick) AOS.syncKick();
    } catch (e) { PL.error = fail(e); if (!PL.data) PL.state = 'error'; }
    finally { PL.busy = false; AOS.render(); }
  }
  AOS.portalRefresh = load;
  AOS.portalClient = client;
  /* called by the views: shows what is cached at once, refreshes in the background when it is old */
  function touch() {
    if (PL.state === 'off' && !PL.data && !PL.booted) {
      PL.booted = true; const c = readCache();
      if (c && c.data) { PL.me = c.me; PL.data = c.data; PL.at = c.at || 0; PL.state = 'on'; if (AOS.syncKick) setTimeout(AOS.syncKick, 0); }
      if (client()) setTimeout(load, 0);
    } else if (PL.state !== 'off' && Date.now() - Math.max(PL.at, PL.tried || 0) > STALE && !PL.busy && navigator.onLine !== false) setTimeout(load, 0);
  }

  AOS.portalTouch = touch;
  /* keep the figures fresh while the dashboard or the portal page is on screen, and when coming back to the app */
  const onScreen = () => document.visibilityState === 'visible' && ['dashboard', 'portal'].includes(AOS.currentView ? AOS.currentView() : '');
  setInterval(() => { if (onScreen()) touch(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (onScreen()) touch(); });
  window.addEventListener('online', () => { if (onScreen()) touch(); });

  const ST = { draft: ['Brouillon', 'faint'], todo: ['À faire', 'faint'], in_progress: ['En cours', 'info'], submitted: ['Reçu, à valider', 'violet'], in_review: ['En validation', 'violet'],
    revision_requested: ['À corriger', 'warn'], approved: ['Approuvé', 'ok'], scheduled: ['Planifié', 'info'], published: ['Publié', 'ok'], declined: ['Refusé', 'bad'] };
  const OPEN = ['todo', 'in_progress', 'revision_requested'], REVIEW = ['submitted', 'in_review'];
  const uuid = v => /^[0-9a-f-]{36}$/i.test(v || '') ? v : '';
  const dayOf = ts => ts ? AOS.iso(new Date(ts)) : '';
  /* figures computed from what the portal returned */
  AOS.portalFigures = function () {
    const d = PL.data; if (!d) return null;
    const now = Date.now(), name = id => { const p = d.people.find(x => x.id === id); return p ? p.full_name : ''; };
    const rs = d.requests.filter(r => r.status !== 'draft');
    const files = id => d.media.filter(m => m.request_id === id).length;
    return { name, files,
      review: rs.filter(r => REVIEW.includes(r.status)).sort((a, b) => String(a.submitted_at || a.updated_at).localeCompare(String(b.submitted_at || b.updated_at))),
      open: rs.filter(r => OPEN.includes(r.status)),
      late: rs.filter(r => OPEN.includes(r.status) && r.deadline && new Date(r.deadline).getTime() < now),
      approved7: rs.filter(r => r.approved_at && now - new Date(r.approved_at).getTime() < 7 * 864e5),
      models: d.people.filter(p => p.role === 'creator' && p.status === 'active').length,
      senders: [...new Set(rs.map(r => r.created_by).filter(Boolean))].map(id => ({ id, name: name(id) || 'Ancien compte' })),
      sent: rs };
  };
  const reqLine = (r, F, kind) => {
    const [lab, col] = ST[r.status] || [r.status, 'faint'], late = OPEN.includes(r.status) && r.deadline && new Date(r.deadline).getTime() < Date.now();
    const when = kind === 'review' ? (r.submitted_at || r.updated_at) : r.created_at, n = F.files(r.id);
    const by = r.created_by ? (r.created_by === (PL.me && PL.me.id) ? 'toi' : F.name(r.created_by) || 'ancien compte') : '';
    return `<a class="line" href="${uuid(r.id) ? to('/requests/' + r.id) : to('/requests')}" ${link}><span class="when"><b>${+dayOf(when).slice(8) || '—'}</b><small>${esc(AOS.dShort(dayOf(when)).replace(/^\d+\s*/, ''))}</small></span>
      <span class="what"><span class="ttl">${esc(r.title)}</span><span class="sub">${[F.name(r.creator_id), by ? 'envoyé par ' + by : '', kind === 'review' && n ? `${n} fichier${n > 1 ? 's' : ''} à regarder` : '', kind !== 'review' && r.deadline ? `pour le ${AOS.dShort(dayOf(r.deadline))}` : ''].filter(Boolean).map(esc).join(' · ')}</span></span>
      ${late ? AOS.pill('En retard', 'var(--bad)') : AOS.pill(lab, AOS.col(col))}${ic('ext', 14)}</a>`;
  };

  AOS.views.portal = function () {
    touch();
    const canSet = AOS.can(me.role, 'parametres', 'u'), F = AOS.portalFigures(), on = PL.state === 'on' && F;
    const stat = (v, l, c) => `<div class="st"><b class="${c || ''}">${v}</b><span>${l}</span></div>`;
    const sent = on ? F.sent.filter(r => !PL.who || r.created_by === PL.who).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) : [];
    const live = on ? `
      <section class="card stats">${stat(F.review.length, 'à valider', F.review.length ? 'warn-t' : '')}${stat(F.open.length, 'en cours chez les modèles')}${stat(F.late.length, 'en retard', F.late.length ? 'bad-t' : '')}${stat(F.approved7.length, 'approuvés sur 7 jours')}</section>
      <section class="card box"><div class="box-h"><span class="lbl">${AOS.dot('var(--violet)')}Ce que les modèles ont renvoyé</span><span class="faint small">à valider dans le portal</span></div>
        ${F.review.length ? F.review.slice(0, 12).map(r => reqLine(r, F, 'review')).join('') : '<div class="box-empty"><p>Rien à valider pour l\'instant.</p></div>'}</section>
      <section class="card box"><div class="box-h"><span class="lbl">${AOS.dot('var(--info)')}Demandes envoyées</span>
          <div class="chips"><button class="chip ${!PL.who ? 'on' : ''}" data-a="portalwho" data-v="">Tous</button>${F.senders.map(p => `<button class="chip ${PL.who === p.id ? 'on' : ''}" data-a="portalwho" data-v="${esc(p.id)}">${esc(p.id === PL.me.id ? 'Moi' : p.name)}</button>`).join('')}</div></div>
        ${sent.length ? sent.slice(0, 15).map(r => reqLine(r, F, 'sent')).join('') : '<div class="box-empty"><p>Aucune demande envoyée.</p></div>'}
        ${sent.length > 15 ? `<a class="line add" href="${to('/requests')}" ${link}>${ic('ext', 15)}Voir les ${sent.length} demandes dans le portal</a>` : ''}</section>
      <p class="faint hint">${ic('ok', 13)} Connecté au portal en tant que <b>${esc(PL.me.name)}</b> · ${F.models} modèle${F.models > 1 ? 's' : ''} active${F.models > 1 ? 's' : ''} · actualisé à ${new Date(PL.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        · <button class="linkbtn" data-a="portalrefresh">${PL.busy ? 'Actualisation…' : 'Actualiser'}</button> · <button class="linkbtn" data-a="portallogout">Se déconnecter</button></p>
      ${PL.error ? `<div class="banner">${ic('clock', 15)}<span>${esc(PL.error)} Les chiffres affichés datent de la dernière actualisation.</span></div>` : ''}` : '';
    const login = !on ? (!client()
      ? `<div class="banner info">${ic('lock', 15)}<span>La liaison avec le portal n'est pas disponible dans cet aperçu. Elle fonctionne sur l'application en ligne.</span></div>`
      : `<section class="card pad stack"><div><h3 class="h3">Relie ton compte du portal</h3><p class="muted" style="margin:6px 0 0">Avec le même e-mail et le même mot de passe que sur le Creator Portal (compte manager). Tu verras ici les demandes envoyées aux modèles, par toi et par les autres managers, et ce qu'elles ont renvoyé.</p></div>
        <form id="portalLogin" class="pt-login"><input class="input" id="pl-email" name="email" type="email" autocomplete="username" placeholder="E-mail" required aria-label="E-mail">
          <input class="input" id="pl-pass" name="password" type="password" autocomplete="current-password" placeholder="Mot de passe" required aria-label="Mot de passe"><button class="btn pri" ${PL.busy ? 'disabled' : ''}>${PL.busy ? 'Connexion…' : 'Connecter'}</button></form>
        ${PL.error ? `<p class="bad-t small" style="margin:0" role="alert">${esc(PL.error)}</p>` : ''}
        <p class="faint small" style="margin:0">Ton mot de passe est envoyé directement au portal et n'est jamais enregistré dans LVH Master.</p></section>`) : '';
    return AOS.header({ eyebrow: 'Agence', title: 'Creator Portal <span class="soft">· la production de contenu.</span>',
      actions: `<a class="btn" href="${to('/overview')}" ${link}>${ic('ext', 15)}Ouvrir le portal</a><a class="btn pri" href="${to('/requests/new')}" ${link}>${ic('plus', 15)}Créer un contenu</a>` }) +
    `${live}${login}
    <h2 class="sh">Toutes les pages</h2>
    <div class="pt-pages">${PAGES.map(q => `<a class="card pt-page" href="${to(q.p)}" ${link}><span class="row-between"><span class="pt-ic">${ic(q.i, 18)}</span>${ic('ext', 14)}</span><b>${q.l}</b><small>${q.s}</small></a>`).join('')}</div>
    ${canSet ? `<details class="pt-set"><summary>Adresse du portal : <span class="mono">${esc(host())}</span></summary>
      <form class="pt-url" id="portalUrlForm"><input class="input" name="u" type="url" value="${esc(AOS.portalUrl())}" placeholder="${esc(AOS.PORTAL_DEFAULT)}" aria-label="Adresse du portal"><button class="btn sm">Enregistrer</button></form>
      <p class="faint small">À changer seulement si le portal déménage (nouveau domaine).</p></details>` : ''}`;
  };
  Object.assign(AOS.act, {
    portalrefresh: () => { if (!PL.busy) { load(); AOS.render(); } },
    portalwho: el => { PL.who = el.dataset.v; AOS.render(); },
    portallogout: async () => { const c = client(); try { if (c) await c.auth.signOut(); } catch (e) { } PL.state = 'off'; PL.me = PL.data = null; PL.error = ''; writeCache(null); if (AOS.syncStop) AOS.syncStop(); AOS.render(); toast('Déconnecté'); }
  });
  AOS.portalSignIn = async function (email, password) {
    const c = client(); if (!c || PL.busy) return false;
    PL.busy = true; PL.error = ''; AOS.render();
    let res; try { res = await c.auth.signInWithPassword({ email, password }); } catch (err) { res = { error: err }; }
    PL.busy = false;
    if (res.error) { PL.error = /invalid/i.test(res.error.message || '') ? 'E-mail ou mot de passe incorrect.' : fail(res.error); AOS.render(); return false; }
    await load();
    return PL.state === 'on';
  };
  document.addEventListener('submit', async e => {
    const f = e.target; if (f.id !== 'portalLogin' && f.id !== 'accountLogin') return; e.preventDefault();
    const email = f.email.value.trim(), password = f.password.value; if (!email || !password) return;
    if (await AOS.portalSignIn(email, password)) toast(f.id === 'accountLogin' ? 'Connecté : tes appareils se synchronisent' : 'Portal relié');
    if (f.id === 'accountLogin' && AOS.act.account) AOS.act.account();
  });
  document.addEventListener('submit', async e => {
    const f = e.target; if (f.id !== 'portalUrlForm') return; e.preventDefault();
    const u = clean(f.u.value);
    if (!u) { toast("Adresse invalide : elle doit commencer par https://", 'bad'); f.u.focus(); return; }
    if (await AOS.setDoc('settings/agency', { ...S.settings, portalUrl: u }, 'settings')) toast('Adresse du portal enregistrée');
  });

  /* dashboard: what came back from the models, then the shortcuts */
  AOS.portalBox = function () {
    if (!AOS.modOn('portal')) return '';
    touch();
    const F = PL.state === 'on' ? AOS.portalFigures() : null;
    const quick = AOS.PORTAL_QUICK.map(q => `<a class="btn sm" href="${to(q.p)}" ${link} title="${q.s}">${ic(q.i, 14)}${q.l}</a>`).join('');
    if (!F) return `<section class="card pt-strip"><span class="lbl">${AOS.dot('var(--violet)')}Creator Portal</span>${quick}
      <button class="linkbtn" data-nav="portal">${client() ? 'Relier mon compte' : 'Tout voir'}</button></section>`;
    return `<section class="card box"><div class="box-h"><span class="lbl">${AOS.dot('var(--violet)')}Creator Portal</span>
        <span class="pt-mini"><b class="${F.review.length ? 'warn-t' : ''}">${F.review.length}</b> à valider<i></i><b>${F.open.length}</b> en cours<i></i><b class="${F.late.length ? 'bad-t' : ''}">${F.late.length}</b> en retard</span>
        <button class="linkbtn" data-nav="portal">Tout voir</button></div>
      ${F.review.slice(0, 3).map(r => reqLine(r, F, 'review')).join('') || '<div class="box-empty"><p>Rien à valider : les modèles n\'ont rien renvoyé de nouveau.</p></div>'}
      <div class="pt-strip in">${quick}</div></section>`;
  };
})();
