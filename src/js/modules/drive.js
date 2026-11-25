/* Agency OS — Drive: the viewer's own Google Drive through the claude.ai connector (`mcp` capability).
   Browse, search, create folders, upload files and whole folders by drag-and-drop, link folders to créatrices.
   Calls run with the viewer's Google credentials; the app never sees a token. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, toast, sortBy, dShort } = AOS;
  const S = AOS.S, me = AOS.me;
  const SERVER = 'Google Drive', FOLDER = 'application/vnd.google-apps.folder', MAX = 20 * 1024 * 1024;
  const D = AOS.driveState = { mcp: undefined, stack: null, rootKey: null, files: null, next: null, loading: false, err: null, q: '', results: null, uploads: [], busy: false };

  /* ---------- connector access ---------- */
  async function mcp() {
    if (D.mcp === undefined) { try { D.mcp = window.claude && window.claude.use ? await window.claude.use('mcp') : null; } catch (e) { D.mcp = null; } }
    return D.mcp;
  }
  async function call(tool, input) {
    const m = await mcp(); if (!m) throw { code: 'unavailable' };
    const r = await m.callTool(SERVER, tool, input);
    return r && r.payload !== undefined ? r.payload : r;
  }
  const ERR = {
    unavailable: ['Drive indisponible ici', "Le Drive fonctionne uniquement quand l'application est ouverte dans claude.ai."],
    needs_reauth: ['Connexion Google Drive expirée', 'Reconnecte Google Drive dans claude.ai › Paramètres › Connecteurs, puis clique sur Réessayer.'],
    server_not_connected: ['Google Drive n\'est pas connecté', 'Ajoute le connecteur Google Drive dans claude.ai › Paramètres › Connecteurs, puis clique sur Réessayer.'],
    selection_required: ['Choisis ton compte Google Drive', 'Plusieurs connecteurs Google Drive existent : claude.ai te demande lequel utiliser.'],
    not_in_manifest: ['Accès au Drive non autorisé', "Tu as refusé ou désactivé Google Drive pour cette application. Réautorise-le dans les autorisations de l'application."],
    approval_required: ['Autorisation nécessaire', "claude.ai doit te demander l'accès à Google Drive. Ouvre l'application dans claude.ai et accepte la demande."],
    blocked_by_policy: ['Bloqué par ton organisation', "La politique de ton organisation n'autorise pas cet outil Google Drive."],
    server_unavailable: ['Google Drive ne répond pas', 'Réessaie dans un instant.']
  };
  const errInfo = e => { const c = e && e.code; return ERR[c] || ['Erreur Google Drive', (e && e.message) || 'Réponse inattendue du Drive.']; };
  AOS.driveErr = errInfo;

  const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const rootId = () => S.settings.driveRootId || 'root';
  const rootName = () => S.settings.driveRootName || 'Mon Drive';
  const urlOf = f => f.viewUrl || (f.id === 'root' ? 'https://drive.google.com/drive/my-drive' : (f.mimeType === FOLDER || !f.mimeType ? 'https://drive.google.com/drive/folders/' : 'https://drive.google.com/file/d/') + f.id);
  const here = () => { ensureStack(); return D.stack[D.stack.length - 1]; };
  const isFolder = f => f.mimeType === FOLDER;
  function kind(f) {
    const m = f.mimeType || '';
    if (isFolder(f)) return ['folder', 'Dossier'];
    if (m.startsWith('image/')) return ['image', 'Image'];
    if (m.startsWith('video/')) return ['video', 'Vidéo'];
    if (m === 'application/pdf') return ['file', 'PDF'];
    if (m.includes('document')) return ['file', 'Document'];
    if (m.includes('spreadsheet')) return ['file', 'Tableur'];
    return ['file', 'Fichier'];
  }

  /* ---------- reads ---------- */
  /* The stack follows the agency-folder setting; when it changes while browsing, re-root at that
     folder if it is on the current path, so the viewer never jumps away mid-action. */
  function ensureStack() {
    const key = rootId();
    if (!D.stack) { D.rootKey = key; D.stack = [{ id: key, title: rootName() }]; return; }
    if (D.rootKey !== key) {
      D.rootKey = key; const i = D.stack.findIndex(f => f.id === key);
      if (i >= 0) D.stack = D.stack.slice(i); else { D.stack = [{ id: key, title: rootName() }]; D.files = null; }
    }
  }
  async function load(more) {
    ensureStack(); D.loading = true; D.err = null; if (!more) { D.files = null; D.next = null; } AOS.render();
    const read = () => call('search_files', { query: `parentId = '${q(here().id)}'`, pageSize: 100, excludeContentSnippets: true, ...(more && D.next ? { pageToken: D.next } : {}) });
    try {
      let p; try { p = await read(); } catch (e) { if (e && e.retryable) { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); p = await read(); } else throw e; }
      D.files = [...(more ? D.files || [] : []), ...((p && p.files) || [])]; D.next = p && p.nextPageToken || null;
    } catch (e) { D.err = e; }
    D.loading = false; AOS.render();
  }
  async function search(term) {
    D.q = term; if (!term) { D.results = null; AOS.render(); return; }
    D.loading = true; AOS.render();
    try { const p = await call('search_files', { query: `title contains '${q(term)}'`, pageSize: 50, excludeContentSnippets: true }); D.results = (p && p.files) || []; D.err = null; }
    catch (e) { D.err = e; }
    D.loading = false; AOS.render();
  }
  AOS.driveOpen = function (folder) { ensureStack(); D.stack = folder.id === rootId() ? [D.stack[0]] : [D.stack[0], folder]; D.results = null; D.q = ''; D.files = null; location.hash === '#drive' ? load() : (location.hash = 'drive'); };

  /* ---------- writes ---------- */
  const b64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
  async function createFolder(title, parentId) {
    const f = await call('create_file', { title, contentMimeType: FOLDER, ...(parentId && parentId !== 'root' ? { parentId } : {}) });
    if (!f || !f.id) throw { code: 'tool_error', message: 'Le Drive n\'a pas renvoyé de dossier.' };
    return f;
  }
  function track(name) { const u = { name, st: 'wait', msg: '' }; D.uploads.unshift(u); D.uploads = D.uploads.slice(0, 60); return u; }
  async function uploadFile(file, parentId, label) {
    const u = track(label || file.name); renderUploads();
    if (file.size > MAX) { u.st = 'bad'; u.msg = 'Plus de 20 Mo : dépose-le directement sur drive.google.com'; renderUploads(); return false; }
    try {
      u.st = 'run'; renderUploads();
      await call('create_file', { title: file.name, contentMimeType: file.type || 'application/octet-stream', base64Content: await b64(file), disableConversionToGoogleType: true, ...(parentId && parentId !== 'root' ? { parentId } : {}) });
      u.st = 'ok'; renderUploads(); return true;
    } catch (e) {
      const amb = e && (e.code === 'server_unavailable' || e.code === 'upstream_error');
      u.st = amb ? 'warn' : 'bad'; u.msg = amb ? 'Résultat incertain : vérifie dans la liste avant de réessayer.' : errInfo(e)[1]; renderUploads(); return false;
    }
  }
  /* items: [{file, path}] where path is the relative folder path ('' for files at the top) */
  async function uploadTree(items) {
    if (!AOS.allowed('drive', 'c')) { toast('Ton rôle ne permet pas d\'importer.', 'bad'); return; }
    if (D.busy) { toast('Un import est déjà en cours.'); return; }
    D.busy = true; let ok = 0, ko = 0, base;
    try {
      base = here(); const folders = { '': base.id };
      for (const it of items) {
        let parent = folders[''];
        if (it.path) {
          let acc = '';
          for (const seg of it.path.split('/').filter(Boolean)) {
            const key = acc ? acc + '/' + seg : seg;
            if (!folders[key]) {
              const u = track('📁 ' + key); renderUploads();
              try { folders[key] = (await createFolder(seg, folders[acc])).id; u.st = 'ok'; }
              catch (e) { u.st = 'bad'; u.msg = errInfo(e)[1]; renderUploads(); folders[key] = null; }
              renderUploads();
            }
            acc = key; parent = folders[key]; if (!parent) break;
          }
          if (!parent) { ko++; continue; }
        }
        (await uploadFile(it.file, parent, (it.path ? it.path + '/' : '') + it.file.name)) ? ok++ : ko++;
      }
    } finally { D.busy = false; }
    AOS.audit({ act: 'create', col: 'drive', label: `${ok} fichier(s) importé(s) dans « ${base.title} »${ko ? `, ${ko} échec(s)` : ''}` });
    toast(ko ? `${ok} importé(s), ${ko} en échec` : `${ok} fichier(s) importé(s)`, ko ? 'bad' : '');
    if (AOS.currentView() === 'drive') load();
  }
  /* read a dropped folder recursively (File System entries API) */
  const readAll = dir => new Promise(res => { const r = dir.createReader(), out = []; const step = () => r.readEntries(b => { if (!b.length) return res(out); out.push(...b); step(); }, () => res(out)); step(); });
  const fileOf = entry => new Promise((res, rej) => entry.file(res, rej));
  async function walk(entry, path, out) {
    if (entry.isFile) out.push({ file: await fileOf(entry), path });
    else if (entry.isDirectory) { const sub = path ? path + '/' + entry.name : entry.name; const kids = await readAll(entry); if (!kids.length) out.push({ emptyDir: sub }); for (const k of kids) await walk(k, sub, out); }
  }

  /* ---------- view ---------- */
  function renderUploads() { const el = document.getElementById('driveUploads'); if (el) el.innerHTML = uploadsHtml(); }
  function uploadsHtml() {
    if (!D.uploads.length) return '';
    const L = { wait: ['En attente', 'var(--faint)'], run: ['Envoi…', 'var(--info)'], ok: ['Importé', 'var(--ok)'], warn: ['Incertain', 'var(--warn)'], bad: ['Échec', 'var(--bad)'] };
    return `<div class="card"><div class="card-h"><span class="lbl">${ic('upload', 14)}Imports récents</span><button class="linkbtn" data-a="driveclear">Effacer la liste</button></div><div class="list">${D.uploads.map(u => `<div class="li"><div class="grow"><div class="title">${esc(u.name)}</div>${u.msg ? `<div class="sub">${esc(u.msg)}</div>` : ''}</div>${AOS.pill(L[u.st][0], L[u.st][1])}</div>`).join('')}</div></div>`;
  }
  function errorCard(e) {
    const [t, m] = errInfo(e), c = e && e.code;
    return `<div class="card"><div class="empty big">${ic('drive', 22)}<h3>${esc(t)}</h3><p>${esc(m)}</p><div class="actions center">${c !== 'unavailable' ? '<button class="btn pri" data-a="drivereload">Réessayer</button>' : ''}${c === 'not_in_manifest' || c === 'approval_required' ? '<button class="btn" data-a="driveperms">Autorisations de l\'application</button>' : ''}</div></div></div>`;
  }
  function rows(list, showPath) {
    const canU = AOS.allowed('creators', 'u') && AOS.can(me.role, 'drive', 'u');
    const linked = id => S.creators.find(c => c.driveFolderId === id);
    return `<div class="tbl-wrap"><table class="drive"><thead><tr><th>Nom</th><th>Type</th><th>Modifié</th><th></th></tr></thead><tbody>
      ${sortBy(list, f => (isFolder(f) ? '0' : '1') + (f.title || '').toLowerCase()).map(f => { const [i, k] = kind(f), cr = isFolder(f) && linked(f.id); return `<tr class="${isFolder(f) ? '' : 'static'}" ${isFolder(f) ? `data-a="drivecd" data-id="${esc(f.id)}" data-t="${esc(f.title)}" data-u="${esc(f.viewUrl || '')}"` : ''}>
        <td><div class="who"><span class="ficon ${i}">${ic(i, 16)}</span>${isFolder(f) ? `<b class="strong">${esc(f.title)}</b>` : `<a class="flink" href="${esc(urlOf(f))}" target="_blank" rel="noopener">${esc(f.title)}</a>`}${cr ? ` <span class="tag">${esc(cr.name)}</span>` : ''}</div></td>
        <td class="muted">${k}</td><td class="muted mono">${f.modifiedTime ? dShort(f.modifiedTime.slice(0, 10)) : ''}</td>
        <td class="r nowrap">${isFolder(f) && canU ? `<button class="btn sm ghost" data-a="drivelink" data-id="${esc(f.id)}" data-t="${esc(f.title)}" data-u="${esc(f.viewUrl || '')}">${ic('link', 13)}Lier</button>` : ''}<a class="btn sm ghost" href="${esc(urlOf(f))}" target="_blank" rel="noopener" title="Ouvrir dans Google Drive">${ic('ext', 13)}</a></td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
  AOS.views.drive = function () {
    ensureStack();
    if (D.files === null && !D.loading && !D.err && D.mcp !== null) setTimeout(load, 0);
    const cur = here(), canC = AOS.allowed('drive', 'c'), canRoot = AOS.can(me.role, 'parametres', 'u') && (me.isOwner || me.canEdit);
    const linkedCr = S.creators.find(c => c.driveFolderId === cur.id);
    const head = AOS.header({ eyebrow: 'Agence · Google Drive', title: `${esc(cur.title)}${linkedCr ? ` <span class="soft">· ${esc(linkedCr.name)}</span>` : ''}`,
      actions: `<a class="btn" href="${esc(cur.url || urlOf({ id: cur.id, mimeType: FOLDER }))}" target="_blank" rel="noopener">${ic('ext', 15)}Ouvrir dans Drive</a>${canC ? `<button class="btn" data-a="drivemkdir">${ic('folder', 15)}Nouveau dossier</button><label class="btn pri" for="driveFiles">${ic('upload', 15)}Importer</label>` : ''}` });
    if (D.mcp === null || (D.err && !D.files)) return head + errorCard(D.err || { code: 'unavailable' });
    const crumbs = `<nav class="crumbs" aria-label="Dossiers">${D.stack.map((f, i) => i === D.stack.length - 1 ? `<span>${esc(f.title)}</span>` : `<button class="linkbtn" data-a="driveup" data-i="${i}">${esc(f.title)}</button>${ic('chev', 13)}`).join('')}</nav>`;
    const list = D.results !== null ? D.results : D.files;
    return head +
    (!S.settings.driveRootId && canRoot ? `<div class="banner info">${ic('drive', 15)}<span>Choisis le dossier principal de ton agence : ouvre-le ci-dessous puis clique sur <b>Définir comme dossier de l'agence</b>. Tout le monde partira de là.</span></div>` : '') +
    `<div class="toolbar">${crumbs}<span class="grow"></span>
      <form id="driveSearch" class="srch"><input class="input" name="q" value="${esc(D.q)}" placeholder="Rechercher dans tout le Drive…" aria-label="Rechercher dans le Drive">${D.results !== null ? '<button type="button" class="btn sm ghost" data-a="drivesearchclear">Effacer</button>' : ''}</form></div>
    <div class="toolbar">
      ${canRoot && cur.id !== rootId() ? `<button class="btn sm" data-a="driveroot">${ic('star', 13)}Définir comme dossier de l'agence</button>` : ''}
      ${AOS.allowed('creators', 'u') && AOS.can(me.role, 'drive', 'u') && cur.id !== 'root' ? `<button class="btn sm" data-a="drivelink" data-id="${esc(cur.id)}" data-t="${esc(cur.title)}" data-u="${esc(cur.url || '')}">${ic('link', 13)}${linkedCr ? 'Changer la créatrice liée' : 'Lier ce dossier à une créatrice'}</button>` : ''}
      ${canC ? `<label class="btn sm ghost" for="driveDir">${ic('folder', 13)}Importer un dossier</label>` : ''}</div>
    <div class="card dropzone ${canC ? '' : 'ro'}" id="driveDrop">
      ${canC ? `<div class="drophint">${ic('upload', 18)}<span>Glisse ici des fichiers ou des dossiers entiers (photos, vidéos, contrats…). Ils seront importés dans <b>${esc(cur.title)}</b>. 20 Mo maximum par fichier.</span></div>` : ''}
      ${D.loading && !list ? '<div class="empty">Chargement du Drive…</div>' : D.err ? `<div class="banner bad">${esc(errInfo(D.err)[1])} <button class="btn sm" data-a="drivereload">Réessayer</button></div>` : ''}
      ${list ? (list.length ? rows(list) : `<div class="empty">${D.results !== null ? 'Aucun fichier trouvé.' : 'Ce dossier est vide.'}</div>`) : ''}
      ${D.next && D.results === null ? `<div class="card-b"><button class="btn sm" data-a="drivemore">Charger plus</button></div>` : ''}
    </div>
    <div id="driveUploads">${uploadsHtml()}</div>
    <p class="faint hint">Chaque personne voit son propre Google Drive : partage le dossier de l'agence avec ton équipe dans Google Drive pour qu'elle y accède. Rien n'est stocké dans LVH Master, à part le lien entre un dossier et une créatrice.</p>`;
  };
  AOS.routeHooks.push(v => { if (v === 'drive') { D.err = null; D.files = null; } });

  /* ---------- actions ---------- */
  Object.assign(AOS.act, {
    drivereload: () => { D.err = null; D.mcp = D.mcp === null ? undefined : D.mcp; load(); },
    drivemore: () => load(true),
    drivecd: el => { D.stack.push({ id: el.dataset.id, title: el.dataset.t, url: el.dataset.u }); D.results = null; D.q = ''; load(); },
    driveup: el => { D.stack = D.stack.slice(0, +el.dataset.i + 1); D.results = null; D.q = ''; load(); },
    driveclear: () => { D.uploads = []; renderUploads(); },
    drivesearchclear: () => search(''),
    driveperms: async () => { try { const p = await window.claude.use('permissions'); await p.manage(); } catch (e) { toast('Ouvre le menu Autorisations de l\'application dans claude.ai.'); } },
    drivemkdir: async () => {
      const name = await AOS.ask({ title: 'Nouveau dossier', label: 'Nom du dossier', ok: 'Créer' }); if (!name) return;
      try { await createFolder(name, here().id); AOS.audit({ act: 'create', col: 'drive', label: `Dossier « ${name} » créé dans « ${here().title} »` }); toast('Dossier créé'); load(); }
      catch (e) { toast(errInfo(e)[1], 'bad'); if (e && (e.code === 'server_unavailable' || e.code === 'upstream_error')) load(); }
    },
    driveroot: async () => {
      const cur = here();
      if (!(await AOS.confirm({ title: 'Dossier principal de l\'agence', body: `« ${esc(cur.title)} » deviendra le point de départ du Drive pour toute l'équipe.`, ok: 'Définir' }))) return;
      if (await AOS.setDoc('settings/agency', { ...S.settings, driveRootId: cur.id, driveRootName: cur.title }, 'settings')) toast('Dossier de l\'agence défini');
    },
    drivelink: async el => {
      const id = el.dataset.id, title = el.dataset.t, url = el.dataset.u;
      const cid = await AOS.ask({ title: `Lier « ${title} »`, label: 'Créatrice', ok: 'Lier', options: [['', '— Aucune —'], ...sortBy(S.creators, c => c.name).map(c => [c.id, c.name])], value: (S.creators.find(c => c.driveFolderId === id) || {}).id || '' });
      if (cid === null) return;
      for (const c of S.creators.filter(c => c.driveFolderId === id && c.id !== cid)) { const { driveFolderId, driveFolderName, driveFolderUrl, ...rest } = c; await AOS.save('creators', rest); }
      if (cid) { const c = S.creators.find(x => x.id === cid); await AOS.save('creators', { ...c, driveFolderId: id, driveFolderName: title, driveFolderUrl: url || '' }); toast(`Dossier lié à ${c.name}`); }
      AOS.render();
    }
  });
  AOS.changes.driveFiles = el => { const fs = [...el.files]; el.value = ''; if (fs.length) uploadTree(fs.map(file => ({ file, path: '' }))); };
  AOS.changes.driveDir = el => { const fs = [...el.files]; el.value = ''; if (fs.length) uploadTree(fs.map(file => ({ file, path: (file.webkitRelativePath || '').split('/').slice(0, -1).join('/') }))); };
  AOS.afterRender.drive = () => {
    const f = document.getElementById('driveSearch'); if (f) f.onsubmit = e => { e.preventDefault(); search(f.q.value.trim()); };
    const z = document.getElementById('driveDrop'); if (!z || z.classList.contains('ro')) return;
    z.ondragover = e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); z.classList.add('drag'); } };
    z.ondragleave = e => { if (!z.contains(e.relatedTarget)) z.classList.remove('drag'); };
    z.ondrop = async e => {
      e.preventDefault(); z.classList.remove('drag');
      const items = [...(e.dataTransfer.items || [])], entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      const out = [];
      if (entries.length) for (const en of entries) await walk(en, '', out);
      else for (const file of e.dataTransfer.files) out.push({ file, path: '' });
      const files = out.filter(o => o.file);
      if (!files.length) { toast('Rien à importer (dossier vide ?).'); return; }
      uploadTree(files);
    };
  };

  /* ---------- créatrice ↔ Drive (used by the créatrice fiche) ---------- */
  AOS.driveSection = function (c) {
    if (!AOS.modOn('drive')) return '';
    if (c.driveFolderId) return `<div class="sec"><h5>${ic('drive', 12)} Dossier Drive</h5><div class="card pad row-between"><span class="strong">${esc(c.driveFolderName || 'Dossier')}</span><span class="actions"><button class="btn sm" data-a="driveopencr" data-id="${c.id}">Ouvrir ici</button><a class="btn sm ghost" href="${esc(c.driveFolderUrl || 'https://drive.google.com/drive/folders/' + c.driveFolderId)}" target="_blank" rel="noopener">${ic('ext', 13)}Drive</a></span></div></div>`;
    return AOS.allowed('drive', 'c') && AOS.allowed('creators', 'u') ? `<div class="sec"><h5>${ic('drive', 12)} Dossier Drive</h5><div class="card pad row-between"><span class="muted small">Aucun dossier lié.</span><button class="btn sm" data-a="drivemkcr" data-id="${c.id}">Créer son dossier dans « ${esc(rootName())} »</button></div></div>` : '';
  };
  AOS.act.driveopencr = el => { const c = S.creators.find(x => x.id === el.dataset.id); AOS.closeDrawer(); AOS.driveOpen({ id: c.driveFolderId, title: c.driveFolderName || c.name, url: c.driveFolderUrl }); };
  AOS.act.drivemkcr = async el => {
    const c = S.creators.find(x => x.id === el.dataset.id); if (!c) return;
    el.disabled = true;
    try {
      const f = await createFolder(c.name, rootId());
      await AOS.save('creators', { ...c, driveFolderId: f.id, driveFolderName: f.title || c.name, driveFolderUrl: f.viewUrl || '' });
      AOS.audit({ act: 'create', col: 'drive', label: `Dossier Drive créé pour ${c.name}` });
      toast(`Dossier « ${c.name} » créé dans ${rootName()}`);
    } catch (e) { el.disabled = false; toast(errInfo(e)[1], 'bad'); }
  };
})();
