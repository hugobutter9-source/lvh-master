/* Agency OS — Paramètres: apparence, personnalisation, utilisateurs, permissions, import/export,
   sauvegardes, journal d'audit, intégrations. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, dot, pill, toast, dTime, sortBy } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui, status = AOS.status;
  const canSet = () => AOS.can(me.role, 'parametres', 'u');
  const H = (title, sub) => AOS.header({ eyebrow: 'Paramètres', title: esc(title) + (sub ? ` <span class="soft">${sub}</span>` : '') });

  /* ---------- people names (opaque ids → profiles) ---------- */
  const profiles = {}; let pending = false;
  async function loadProfiles(ids) {
    const u = AOS.userCap(); ids = ids.filter(i => i && i !== 'local' && !(i in profiles));
    if (!u || !ids.length || pending) return;
    pending = true;
    try { const r = await u.profiles(ids); for (const i of ids) profiles[i] = r[i] || null; } catch (e) { for (const i of ids) profiles[i] = null; }
    pending = false; AOS.render();
  }
  const who = id => id === 'local' ? 'Toi (mode local)' : id === me.uid ? 'Toi' : (profiles[id] && profiles[id].name) || 'Utilisateur ' + String(id || '?').slice(-4);

  /* ---------- Personnalisation ---------- */
  AOS.views['param-perso'] = function () {
    const L = AOS.lists(), ro = !canSet(), dis = ro ? 'disabled' : '';
    const listCard = key => {
      const meta = AOS.LIST_META[key], items = L[key], colored = !!meta.colored;
      return `<div class="card"><div class="card-h"><div><h3>${esc(meta.label)}</h3>${meta.hint ? `<div class="muted small">${esc(meta.hint)}</div>` : ''}</div><span class="mono faint">${items.length}</span></div>
      <div class="lst">${items.map((it, i) => { const k = AOS.keyOf(it), n = AOS.usage(S, key, k).length; return `<div class="lrow">
        ${colored ? `<select class="input sw" data-a2="lcolor" data-list="${key}" data-i="${i}" aria-label="Couleur" ${dis}>${AOS.COLORS.map(c => `<option value="${c}" ${it.c === c ? 'selected' : ''}>${c}</option>`).join('')}</select>${dot(AOS.col(it.c))}` : ''}
        <input class="input grow" value="${esc(k)}" data-a2="lrename" data-list="${key}" data-i="${i}" aria-label="Nom" ${dis}>
        ${meta.kinds ? `<select class="input" data-a2="lkind" data-list="${key}" data-i="${i}" aria-label="Signification" ${dis}><option value="">—</option>${Object.entries(meta.kinds).map(([kk, lab]) => `<option value="${kk}" ${it.kind === kk ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>` : ''}
        <span class="faint small use" title="Fiches utilisant cette valeur">${n}</span>
        ${ro ? '' : `<button class="iconbtn" data-a="lmove" data-list="${key}" data-i="${i}" data-d="-1" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button><button class="iconbtn" data-a="ldel" data-list="${key}" data-i="${i}" aria-label="Supprimer">${ic('trash', 14)}</button>`}</div>`; }).join('')}</div>
      ${ro ? '' : `<form class="lrow add" data-addlist="${key}"><input class="input grow" name="v" placeholder="Ajouter une valeur…" aria-label="Nouvelle valeur"><button class="btn sm">${ic('plus', 14)}Ajouter</button></form>`}</div>`;
    };
    return H('Personnalisation', 'de ton espace.') +
    (ro ? `<div class="banner info">${ic('lock', 15)}<span>Lecture seule pour ton rôle.</span></div>` : '') +
    `<div class="card pad"><form id="agencyForm" class="form2"><div class="fld"><label for="s-name">Nom de l'agence</label><input id="s-name" name="name" value="${esc(S.settings.name || '')}" ${dis}></div>
      <div class="fld"><label for="s-owner">Prénom affiché sur l'accueil</label><input id="s-owner" name="owner" value="${esc(S.settings.owner || '')}" ${dis}></div>
      ${ro ? '' : '<div class="form-foot"><button class="btn pri">Enregistrer</button></div>'}</form></div>
    <div class="card"><div class="card-h"><div><h3>Modules affichés</h3><div class="muted small">Pour toute l'agence. Masquer un module ne supprime aucune donnée.</div></div></div>
      <div class="modgrid">${AOS.NAV.filter(s => s.sec !== 'Paramètres').map(sec => `<div class="stack tight"><span class="h5">${esc(sec.sec)}</span>${sec.items.map(p => `<label class="inline"><input type="checkbox" data-a="navtoggle" data-k="${p.k}" ${AOS.isHidden(S.settings, p) ? '' : 'checked'} ${dis}><span>${esc(AOS.modName(p))}${p.view ? '' : ` <span class="faint small">· phase ${p.phase}</span>`}</span></label>`).join('')}</div>`).join('')}</div></div>
    <div class="card"><div class="card-h"><div><h3>Noms des modules</h3><div class="muted small">Renomme les entrées de la barre latérale. Laisse vide pour le nom par défaut.</div></div></div>
      <form id="modForm" class="modgrid">${AOS.NAV_FLAT.filter(p => !p.k.startsWith('param-')).map(p => `<label class="fld"><span class="muted small">${esc(p.l)}</span><input name="${p.k}" value="${esc((S.settings.moduleNames || {})[p.k] || '')}" placeholder="${esc(p.l)}" ${dis}></label>`).join('')}
      ${ro ? '' : '<div class="form-foot full"><button class="btn pri">Enregistrer les noms</button></div>'}</form></div>
    <p class="muted hint">Renommer une valeur met à jour toutes les fiches qui l'utilisent. Une valeur utilisée ne peut pas être supprimée. Le chiffre à droite indique combien de fiches l'utilisent.</p>
    <div class="grid g2 top">${Object.keys(AOS.LIST_META).map(listCard).join('')}</div>`;
  };
  AOS.afterRender['param-perso'] = () => {
    const f = document.getElementById('agencyForm');
    if (f) f.onsubmit = async e => { e.preventDefault(); if (await AOS.setDoc('settings/agency', { ...S.settings, name: f.name.value.trim() || 'Mon agence', owner: f.owner.value.trim() }, 'settings')) toast('Paramètres enregistrés'); };
    const m = document.getElementById('modForm');
    if (m) m.onsubmit = async e => { e.preventDefault(); const names = {}; for (const el of m.elements) if (el.name && el.value.trim()) names[el.name] = el.value.trim(); if (await AOS.setDoc('settings/agency', { ...S.settings, moduleNames: names }, 'settings')) toast('Noms des modules enregistrés'); };
    document.querySelectorAll('[data-addlist]').forEach(fm => fm.onsubmit = e => { e.preventDefault(); addItem(fm.dataset.addlist, fm.v.value.trim()); });
    document.querySelectorAll('[data-a2]').forEach(el => el.onchange = () => listChange(el));
  };
  AOS.act.navtoggle = async el => {
    const p = AOS.navItem(el.dataset.k), h = { ...(S.settings.navHidden || {}) };
    h[p.k] = !AOS.isHidden(S.settings, p);
    if (p.k === 'dashboard' && h[p.k]) { toast('Le dashboard reste toujours affiché.'); el.checked = true; return; }
    if (await AOS.setDoc('settings/agency', { ...S.settings, navHidden: h }, 'settings')) toast(h[p.k] ? `« ${AOS.modName(p)} » masqué` : `« ${AOS.modName(p)} » affiché`);
  };
  const cloneLists = () => JSON.parse(JSON.stringify(AOS.lists()));
  async function saveLists(lists, extra = [], label) {
    const res = await AOS.applyOps([...extra, { op: 'set', path: 'settings/lists', data: lists }], { stopOnError: true });
    if (!res.failed) { AOS.audit({ act: 'settings', col: 'settings/lists', label }); return true; }
    return false;
  }
  function validKinds(key, items) {
    if (key === 'taskStatus' && (!items.some(i => i.kind === 'done') || !items.some(i => i.kind !== 'done'))) return 'Garde au moins un statut « Terminée » et un statut « Ouverte ».';
    if (key === 'availability' && !items.some(i => i.kind === 'available')) return 'Garde au moins un statut qui compte comme disponible.';
    if (key === 'stages' && !items.some(i => i.kind === 'active')) return 'Garde au moins un statut « Active ».';
    return '';
  }
  async function addItem(key, v) {
    if (!v) return; const L = cloneLists(), meta = AOS.LIST_META[key];
    if (L[key].some(x => AOS.keyOf(x).toLowerCase() === v.toLowerCase())) { toast('Cette valeur existe déjà.'); return; }
    L[key].push(meta.colored ? { k: v, c: 'muted' } : v);
    if (await saveLists(L, [], `${meta.label} : ajout « ${v} »`)) toast('Ajouté');
  }
  async function listChange(el) {
    const key = el.dataset.list, i = +el.dataset.i, L = cloneLists(), meta = AOS.LIST_META[key], it = L[key][i];
    if (el.dataset.a2 === 'lcolor') { it.c = el.value; await saveLists(L, [], `${meta.label} : couleur`); return; }
    if (el.dataset.a2 === 'lkind') { it.kind = el.value || undefined; const err = validKinds(key, L[key]); if (err) { toast(err, 'bad'); AOS.render(); return; } await saveLists(L, [], `${meta.label} : signification`); return; }
    const from = AOS.keyOf(it), to = el.value.trim();
    if (!to || to === from) { el.value = from; return; }
    if (L[key].some((x, j) => j !== i && AOS.keyOf(x).toLowerCase() === to.toLowerCase())) { toast('Cette valeur existe déjà.'); el.value = from; return; }
    const ops = AOS.renamePlan(S, key, from, to);
    if (ops.length && !(await AOS.confirm({ title: `Renommer « ${esc(from)} » ?`, body: `${ops.length} fiche(s) seront mises à jour avec « ${esc(to)} ».`, ok: 'Renommer' }))) { el.value = from; return; }
    if (typeof it === 'string') L[key][i] = to; else it.k = to;
    if (await saveLists(L, ops.map(o => ({ ...o, data: { ...o.data, updatedAt: Date.now() } })), `${meta.label} : « ${from} » → « ${to} » (${ops.length} fiches)`)) toast('Renommé');
  }
  AOS.act.lmove = async el => { const key = el.dataset.list, i = +el.dataset.i, L = cloneLists(); if (i < 1) return; [L[key][i - 1], L[key][i]] = [L[key][i], L[key][i - 1]]; await saveLists(L, [], AOS.LIST_META[key].label + ' : ordre'); };
  AOS.act.ldel = async el => {
    const key = el.dataset.list, i = +el.dataset.i, L = cloneLists(), v = AOS.keyOf(L[key][i]), n = AOS.usage(S, key, v).length;
    if (n) { toast(`« ${v} » est utilisé par ${n} fiche(s) : renomme-le ou change ces fiches d'abord.`, 'bad'); return; }
    if (L[key].length < 2) { toast('Garde au moins une valeur.'); return; }
    L[key].splice(i, 1);
    const err = validKinds(key, L[key]); if (err) { toast(err, 'bad'); return; }
    if (!(await AOS.confirm({ title: `Supprimer « ${esc(v)} » ?`, body: 'Aucune fiche ne l\'utilise.', ok: 'Supprimer', danger: 1 }))) return;
    if (await saveLists(L, [], `${AOS.LIST_META[key].label} : suppression « ${v} »`)) toast('Supprimé');
  };

  /* ---------- Utilisateurs ---------- */
  AOS.views['param-utilisateurs'] = function () {
    const roles = allRoles(), users = S.users;
    if (!AOS.db()) return H('Utilisateurs') + `<div class="card"><div class="empty big">${ic('users', 22)}<h3>Mode local</h3><p>Cette copie tourne hors de claude.ai : un seul utilisateur, tes données restent dans ce navigateur. Ouvre l'application depuis son lien claude.ai pour gérer une équipe.</p></div></div>`;
    loadProfiles(users.map(u => u.id));
    const canW = AOS.flag(me.role, 'users_manage');
    return H('Utilisateurs', `· ${users.length + 1} compte${users.length ? 's' : ''}.`) +
    `<div class="banner info">${ic('shield', 15)}<span>Deux étapes pour donner accès : <b>1.</b> partager l'application depuis le menu Partager de claude.ai (<b>Contributeur</b> pour les rôles opérationnels, <b>Éditeur</b> pour Administrateur et Comptable) ; <b>2.</b> attribuer ici un rôle. Sans rôle attribué, la personne est « Invité ».</span></div>
    <div class="card tbl-wrap"><table><thead><tr><th>Personne</th><th>Rôle de sécurité</th><th>Fiche collaborateur liée</th><th>Accès</th><th></th></tr></thead><tbody>
      <tr><td><div class="who">${AOS.av(who(me.uid))}<b class="strong">${esc(who(me.uid))}</b></div></td><td>${pill(me.role.name, 'var(--accent)')}</td><td class="muted">${esc(AOS.nm('team', me.role.memberId) || '—')}</td><td>${pill('Actif', 'var(--ok)')}</td><td></td></tr>
      ${users.filter(u => u.id !== me.uid).map(u => `<tr><td><div class="who">${AOS.av(who(u.id))}<div><b class="strong">${esc(who(u.id))}</b>${profiles[u.id] && profiles[u.id].guest ? ' <span class="tag">externe</span>' : ''}</div></div></td>
        <td><select class="input" data-a2="urole" data-id="${u.id}" ${canW ? '' : 'disabled'} aria-label="Rôle">${roles.filter(r => r.id !== 'owner').map(r => `<option value="${r.id}" ${u.roleId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></td>
        <td><select class="input" data-a2="umember" data-id="${u.id}" ${canW ? '' : 'disabled'} aria-label="Fiche liée"><option value="">—</option>${sortBy(S.team, m => m.name).map(m => `<option value="${m.id}" ${u.memberId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
        <td>${u.active === false ? pill('Suspendu', 'var(--bad)') : pill('Actif', 'var(--ok)')}</td>
        <td>${canW ? `<button class="btn sm ghost" data-a="utoggle" data-id="${u.id}">${u.active === false ? 'Réactiver' : 'Suspendre'}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${canW ? `<div class="card pad"><h3 class="h3">Ajouter une personne</h3><p class="muted small">Recherche parmi les personnes de ton organisation claude.ai.</p>
      <div class="toolbar"><input class="input" id="uSearch" placeholder="Nom ou email…" autocomplete="off"><select class="input" id="uRole" aria-label="Rôle">${roles.filter(r => r.id !== 'owner').map(r => `<option value="${r.id}" ${r.id === (ui.uRole || 'employee') ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div id="uRes" class="list">${AOS.uHitsHtml()}</div></div>` : ''}
    <p class="faint hint">Suspendre retire les droits dans l'application (rôle Invité). Pour couper tout accès, retire aussi la personne dans le menu Partager.</p>`;
  };
  let searchT = 0;
  /* search results live in state (not in the DOM) so a refresh never wipes them */
  let uHits = null, uErr = false;
  AOS.inputs.uSearch = el => { clearTimeout(searchT); searchT = setTimeout(async () => {
    const u = AOS.userCap(); if (!u) return;
    try { uHits = (await u.search(el.value.trim())).filter(h => h.id !== me.uid).slice(0, 8); uErr = false; uHits.forEach(h => { profiles[h.id] = h; }); }
    catch (e) { uHits = []; uErr = true; }
    AOS.render();
  }, 250); };
  AOS.changes.uRole = el => { ui.uRole = el.value; };
  AOS.uHitsHtml = () => uHits === null ? '' : uErr ? '<div class="empty">Recherche indisponible ici.</div>' : uHits.length ? uHits.map(h => { const has = S.users.some(x => x.id === h.id); return `<div class="li">${AOS.av(h.name || '?')}<div class="grow"><div class="title">${esc(h.name || 'Sans nom')}</div><div class="sub">${h.guest ? 'Externe à l\'organisation' : ''}</div></div>${has ? '<span class="faint small">Déjà ajouté</span>' : `<button class="btn sm" data-a="uadd" data-id="${esc(h.id)}">Ajouter</button>`}</div>`; }).join('') : '<div class="empty">Aucune personne trouvée.</div>';
  AOS.act.uadd = async el => {
    const roleId = document.getElementById('uRole').value;
    const ok = await AOS.applyOps([{ op: 'set', col: 'users', id: el.dataset.id, data: { roleId, active: true, addedAt: Date.now(), addedBy: me.uid } }]);
    if (ok.ok) { AOS.audit({ act: 'create', col: 'users', docId: el.dataset.id, label: 'Accès : rôle ' + roleId }); toast('Personne ajoutée. Pense à la partager depuis le menu Partager.'); }
  };
  AOS.act.utoggle = async el => {
    const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
    const r = await AOS.applyOps([{ op: 'set', col: 'users', id: u.id, data: { ...strip(u), active: u.active === false } }]);
    if (r.ok) AOS.audit({ act: 'update', col: 'users', docId: u.id, label: u.active === false ? 'Accès réactivé' : 'Accès suspendu' });
  };
  AOS.afterRender['param-utilisateurs'] = () => document.querySelectorAll('[data-a2=urole],[data-a2=umember]').forEach(el => el.onchange = async () => {
    const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
    const patch = el.dataset.a2 === 'urole' ? { roleId: el.value } : { memberId: el.value || null };
    const r = await AOS.applyOps([{ op: 'set', col: 'users', id: u.id, data: { ...strip(u), ...patch } }]);
    if (r.ok) { AOS.audit({ act: 'update', col: 'users', docId: u.id, label: el.dataset.a2 === 'urole' ? 'Rôle → ' + el.value : 'Fiche liée modifiée', keys: Object.keys(patch) }); toast('Enregistré'); }
  });
  const strip = o => { const { id, ...r } = o; return r; };

  /* ---------- Permissions ---------- */
  function allRoles() {
    const stored = S.roles, out = [{ id: 'owner', ...AOS.fullRole() }];
    for (const id of Object.keys(AOS.BUILTIN_ROLES)) if (id !== 'owner') { const s = stored.find(r => r.id === id); out.push({ id, builtin: true, ...(s || AOS.BUILTIN_ROLES[id]) }); }
    for (const r of stored) if (!AOS.BUILTIN_ROLES[r.id]) out.push(r);
    return out;
  }
  AOS.allRoles = allRoles;
  AOS.views['param-permissions'] = function () {
    const roles = allRoles(), cur = roles.find(r => r.id === ui.roleSel) || roles[1], canW = AOS.flag(me.role, 'users_manage') && !cur.locked;
    const users = S.users.filter(u => u.roleId === cur.id).length;
    const secs = [...new Set(AOS.PERM_MODULES.map(m => m.sec))];
    return H('Permissions', 'par rôle de sécurité.') +
    `<div class="banner info">${ic('shield', 15)}<span>Les <b>rôles de sécurité</b> sont distincts des <b>postes</b> de l'organigramme. Le serveur applique trois cloisons selon le niveau de partage (Lecteur, Contributeur, Éditeur) : finances, rémunérations, sauvegardes, journal et réglages ne sont lisibles ou modifiables que par les Éditeurs et le propriétaire. Le détail module par module ci-dessous est appliqué par l'application.</span></div>
    <div class="split"><div class="card list rolelist">${roles.map(r => `<button class="li click ${r.id === cur.id ? 'sel' : ''}" data-a="rolesel" data-id="${r.id}"><div class="grow"><div class="title">${esc(r.name)}${r.locked ? ' ' + ic('lock', 12) : ''}</div><div class="sub">${esc(r.desc || (r.builtin ? 'Rôle par défaut' : 'Rôle personnalisé'))}</div></div></button>`).join('')}
      ${AOS.flag(me.role, 'users_manage') ? `<form class="li" id="newRole"><input class="input grow" name="n" placeholder="Nouveau rôle…" aria-label="Nom du nouveau rôle"><button class="btn sm">${ic('plus', 14)}</button></form>` : ''}</div>
    <div class="card"><div class="card-h"><div><h3>${esc(cur.name)}</h3><div class="muted small">${users} utilisateur(s) · niveau de partage requis : <b>${cur.minLevel === 'admin' ? 'Éditeur' : cur.minLevel === 'owner' ? 'Propriétaire' : 'Contributeur'}</b></div></div>
      ${canW && !cur.builtin ? `<button class="btn sm danger" data-a="roledel" data-id="${cur.id}">Supprimer</button>` : ''}${canW && cur.builtin ? `<button class="btn sm ghost" data-a="rolereset" data-id="${cur.id}">Réinitialiser</button>` : ''}</div>
      <div class="tbl-wrap"><table class="matrix"><thead><tr><th>Module</th>${AOS.PERM_ACTIONS.map(a => `<th class="c">${a[1]}</th>`).join('')}</tr></thead><tbody>
      ${secs.map(sec => `<tr class="grp"><td colspan="6">${esc(sec)}</td></tr>` + AOS.PERM_MODULES.filter(m => m.sec === sec).map(m => `<tr><td>${esc(m.l)}${AOS.navItem(m.k) && !AOS.navItem(m.k).view ? ' <span class="faint small">· phase ' + AOS.navItem(m.k).phase + '</span>' : ''}</td>${AOS.PERM_ACTIONS.map(([a]) => `<td class="c"><input type="checkbox" aria-label="${esc(m.l)} ${a}" data-a2="perm" data-m="${m.k}" data-x="${a}" ${AOS.can(cur, m.k, a) ? 'checked' : ''} ${canW ? '' : 'disabled'}></td>`).join('')}</tr>`).join('')).join('')}
      </tbody></table></div>
      <div class="card-b"><h5 class="h5">Droits spéciaux</h5>${AOS.PERM_FLAGS.map(([f, l, hint]) => `<label class="inline flagrow"><input type="checkbox" data-a2="flag" data-f="${f}" ${AOS.flag(cur, f) ? 'checked' : ''} ${canW ? '' : 'disabled'}><span>${esc(l)}${hint ? `<br><span class="faint small">${esc(hint)}</span>` : ''}</span></label>`).join('')}
      ${canW ? `<div class="fld" style="max-width:280px;margin-top:12px"><label for="minLevel">Niveau de partage requis</label><select id="minLevel" data-a2="minlevel"><option value="interact" ${cur.minLevel !== 'admin' ? 'selected' : ''}>Contributeur</option><option value="admin" ${cur.minLevel === 'admin' ? 'selected' : ''}>Éditeur</option></select></div>` : ''}</div></div></div>`;
  };
  AOS.act.rolesel = el => { ui.roleSel = el.dataset.id; AOS.render(); };
  async function saveRole(r, label) {
    const { id, locked, assigned, memberId, ...data } = r;
    const res = await AOS.applyOps([{ op: 'set', col: 'roles', id, data }]);
    if (res.ok) AOS.audit({ act: 'settings', col: 'roles', docId: id, label });
  }
  AOS.afterRender['param-permissions'] = () => {
    const nf = document.getElementById('newRole');
    if (nf) nf.onsubmit = async e => { e.preventDefault(); const n = nf.n.value.trim(); if (!n) return; const id = 'r' + AOS.uid(); const base = AOS.BUILTIN_ROLES.employee; await saveRole({ id, name: n, desc: 'Rôle personnalisé', minLevel: 'interact', perms: { ...base.perms }, flags: {} }, 'Rôle créé : ' + n); ui.roleSel = id; toast('Rôle créé à partir du rôle Employé'); };
    document.querySelectorAll('[data-a2=perm],[data-a2=flag],[data-a2=minlevel]').forEach(el => el.onchange = async () => {
      const cur = allRoles().find(r => r.id === (ui.roleSel || allRoles()[1].id)); if (!cur || cur.locked) return;
      const r = JSON.parse(JSON.stringify(cur)); r.perms = r.perms || {}; r.flags = r.flags || {};
      if (el.dataset.a2 === 'perm') { const set = new Set((r.perms[el.dataset.m] || '').split('')); el.checked ? set.add(el.dataset.x) : set.delete(el.dataset.x); if (el.dataset.x !== 'r' && el.checked) set.add('r'); if (el.dataset.x === 'r' && !el.checked) set.clear(); r.perms[el.dataset.m] = 'rcudx'.split('').filter(a => set.has(a)).join(''); }
      else if (el.dataset.a2 === 'flag') r.flags[el.dataset.f] = el.checked ? 1 : 0;
      else r.minLevel = el.value;
      await saveRole(r, `Permissions de ${r.name} modifiées`);
    });
  };
  AOS.act.roledel = async el => {
    const id = el.dataset.id, n = S.users.filter(u => u.roleId === id).length;
    if (n) { toast(`${n} utilisateur(s) ont ce rôle : change-leur de rôle d'abord.`, 'bad'); return; }
    if (!(await AOS.confirm({ title: 'Supprimer ce rôle ?', ok: 'Supprimer', danger: 1 }))) return;
    const r = await AOS.applyOps([{ op: 'delete', col: 'roles', id }]); if (r.ok) { AOS.audit({ act: 'delete', col: 'roles', docId: id, label: 'Rôle supprimé' }); ui.roleSel = null; }
  };
  AOS.act.rolereset = async el => {
    const id = el.dataset.id, b = AOS.BUILTIN_ROLES[id];
    if (!(await AOS.confirm({ title: `Réinitialiser « ${esc(b.name)} » ?`, body: 'Ses permissions reviennent aux valeurs par défaut.', ok: 'Réinitialiser' }))) return;
    await saveRole({ id, name: b.name, desc: b.desc, minLevel: b.minLevel, perms: b.perms, flags: b.flags, builtin: true }, 'Rôle réinitialisé : ' + b.name);
  };

  /* ---------- Import / export ---------- */
  const COL_LABEL = { creators: 'Créatrices', team: 'Équipe', tasks: 'Tâches', events: 'Planning', finances: 'Finances', notes: 'SOP & notes', payroll: 'Rémunérations', roles: 'Rôles', users: 'Utilisateurs' };
  AOS.views['param-import'] = function () {
    const R = me.role, canX = AOS.can(R, 'parametres', 'x'), canC = AOS.can(R, 'parametres', 'c') && (me.isOwner || me.canEdit || me.local);
    const csvCols = Object.keys(AOS.backup.CSV_COLS).filter(c => AOS.can(R, AOS.COL_MODULE[c], 'r') && (c !== 'finances' || AOS.flag(R, 'finance_view')));
    return H('Import / export') +
    `<div class="grid g2 top"><div class="card pad stack"><h3 class="h3">${ic('download', 16)} Exporter</h3>
      ${canX ? `<div class="setrow"><div><b>Sauvegarde complète (JSON)</b><p class="muted small">Toutes les données visibles par ton rôle. Se réimporte ici.</p></div><button class="btn pri" data-a="expjson">Télécharger</button></div>
      <div class="setrow col"><div><b>Tableaux (CSV pour Excel / Sheets)</b></div><div class="chips">${csvCols.map(c => `<button class="chip" data-a="csvexport" data-col="${c}">${ic('download', 13)} ${COL_LABEL[c]}</button>`).join('')}</div></div>` : '<p class="muted">Ton rôle ne permet pas l\'export.</p>'}
      <div id="expFallback"></div></div>
    <div class="card pad stack"><h3 class="h3">${ic('upload', 16)} Importer une sauvegarde</h3>
      ${canC ? `<p class="muted small">Fichier JSON exporté depuis LVH Master ou depuis ton ancien outil (Agency OS, « second brain »). Une sauvegarde de sécurité est créée automatiquement avant l'import.</p>
      <input type="file" id="impFile" accept=".json,application/json" class="input"><div id="impPreview"></div>` : '<p class="muted">Réservé au propriétaire et aux Éditeurs.</p>'}
      <p class="faint small">Import CSV de transactions et de statistiques : phase 4.</p></div></div>`;
  };
  async function offerResult(r, filename) {
    if (r.res === 'saved') { toast('Fichier téléchargé'); return; }
    if (r.res === 'declined') { toast('Téléchargement annulé'); return; }
    const box = document.getElementById('expFallback') || document.getElementById('view');
    const wrap = document.createElement('div'); wrap.className = 'stack';
    wrap.innerHTML = `<p class="muted small">Le téléchargement n'est pas disponible dans cette vue. Copie le contenu de <b>${esc(filename)}</b> :</p><textarea class="input mono" rows="8" readonly></textarea><button class="btn sm">Copier</button>`;
    wrap.querySelector('textarea').value = r.text;
    wrap.querySelector('button').onclick = async () => { try { await navigator.clipboard.writeText(r.text); toast('Copié'); } catch (e) { wrap.querySelector('textarea').select(); toast('Sélectionné : fais Ctrl+C'); } };
    box.innerHTML = ''; box.appendChild(wrap);
  }
  AOS.act.expjson = async () => offerResult(await AOS.backup.exportJSON(), 'sauvegarde.json');
  AOS.act.csvexport = async el => {
    const c = el.dataset.col; if (!AOS.can(me.role, AOS.COL_MODULE[c], 'x') && !AOS.can(me.role, 'parametres', 'x')) { toast("Ton rôle ne permet pas l'export.", 'bad'); return; }
    offerResult(await AOS.backup.exportCSV(c), c + '.csv');
  };
  AOS.changes.impFile = async el => {
    const f = el.files && el.files[0], box = document.getElementById('impPreview'); if (!f) return;
    const obj = AOS.backup.parse(await f.text()); showRestore(box, obj, f.name);
  };
  function showRestore(box, obj, name) {
    const v = AOS.validateBackup(obj);
    if (!v.ok) { box.innerHTML = `<div class="banner bad">${v.errors.map(esc).join('<br>')}</div>`; return; }
    box.innerHTML = `<div class="card pad stack inner"><b>${esc(name)}</b><div class="muted small">${obj.agency ? esc(obj.agency) + ' · ' : ''}${obj.exportedAt ? 'exporté le ' + esc(new Date(obj.exportedAt).toLocaleString('fr-FR')) : ''} · version ${obj.schema}</div>
      <div class="chips">${Object.entries(v.counts).map(([c, n]) => `<span class="tag">${esc(COL_LABEL[c] || c)} : ${n}</span>`).join('')}</div>
      ${v.warnings.map(w => `<div class="faint small">${esc(w)}</div>`).join('')}
      <div class="chips"><label class="inline"><input type="radio" name="rmode" value="merge" checked> Fusionner : ajoute et met à jour, ne supprime rien</label><label class="inline"><input type="radio" name="rmode" value="replace"> Remplacer : supprime aussi les fiches absentes du fichier</label></div>
      <div><button class="btn pri" id="doRestore">Importer</button></div><div id="rProg" class="muted small"></div></div>`;
    box.querySelector('#doRestore').onclick = async () => {
      const mode = box.querySelector('input[name=rmode]:checked').value;
      const ops = AOS.restorePlan(obj, S, mode), dels = ops.filter(o => o.op === 'delete').length;
      const ok = await AOS.confirm({ title: mode === 'replace' ? 'Remplacer les données ?' : 'Importer cette sauvegarde ?', body: `${ops.length - dels} fiches écrites${dels ? `, <b>${dels} fiches supprimées</b>` : ''}. Une sauvegarde de sécurité est créée avant.`, ok: 'Importer', danger: mode === 'replace', typeToConfirm: mode === 'replace' ? 'REMPLACER' : '' });
      if (!ok) return;
      const prog = box.querySelector('#rProg'); box.querySelector('#doRestore').disabled = true;
      const r = await AOS.backup.restore(obj, mode, (n, t) => { prog.textContent = `${n} / ${t}…`; });
      prog.textContent = r.msg || `Terminé : ${r.ok} écritures${r.failed ? `, ${r.failed} échecs` : ''}.`;
      toast(r.failed ? 'Import terminé avec des erreurs' : 'Import terminé', r.failed ? 'bad' : '');
    };
  }

  /* ---------- Sauvegardes ---------- */
  let snaps = null, snapsLoading = false;
  async function refreshSnaps() { snapsLoading = true; try { snaps = await AOS.backup.listSnapshots(); } catch (e) { snaps = []; toast('Impossible de lire les sauvegardes.', 'bad'); } snapsLoading = false; AOS.render(); }
  AOS.views['param-sauvegardes'] = function () {
    if (snaps === null && !snapsLoading) refreshSnaps();
    const canW = canSet() && (me.isOwner || me.canEdit || me.local), sc = S.schema;
    return H('Sauvegardes') +
    `<div class="card pad stack"><div class="setrow"><div><b>${AOS.db() ? 'Sauvegardes dans le cloud' : 'Sauvegardes locales'}</b><p class="muted small">${AOS.db() ? 'Une sauvegarde automatique est créée chaque jour à l\'ouverture par le propriétaire ou un Éditeur. Les 10 plus récentes sont conservées.' : 'Mode local : les 3 dernières sauvegardes sont gardées dans ce navigateur. Exporte aussi un fichier JSON régulièrement.'}</p></div>
      ${canW ? '<button class="btn pri" data-a="snapnow">Sauvegarder maintenant</button>' : ''}</div></div>
    <div class="card">${snaps === null ? '<div class="empty">Chargement…</div>' : snaps.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Origine</th><th>Contenu</th><th class="r">Taille</th><th></th></tr></thead><tbody>${snaps.map(s => `<tr class="static"><td class="mono">${dTime(s.at)}</td><td>${esc(s.reason || '')}${s.partial ? ' <span class="tag">partielle</span>' : ''}</td><td class="muted small">${Object.entries(s.counts || {}).filter(([, n]) => n).map(([c, n]) => `${COL_LABEL[c] || c} ${n}`).join(' · ')}</td><td class="r mono">${Math.round((s.size || 0) / 1024)} Ko</td>
      <td class="r nowrap">${canW ? `<button class="btn sm" data-a="snaprestore" data-id="${s.id}">Restaurer</button> <button class="btn sm ghost" data-a="snapdl" data-id="${s.id}">${ic('download', 13)}</button> <button class="btn sm ghost" data-a="snapdel" data-id="${s.id}" aria-label="Supprimer">${ic('trash', 13)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty big">Aucune sauvegarde pour l\'instant.</div>'}</div>
    <div id="snapRestore"></div>
    <div class="card pad"><h3 class="h3">Base de données</h3><dl class="kv"><dt>Mode</dt><dd>${AOS.db() ? 'Synchronisé (serveur claude.ai)' : 'Local (ce navigateur uniquement)'}</dd><dt>Version du schéma</dt><dd class="mono">${sc ? sc.version : '1 (migration en attente d\'un administrateur)'} / ${AOS.SCHEMA_VERSION}</dd>
      <dt>Migrations</dt><dd>${sc && sc.history ? sc.history.map(h => `v${h.from} → v${h.to} le ${dTime(h.at)}`).join('<br>') : '—'}</dd></dl></div>`;
  };
  AOS.act.snapnow = async el => { el.disabled = true; try { await AOS.backup.createSnapshot('manuelle'); toast('Sauvegarde créée'); } catch (e) { toast('Sauvegarde impossible : ' + ((e && e.code) || 'erreur'), 'bad'); } refreshSnaps(); };
  AOS.act.snapdel = async el => { if (!(await AOS.confirm({ title: 'Supprimer cette sauvegarde ?', body: 'Elle ne pourra plus être restaurée.', ok: 'Supprimer', danger: 1 }))) return; await AOS.backup.deleteSnapshot(el.dataset.id); refreshSnaps(); };
  AOS.act.snapdl = async el => { const obj = await AOS.backup.loadSnapshot(el.dataset.id); if (!obj) { toast('Sauvegarde illisible.', 'bad'); return; } offerResult({ res: await AOS.backup.offer(`agency-os-${el.dataset.id}.json`, JSON.stringify(obj, null, 2)), text: JSON.stringify(obj, null, 2) }, 'sauvegarde.json'); };
  AOS.act.snaprestore = async el => { const obj = await AOS.backup.loadSnapshot(el.dataset.id); const box = document.getElementById('snapRestore'); if (!obj) { toast('Sauvegarde illisible.', 'bad'); return; } showRestore(box, obj, 'Sauvegarde du ' + dTime((snaps.find(s => s.id === el.dataset.id) || {}).at)); box.scrollIntoView({ behavior: 'smooth' }); };
  AOS.routeHooks.push(v => { if (v === 'param-sauvegardes') snaps = null; });

  /* ---------- Journal d'audit ---------- */
  let audit = null;
  const ACT = { create: 'Création', update: 'Modification', delete: 'Suppression', settings: 'Réglages', restore: 'Restauration', migration: 'Migration', backup: 'Sauvegarde', export: 'Export' };
  AOS.views['param-journal'] = function () {
    if (audit === null) { audit = []; AOS.backup.auditList(300).then(a => { audit = a; loadProfiles([...new Set(a.map(x => x.by))]); AOS.render(); }).catch(() => toast('Journal illisible.', 'bad')); }
    const q = (ui.auditQ || '').toLowerCase();
    const rows = audit.filter(a => !q || [a.label, a.col, ACT[a.act], who(a.by), (a.keys || []).join(' ')].join(' ').toLowerCase().includes(q));
    return H("Journal d'audit", '· 180 jours conservés.') +
    `<div class="toolbar"><input class="input" id="auditQ" placeholder="Filtrer : personne, fiche, action…" value="${esc(ui.auditQ || '')}"><button class="btn sm" data-a="auditreload">Actualiser</button></div>
    <div class="card tbl-wrap">${rows.length ? `<table><thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Élément</th><th>Champs modifiés</th></tr></thead><tbody>${rows.map(a => `<tr class="static"><td class="mono muted nowrap">${dTime(a.at)}</td><td>${esc(who(a.by))}<div class="faint small">${esc(a.role || '')}</div></td><td>${esc(ACT[a.act] || a.act)}</td><td>${esc(a.label || '')}<div class="faint small">${esc(a.col || '')}</div></td><td class="muted small">${esc((a.keys || []).join(', '))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty big">Aucune entrée.</div>'}</div>
    <p class="faint hint">Le journal enregistre qui a modifié quoi et quels champs, sans copier les valeurs (minimisation des données).</p>`;
  };
  AOS.inputs.auditQ = el => { ui.auditQ = el.value; AOS.render(); };
  AOS.act.auditreload = () => { audit = null; AOS.render(); };
  AOS.routeHooks.push(v => { if (v === 'param-journal') audit = null; });

  /* ---------- Intégrations ---------- */
  AOS.views['param-integrations'] = function () {
    const row = (name, st, c, txt) => `<div class="li"><div class="grow"><div class="title">${esc(name)}</div><div class="sub">${esc(txt)}</div></div>${pill(st, c)}</div>`;
    return H('Intégrations') + `<div class="card list">
      ${row('Base de données synchronisée', AOS.db() ? 'Active' : 'Inactive', AOS.db() ? 'var(--ok)' : 'var(--warn)', AOS.db() ? 'Stockage claude.ai, règles d\'accès appliquées côté serveur.' : 'Page ouverte hors claude.ai : stockage local uniquement.')}
      ${row('Téléchargement de fichiers', 'Active', 'var(--ok)', 'Exports JSON et CSV, avec confirmation à chaque téléchargement.')}
      ${row('Google Drive', 'Active', 'var(--ok)', 'Module Drive : connecteur Google Drive de claude.ai, avec le compte Google de chaque personne. Dossier de l\'agence : ' + (S.settings.driveRootName || 'non défini') + '.')}
      ${row('Google Calendar', 'Non disponible', 'var(--faint)', 'Prévu en phase 3, seulement si un connecteur est réellement disponible et autorisé.')}
      ${row('Assistant IA (Agency Copilot)', 'Phase 8', 'var(--faint)', 'Passera par l\'IA intégrée à claude.ai : aucune clé API stockée dans l\'application.')}
      ${row('Banque', 'Non prévu', 'var(--faint)', 'Aucune connexion bancaire n\'est simulée. Saisie manuelle et import CSV (phase 4).')}
      ${row('OnlyFans / plateformes', 'Non prévu', 'var(--faint)', 'Aucune API officielle utilisée. Revenus saisis ou importés.')}
      ${row('Messagerie / DM', 'Exclu', 'var(--faint)', 'Hors périmètre : géré par ton application dédiée.')}</div>`;
  };
})();
