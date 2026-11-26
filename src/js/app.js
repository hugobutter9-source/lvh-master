/* Agency OS — application shell: sidebar, router, header, global events, appearance. */
(function (g) {
  const AOS = g.AOS;
  const { $, esc, ic, toast } = AOS;
  const S = AOS.S, me = AOS.me, status = AOS.status;
  let view = 'dashboard';
  AOS.currentView = () => view;

  /* ---------- names & visibility ---------- */
  AOS.modName = p => ((S.settings.moduleNames || {})[p.k] || p.l);
  AOS.navItem = k => AOS.NAV_FLAT.find(n => n.k === k);
  AOS.modOn = k => { const p = AOS.navItem(k); return !!p && AOS.navVisible(p); };
  AOS.navVisible = function (p) {
    const r = me.role; if (!r) return false;
    if (!p.k.startsWith('param-')) return !AOS.isHidden(S.settings, p) && AOS.can(r, p.k, 'r');
    if (p.perm === 'self') return true;
    if (p.perm === 'parametres') return AOS.can(r, 'parametres', 'r');
    return AOS.flag(r, p.perm);
  };

  /* ---------- appearance (per user) ---------- */
  /* appearance lives in ui/appearance.js */

  /* ---------- sidebar ---------- */
  function navBtn(p, extra = '') {
    const fav = (S.prefs.favorites || []).includes(p.k);
    return `<button class="nav ${view === p.k ? 'on' : ''} ${p.view ? '' : 'soon'}" data-nav="${p.k}" title="${esc(AOS.modName(p))}">${ic(p.i)}<span class="lbl-t">${esc(AOS.modName(p))}</span>${extra || (p.view ? '' : '<span class="ph">Bientôt</span>')}${fav && !extra ? '' : ''}</button>`;
  }
  function counters() {
    const t = AOS.today(), L = AOS.lists();
    const open = S.tasks.filter(x => AOS.kindOf(L, 'taskStatus', x.status) !== 'done');
    const urgent = open.filter(x => x.due && x.due <= t).length;
    return {
      taches: urgent ? `<span class="badge">${urgent}</span>` : `<span class="cnt">${open.length}</span>`,
      planning: (n => n ? `<span class="badge">${n}</span>` : '')(S.events.filter(e => e.date === t).length),
      creatrices: `<span class="cnt">${S.creators.length}</span>`,
      equipe: `<span class="cnt">${S.team.filter(m => !m.archived).length}</span>`,
      organigramme: `<span class="cnt">${S.team.filter(m => !m.archived && AOS.kindOf(L, 'availability', m.avail) === 'available').length}/${S.team.filter(m => !m.archived).length}</span>`,
      sop: `<span class="cnt">${S.notes.length}</span>`,
      notifications: (n => n ? `<span class="badge">${n}</span>` : '')(AOS.notifUnread ? AOS.notifUnread() : 0),
      recrutement: (n => `<span class="cnt">${n}</span>`)(S.creators.filter(c => AOS.kindOf(L, 'stages', c.stage) === 'recruiting').length)
    };
  }
  const params = () => AOS.NAV_FLAT.filter(p => p.k.startsWith('param-') && AOS.navVisible(p));
  /* what can be added from anywhere with the + button */
  const QUICK = [['tasks', 'taches', 'Tâche', 'task'], ['calls', 'calls', 'Call', 'phone'], ['events', 'planning', 'Événement', 'cal'], ['students', 'accompagnement', 'Accompagnement', 'grad'], ['creators', 'creatrices', 'Créatrice', 'star'], ['finances', 'finances', 'Transaction', 'euro'], ['goals', 'objectifs', 'Objectif', 'target']];
  const quick = () => QUICK.filter(([col, mod]) => AOS.modOn(mod) && AOS.allowed(col, 'c'));
  function renderSide() {
    const P = S.prefs, cnt = counters(), coll = P.collapsed || {};
    const favs = (P.favorites || []).map(AOS.navItem).filter(p => p && AOS.navVisible(p));
    const roleTxt = me.local ? 'Mode local' : (me.role ? me.role.name : '');
    $('#side').innerHTML = `
    <div class="brand">${AOS.logoHtml()}<div class="bt"><b>${esc(AOS.appName())}</b><small>${esc(S.settings.name || 'Mon agence')}</small></div>
      <button class="iconbtn" data-a="mini" aria-label="${P.sideMini ? 'Déplier' : 'Replier'} la barre latérale" title="${P.sideMini ? 'Déplier' : 'Replier'}">${ic('side', 16)}</button></div>
    <div class="side-top"><button class="searchbtn" data-a="search">${ic('search', 15)}<span class="lbl-t">Rechercher</span><kbd>⌘K</kbd></button>${quick().length ? `<button class="iconbtn plusbtn" data-a="quicknew" aria-label="Ajouter" title="Ajouter (touche N)">${ic('plus', 17)}</button>` : ''}</div>
    <nav class="navs" aria-label="Navigation principale">
    ${favs.length ? `<div class="navsec"><h6><span>Favoris</span></h6>${favs.map(p => navBtn(p, cnt[p.k])).join('')}</div>` : ''}
    ${AOS.NAV.map(sec => {
      if (sec.sec === 'Paramètres') return '';   // one button at the bottom, tabs on the page
      const items = sec.items.filter(AOS.navVisible); if (!items.length) return '';
      const c = !!coll[sec.sec];
      return `<div class="navsec ${c ? 'closed' : ''}"><h6><button data-a="togglesec" data-sec="${esc(sec.sec)}" aria-expanded="${!c}">${ic('down', 12)}<span>${esc(sec.sec)}</span></button></h6>${c ? '' : items.map(p => navBtn(p, cnt[p.k])).join('')}</div>`;
    }).join('')}
    </nav>
    <div class="side-foot">${params()[0] ? `<button class="nav ${view.startsWith('param-') ? 'on' : ''}" data-nav="${params()[0].k}" title="Paramètres">${ic('sliders')}<span class="lbl-t">Paramètres</span></button>` : ''}<div class="row" id="syncst"></div>
      <div class="row muted"><span class="lbl-t">${esc(roleTxt)}${me.role && !me.role.locked && !me.role.assigned && !me.local ? ' · non configuré' : ''}</span></div></div>`;
    AOS.renderStatus();
  }
  AOS.renderStatus = function () {
    const el = $('#syncst'); if (!el) return;
    let c = 'ok', t = 'Synchronisé';
    const Y = AOS.sync, L = AOS.portalLink;
    if (status.mode === 'local' && Y && Y.on()) { const n = Y.pending();
      if (Y.busy) { c = 'info'; t = 'Synchronisation…'; }
      else if (Y.error === 'offline') { c = 'warn'; t = n ? `Hors ligne · ${n} modification${n > 1 ? 's' : ''} en attente` : 'Hors ligne · tout est enregistré ici'; }
      else if (Y.error) { c = 'bad'; t = 'Synchronisation en échec, nouvel essai…'; }
      else { c = 'ok'; t = n ? 'Envoi en cours…' : 'Synchronisé sur tes appareils'; } }
    else if (status.mode === 'local' && Y && Y.pendingOther) { c = 'warn'; t = 'Synchronisation à confirmer'; }
    else if (status.mode === 'local' && L && L.me && Y && !Y.wanted()) { c = 'warn'; t = 'Synchronisation en pause'; }
    else if (status.mode === 'local') { c = 'warn'; t = 'Enregistré sur cet appareil uniquement'; }
    else if (status.mode === 'starting' || !status.loaded) { c = 'faint'; t = 'Chargement…'; }
    else if (status.error) { c = 'bad'; t = status.error; }
    else if (status.pending) { c = 'info'; t = 'Enregistrement…'; }
    else if (status.fromCache) { c = 'warn'; t = 'Connexion au serveur…'; }
    el.innerHTML = status.mode === 'local' ? `<button class="syncbtn" data-a="account" title="Compte et synchronisation">${AOS.dot(AOS.col(c))}<span class="lbl-t">${esc(t)}</span></button>` : `${AOS.dot(AOS.col(c))}<span class="lbl-t">${esc(t)}</span>`;
    const acc = document.getElementById('accountBody'); if (acc && AOS.accountHtml && !acc.querySelector('#accountLogin:focus-within')) acc.innerHTML = AOS.accountHtml();
  };

  /* ---------- account window: one sign-in for the portal link and for the sync between devices ---------- */
  AOS.accountHtml = function () {
    const Y = AOS.sync, L = AOS.portalLink, ok = AOS.portalClient && AOS.portalClient();
    if (!ok) return `<div class="brief"><p class="muted">La synchronisation n'est pas disponible dans cet aperçu. Elle fonctionne sur l'application en ligne.</p></div>`;
    if (!L || !L.me) return `<div class="brief"><p class="muted" style="margin:0">Connecte-toi avec ton compte du Creator Portal (compte manager). Tes tâches, objectifs, agenda et finances se retrouveront sur tous tes appareils, et tu verras les demandes du portal.</p>
      <form id="accountLogin" class="stack tight" style="padding:0;display:flex"><input class="input" id="ac-email" name="email" type="email" autocomplete="username" placeholder="E-mail" required aria-label="E-mail"><input class="input" id="ac-pass" name="password" type="password" autocomplete="current-password" placeholder="Mot de passe" required aria-label="Mot de passe"><button class="btn pri" ${L && L.busy ? 'disabled' : ''}>${L && L.busy ? 'Connexion…' : 'Se connecter'}</button></form>
      ${L && L.error ? `<p class="bad-t small" style="margin:0" role="alert">${esc(L.error)}</p>` : ''}
      <p class="faint small" style="margin:0">Tes données sont enregistrées en ligne sous ton compte : toi seul peux les lire. Ton mot de passe n'est jamais gardé dans l'app.</p></div>`;
    const n = Y.pending();
    return `<div class="brief"><div class="brief-when">${ic('ok', 15)}<b>${esc(L.me.name)}</b><span class="muted">compte du Creator Portal</span></div>
      ${Y.pendingOther ? `<div class="banner"><span>Cet appareil contient déjà des données enregistrées avec un autre compte. Les envoyer vers le compte <b>${esc(L.me.name)}</b> ?</span><button class="btn sm" data-a="syncadopt">Oui, synchroniser</button></div>`
        : `<label class="inline"><input type="checkbox" data-a="syncwanted" ${Y.wanted() ? 'checked' : ''}><span>Synchroniser mes données entre mes appareils</span></label>
        <p class="muted small" style="margin:0">${!Y.wanted() ? 'En pause : cet appareil garde ses données pour lui.' : Y.busy ? 'Synchronisation en cours…' : Y.error === 'offline' ? `Hors ligne. ${n ? n + ' modification' + (n > 1 ? 's' : '') + ' partiront au retour de la connexion.' : 'Rien en attente.'}` : Y.error ? 'Le serveur n\'a pas répondu. Nouvel essai automatique.' : Y.last ? `À jour. Dernière synchronisation à ${new Date(Y.last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.` : 'Première synchronisation…'}</p>
        <p class="faint small" style="margin:0">Sur un autre appareil, ouvre l'app et connecte-toi avec ce même compte : tu y retrouves tout. L'apparence et les favoris restent propres à chaque appareil.</p>`}</div>
      <div class="form-foot pad"><button class="btn ghost" data-a="portallogout">Se déconnecter</button>${Y.on() ? `<button class="btn" data-a="syncnow">Synchroniser maintenant</button>` : ''}</div>`;
  };
  Object.assign(AOS.act, {
    account: () => {
      if (!document.getElementById('accountBody')) document.getElementById('layer').insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="account"><div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="accT"><div class="card-h"><h3 id="accT">Compte et synchronisation</h3><button class="btn sm ghost" data-a="accountclose" aria-label="Fermer">${ic('x')}</button></div><div id="accountBody"></div></div></div>`);
      document.getElementById('accountBody').innerHTML = AOS.accountHtml();
    },
    accountclose: () => document.querySelector('#layer [data-scrim="account"]')?.remove(),
    syncnow: async () => { await AOS.sync.now(); AOS.act.account(); },
    syncadopt: () => { AOS.sync.adopt(); AOS.act.account(); },
    syncwanted: el => { AOS.sync.setWanted(el.checked); AOS.act.account(); }
  });

  /* ---------- page header ---------- */
  AOS.header = function ({ eyebrow, title, actions, key, bare }) {
    const k = key || view, favs = S.prefs.favorites || [], isFav = favs.includes(k);
    const demo = AOS.BACKUP_COLS.some(c => (S[c] || []).some(r => r.demo));
    return `<div class="topbar"><button class="btn sm" data-a="menu" aria-label="Menu">${ic('menu')}</button><b>${esc(AOS.appName())}</b><button class="btn sm ghost" data-a="search" style="margin-left:auto" aria-label="Rechercher">${ic('search')}</button></div>
    ${demo ? `<div class="banner">${ic('star', 15)}<span><b>Mode démonstration</b> : les fiches marquées « exemple » sont fictives.</span>${AOS.flag(me.role, 'users_manage') ? '<button class="btn sm" data-a="cleardemo">Effacer les exemples</button>' : ''}</div>` : ''}
    ${me.role && !me.role.locked && !me.role.assigned && !me.local && status.loaded ? `<div class="banner info">${ic('shield', 15)}<span>Ton accès n'est pas encore configuré : tu as le rôle <b>Invité</b>. Demande au propriétaire de t'attribuer un rôle dans Paramètres › Utilisateurs.</span></div>` : ''}
    ${status.readOnly ? `<div class="banner info">${ic('lock', 15)}<span>Lecture seule : connecte-toi à claude.ai pour modifier.</span></div>` : ''}
    ${bare ? '' : `<div class="head"><div class="ht"><div class="eyebrow">${eyebrow || ''}</div><h1>${title}</h1></div>
    <div class="actions">${AOS.navItem(k) ? `<button class="iconbtn fav ${isFav ? 'on' : ''}" data-a="fav" data-k="${k}" aria-pressed="${isFav}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${ic('star', 16)}</button>` : ''}${actions || ''}</div></div>`}
    ${view.startsWith('param-') && params().length > 1 ? `<div class="chips ptabs" role="tablist" aria-label="Paramètres">${params().map(p => `<button class="chip ${view === p.k ? 'on' : ''}" role="tab" aria-selected="${view === p.k}" data-nav="${p.k}">${esc(AOS.modName(p))}</button>`).join('')}</div>` : ''}`;
  };
  AOS.newBtn = (col, label, pri, extra = '') => AOS.allowed(col, 'c') ? `<button class="btn ${pri ? 'pri' : ''}" data-new="${col}" ${extra}>${ic('plus', 15)}${label}</button>` : '';

  /* ---------- views that are not built yet ---------- */
  function placeholder(p) {
    return AOS.header({ eyebrow: esc(p.sec), title: esc(AOS.modName(p)) }) +
      `<div class="card"><div class="empty big"><span class="pill" style="--c:var(--warn)">Phase ${p.phase} · pas encore disponible</span>
      <h3>Ce module n'est pas encore construit</h3><p>${esc(p.about || '')}</p><p class="faint">Aucune donnée n'est simulée ici. Le détail est dans la feuille de route (ROADMAP.md).</p></div></div>`;
  }
  function denied(p) {
    return AOS.header({ eyebrow: 'Accès', title: 'Accès refusé' }) + `<div class="card"><div class="empty big">${ic('lock', 22)}<h3>Ton rôle ne donne pas accès à « ${esc(p ? AOS.modName(p) : 'cette page')} »</h3><p>Demande à un administrateur de modifier ton rôle dans Paramètres › Permissions.</p></div></div>`;
  }

  /* ---------- render ---------- */
  function render() {
    AOS.applyAppearance();
    const app = $('.app'); app.classList.toggle('mini', !!S.prefs.sideMini);
    const act = document.activeElement, fid = act && act.id && act.closest('#view') ? act.id : null, pos = fid && act.selectionStart;
    /* keep text the person is typing when data changes underneath (another device, a snapshot) */
    const keyOf = el => el.id || (el.form && el.form.id && el.name ? el.form.id + ':' + el.name : '');
    const drafts = {};
    document.querySelectorAll('#view input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), #view textarea').forEach(el => { const k = keyOf(el); if (k && el.value !== el.defaultValue) drafts[k] = el.value; });
    renderSide();
    const tb = document.getElementById('tabbar');
    if (tb) { const tab = (k, i, l) => AOS.modOn(k) ? `<button class="${view === k ? 'on' : ''}" data-nav="${k}" aria-current="${view === k ? 'page' : 'false'}">${ic(i, 21)}<span>${l}</span></button>` : '';
      tb.innerHTML = tab('dashboard', 'home', 'Accueil') + tab('taches', 'task', 'Tâches') + (quick().length ? `<button class="plus" data-a="quicknew" aria-label="Ajouter">${ic('plus', 22)}</button>` : '') + tab('portal', 'film', 'Portal') + `<button data-a="menu" aria-label="Menu">${ic('menu', 21)}<span>Menu</span></button>`; }
    const p = AOS.navItem(view);
    let html;
    if (!status.loaded) html = AOS.header({ eyebrow: 'Chargement…', title: 'Ouverture de ton espace…' });
    else if (p && AOS.isHidden(S.settings, p) && !p.k.startsWith('param-')) html = AOS.header({ eyebrow: esc(p.sec), title: esc(AOS.modName(p)) }) + `<div class="card"><div class="empty big">${ic('layers', 22)}<h3>Module masqué</h3><p>Ce module est masqué pour toute l'agence. Ses données sont conservées.</p>${AOS.can(me.role, 'parametres', 'u') ? '<button class="btn" data-nav="param-perso">Réafficher dans Personnalisation</button>' : ''}</div></div>`;
    else if (!p || !AOS.navVisible(p)) html = denied(p);
    else if (!p.view) html = placeholder(p);
    else { try { html = AOS.views[view](); } catch (e) { console.error(e); html = AOS.header({ title: 'Erreur d\'affichage' }) + `<div class="card"><div class="empty big">Cette page a rencontré une erreur : ${esc(e.message)}. Tes données ne sont pas touchées.</div></div>`; } }
    $('#view').innerHTML = html;
    AOS.renderDrawer();
    document.querySelectorAll('#view input, #view textarea').forEach(el => { const k = keyOf(el); if (k in drafts && el.value === el.defaultValue) el.value = drafts[k]; });
    if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } }
    if (AOS.afterRender[view]) AOS.afterRender[view]();
  }
  AOS.render = render;
  function route() {
    const h = location.hash.slice(1);
    const legacy = { accueil: 'dashboard', pipeline: 'creatrices', agenda: 'planning', notes: 'sop' };
    view = AOS.navItem(h) ? h : (legacy[h] || 'dashboard');
    $('#side').classList.remove('open');
    AOS.routeHooks.forEach(f => f(view));
    render(); g.scrollTo(0, 0);
    /* a page change eases in; a refresh of the same page (new data) does not replay it */
    const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); clearTimeout(route.t); route.t = setTimeout(() => v.classList.remove('enter'), 900);
  }

  /* ---------- global events ---------- */
  Object.assign(AOS.act, {
    search: () => AOS.openSearch(),
    quicknew: () => {
      if (document.querySelector('#layer .scrim')) return;
      document.getElementById('layer').insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="quick"><div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="quickT"><div class="card-h"><h3 id="quickT">Ajouter</h3><button class="btn sm ghost" data-a="quickclose" aria-label="Fermer">${ic('x')}</button></div>
        <div class="quick">${quick().map(([col, , l, i]) => `<button class="li click" data-a="quickpick" data-col="${col}">${ic(i, 17)}<span class="grow title">${l}</span>${ic('chev', 14)}</button>`).join('')}${AOS.modOn('taches') && AOS.allowed('tasks', 'c') ? `<button class="li click" data-a="quicktpl">${ic('layers', 17)}<span class="grow title">Checklist (plusieurs tâches d'un coup)</span>${ic('chev', 14)}</button>` : ''}</div></div></div>`);
      document.querySelector('#layer .quick button')?.focus();
    },
    quickclose: () => document.querySelector('#layer [data-scrim="quick"]')?.remove(),
    quickpick: el => { AOS.act.quickclose(); AOS.openForm(el.dataset.col); },
    quicktpl: () => { AOS.act.quickclose(); AOS.openTemplates(); },
    menu: () => $('#side').classList.toggle('open'),
    mini: () => AOS.savePrefs({ sideMini: !S.prefs.sideMini }),
    togglesec: el => { const c = { ...(S.prefs.collapsed || {}) }; c[el.dataset.sec] = !c[el.dataset.sec]; AOS.savePrefs({ collapsed: c }); },
    fav: el => { const k = el.dataset.k, f = S.prefs.favorites || []; AOS.savePrefs({ favorites: f.includes(k) ? f.filter(x => x !== k) : [...f, k] }); toast(f.includes(k) ? 'Retiré des favoris' : 'Ajouté aux favoris'); },
    closeform: () => AOS.closeForm(),
    closedrawer: () => AOS.closeDrawer(),
    delrec: async el => {
      const { col, id } = el.dataset, r = S[col].find(x => x.id === id);
      const ok = await AOS.confirm({ title: 'Supprimer cette fiche ?', body: `« ${esc(r && (r.name || r.title || r.label))} » sera supprimée. Elle reste récupérable depuis une sauvegarde.${col === 'finances' && r && r.recurrence && r.recurrence !== 'Aucune' ? ' Elle ne sera plus recopiée chaque mois ; les copies déjà créées restent.' : ''}`, ok: 'Supprimer', danger: 1 });
      if (!ok) return;
      if (await AOS.remove(col, id)) { AOS.closeForm(); if (AOS.drawerState() && AOS.drawerState().id === id) AOS.closeDrawer(); toast('Supprimé'); }
    },
    cleardemo: async () => {
      const ops = AOS.demoOps();
      const ok = await AOS.confirm({ title: 'Effacer les données d\'exemple ?', body: `${ops.length} fiches marquées « exemple » seront supprimées. Tes propres fiches ne sont pas touchées.`, ok: 'Effacer les exemples', danger: 1 });
      if (!ok) return;
      if (AOS.db()) { try { await AOS.backup.createSnapshot('avant effacement des exemples'); } catch (e) { toast('Sauvegarde de sécurité impossible : rien n\'a été effacé.', 'bad'); return; } }
      const res = await AOS.applyOps(ops);
      AOS.audit({ act: 'delete', label: `Exemples effacés (${res.ok})` });
      toast(`${res.ok} fiches d'exemple supprimées.`);
    }
  });
  document.addEventListener('click', async e => {
    if (e.target.closest('a[href]')) return;   // real links (Drive, external) open normally
    const T = e.target.closest('[data-copy],[data-a],[data-new],[data-edit],[data-open],[data-hit],[data-nav],[data-scrim]');
    if (!T) return; const d = T.dataset;
    if (d.scrim !== undefined) { if (e.target === T) T.remove(); return; }
    if (d.copy !== undefined) {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(d.copy); toast('Copié : ' + d.copy); }
      catch (_) { const r = document.createRange(); r.selectNodeContents(T.previousElementSibling); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Texte sélectionné : fais Ctrl+C'); }
      return;
    }
    if (d.a) { if (AOS.act[d.a]) { e.stopPropagation(); AOS.act[d.a](T, e); } return; }
    if (d.new) { const p = {}; for (const [k, v] of Object.entries(d)) if (k.startsWith('preset')) p[k[6].toLowerCase() + k.slice(7)] = v; AOS.openForm(d.new, null, p); return; }
    if (d.edit) { const [c, i] = d.edit.split(':'); AOS.openForm(c, i); return; }
    if (d.open) { const [c, i] = d.open.split(':'); AOS.openRecord(c, i); return; }
    if (d.hit) { $('#layer [data-scrim="search"]')?.remove(); const [c, i] = d.hit.split(':'); if (c === 'page') location.hash = i; else AOS.openRecord(c, i); return; }
    if (d.nav) { AOS.closeDrawer(); if (location.hash === '#' + d.nav) route(); else location.hash = d.nav; }
  });
  document.addEventListener('input', e => { const f = AOS.inputs[e.target.id]; if (f) f(e.target); });
  document.addEventListener('change', e => { const f = AOS.changes[e.target.id] || AOS.changes[e.target.name]; if (f) f(e.target); });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); AOS.openSearch(); }
    if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable && quick().length) { e.preventDefault(); AOS.act.quicknew(); }
    if (e.key === 'Escape') { const s = [...document.querySelectorAll('#layer .scrim')].pop(); if (s) s.remove(); else if (AOS.drawerState()) AOS.closeDrawer(); }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-open][tabindex]')) e.target.click();
  });
  g.addEventListener('hashchange', route);
  /* the phone top bar is see-through at the top of a page and turns to frosted glass once the page moves under it */
  /* a window that hangs off the right edge of the screen (its size was kept from a larger display): the page is
     laid out for the whole window, so its right part is out of sight. Lay it out for the visible part instead. */
  function fitWindow() {
    const sc = g.screen || {}, left = typeof g.screenX === 'number' ? g.screenX : 0, al = sc.availLeft || 0;
    let fit = 'none';
    if (sc.availWidth && g.outerWidth && left >= al) { const visible = al + sc.availWidth - left - Math.max(0, g.outerWidth - g.innerWidth); if (visible > 640 && g.innerWidth - visible > 6) fit = Math.floor(visible) + 'px'; }
    if (fitWindow.v !== fit) { fitWindow.v = fit; document.documentElement.style.setProperty('--fit', fit); }
  }
  AOS.fitWindow = fitWindow;
  fitWindow(); g.addEventListener('resize', fitWindow); g.addEventListener('focus', fitWindow); setInterval(fitWindow, 2500);
  const onScroll = () => document.documentElement.classList.toggle('scrolled', g.scrollY > 6);
  g.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- boot ---------- */
  AOS.onChange(() => render());
  route();
  AOS.initStore();
})(window);
