/* Agency OS — data layer.
   Synced mode: the artifact `db` capability (server-side rules by sharing level, live snapshots).
   Local mode: browser storage on this device only, used when the page runs outside claude.ai. */
(function (g) {
  const AOS = g.AOS = g.AOS || {};
  const LS = 'agencyos.v2', LS_V1 = 'agencyos.v1', LS_PREFS = 'agencyos.prefs';
  const LIVE = ['creators', 'team', 'tasks', 'events', 'finances', 'notes', 'payroll', 'goals', 'calls', 'leaves', 'scripts', 'depts', 'students', 'snotes', 'roles', 'users'];

  const S = AOS.S = { creators: [], team: [], tasks: [], events: [], finances: [], notes: [], payroll: [], goals: [], calls: [], leaves: [], scripts: [], depts: [], students: [], snotes: [], roles: [], users: [],
    settings: { name: 'Mon agence', owner: '', currency: 'EUR', moduleNames: {} }, listsStored: null, orgLayout: null, schema: null, audit: [], prefs: {} };
  const status = AOS.status = { mode: 'starting', loaded: false, pending: 0, fromCache: true, error: null, readOnly: false };
  const me = AOS.me = { uid: null, isOwner: false, canEdit: false, local: false, role: null };
  let DB = null, USER = null, listsCache = null;
  const listeners = new Set(), queues = {}, cacheFlags = {};

  AOS.onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  function emit() { listsCache = null; me.role = AOS.resolveRole(me, S.users, S.roles); listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  AOS.lists = () => listsCache || (listsCache = AOS.mergeLists(S.listsStored, S));
  AOS.db = () => DB;
  AOS.userCap = () => USER;

  /* ---------- local persistence ---------- */
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function saveLocal() {
    const { prefs, ...rest } = S;
    if (!lsSet(LS, rest)) { status.error = 'Stockage du navigateur plein ou bloqué : exporte une sauvegarde.'; }
  }
  function loadLocal() {
    const d = lsGet(LS) || lsGet(LS_V1);
    if (d) for (const k of Object.keys(d)) if (k in S) S[k] = d[k];
    S.prefs = lsGet(LS_PREFS) || {};
  }

  /* ---------- write primitives ---------- */
  const pathOf = o => o.path || (o.col + '/' + o.id);
  function enqueue(path, fn) {
    const run = (queues[path] || Promise.resolve()).then(fn, fn);
    queues[path] = run.catch(() => {});
    return run;
  }
  function errText(e) {
    const c = e && e.code;
    if (c === 'invalid_argument') return "Le serveur a refusé l'enregistrement : ton niveau d'accès (menu Partager) ne le permet pas.";
    if (c === 'quota_exceeded') return 'Espace de stockage plein : supprime des fiches ou d\'anciennes sauvegardes.';
    if (c === 'resource_exhausted') return 'Trop d\'enregistrements d\'un coup. Patiente quelques secondes.';
    if (c === 'revoked') return 'Ton accès a changé. Recharge la page.';
    return "L'enregistrement a échoué. Vérifie ta connexion et réessaie.";
  }
  function localApply(o) {
    if (o.path) {
      if (o.path === 'settings/agency') S.settings = { ...S.settings, ...o.data };
      else if (o.path === 'settings/lists') S.listsStored = o.data;
      else if (o.path === 'settings/org') S.orgLayout = o.data;
      else if (o.path === 'meta/schema') S.schema = o.data;
      return;
    }
    const arr = S[o.col] = S[o.col] || [];
    const i = arr.findIndex(x => x.id === o.id);
    if (o.op === 'delete') { if (i >= 0) arr.splice(i, 1); }
    else { const r = { ...o.data, id: o.id }; i >= 0 ? arr[i] = r : arr.push(r); }
  }
  /* Apply ops one by one. Returns {ok, failed, error}. Never throws. */
  async function applyOps(ops, opts = {}) {
    let ok = 0, failed = 0, error = null;
    if (!DB) {
      ops.forEach(localApply); ok = ops.length; saveLocal(); emit();
      if (AOS.syncEnqueue && !opts.remote) AOS.syncEnqueue(ops);   // also sent to the person's other devices
    } else {
      for (const o of ops) {
        const p = pathOf(o);
        status.pending++; emitStatus();
        try {
          await enqueue(p, () => o.op === 'delete' ? DB.doc(p).delete() : DB.doc(p).set(stripId(o.data)));
          ok++;
        } catch (e) { failed++; error = e; if (opts.stopOnError) { status.pending--; break; } }
        status.pending--; emitStatus();
        if (opts.onProgress) opts.onProgress(ok + failed, ops.length);
      }
    }
    if (error) { status.error = errText(error); AOS.toast(status.error, 'bad'); }
    return { ok, failed, error };
  }
  const stripId = d => { const { id, ...b } = d || {}; return b; };
  function emitStatus() { if (AOS.renderStatus) AOS.renderStatus(); }

  /* ---------- audit ---------- */
  async function audit(entry) {
    const e = { at: Date.now(), by: me.uid || (me.local ? 'local' : 'inconnu'), role: me.role ? me.role.name : '', ...entry };
    if (!DB) { S.audit.unshift({ id: AOS.uid(), ...e }); S.audit = S.audit.slice(0, 500); saveLocal(); return; }
    if (!me.uid) return;
    /* each person appends to their own audit/{uid}/entries; only Éditeurs and the owner read across people */
    try { await DB.collection('audit/' + me.uid + '/entries').doc(AOS.uid()).set(e); } catch (err) { /* best-effort: the write itself already succeeded */ }
  }
  AOS.audit = audit;

  /* ---------- record API used by modules ---------- */
  const labelOf = r => r && (r.name || r.title || r.label || r.id) || '';
  function allowed(col, act) {
    const mod = AOS.COL_MODULE[col];
    if (col === 'payroll') return AOS.flag(me.role, 'salary_view') && AOS.can(me.role, 'equipe', 'u');
    if (col === 'finances' && !AOS.flag(me.role, 'finance_view')) return false;
    return AOS.can(me.role, mod, act);
  }
  AOS.allowed = allowed;
  async function save(col, rec, opts = {}) {
    const prev = rec.id ? S[col].find(x => x.id === rec.id) : null;
    if (!allowed(col, prev ? 'u' : 'c')) { AOS.toast("Ton rôle ne permet pas cette modification.", 'bad'); return null; }
    const r = { ...rec, id: rec.id || AOS.uid(), updatedAt: Date.now() };
    if (!prev) { r.createdAt = r.createdAt || r.updatedAt; r.createdBy = r.createdBy || me.uid || 'local'; }
    if (col === 'leaves' && prev && prev.status !== r.status) { r.decidedAt = Date.now(); r.decidedBy = me.uid || 'local'; }
    const res = await applyOps([{ op: 'set', col, id: r.id, data: r }]);
    if (!res.ok) return null;
    /* a ticked repeating task brings the next one (see repeatOps) */
    if (col === 'tasks' && AOS.repeatOps) {
      const more = AOS.repeatOps(prev, r, AOS.lists(), S.tasks, AOS.today());
      if (more.length && (await applyOps(more)).ok && more[0].op === 'set') AOS.toast(`Tâche répétée : la prochaine est prévue ${AOS.dueTxt ? AOS.dueTxt(more[0].data.due) : more[0].data.due}`);
    }
    if (!opts.silentAudit) {
      const keys = prev ? Object.keys({ ...prev, ...r }).filter(k => !['updatedAt', 'id'].includes(k) && JSON.stringify(prev[k]) !== JSON.stringify(r[k])) : [];
      audit({ act: prev ? 'update' : 'create', col, docId: r.id, label: labelOf(r), keys });
    }
    return r.id;
  }
  async function remove(col, id) {
    const prev = S[col].find(x => x.id === id);
    if (!allowed(col, 'd')) { AOS.toast("Ton rôle ne permet pas la suppression.", 'bad'); return false; }
    const res = await applyOps([{ op: 'delete', col, id }]);
    if (res.ok) audit({ act: 'delete', col, docId: id, label: labelOf(prev) });
    return !!res.ok;
  }
  async function setDoc(path, data, act) {
    const res = await applyOps([{ op: 'set', path, data }]);
    if (res.ok && act) audit({ act, col: path, label: act === 'settings' ? path : '' });
    return !!res.ok;
  }
  async function savePrefs(patch) {
    S.prefs = { ...S.prefs, ...patch };
    if (DB && me.uid) {
      try { await enqueue('prefs', () => DB.doc('data/users/' + me.uid + '/prefs').set(S.prefs)); } catch (e) { lsSet(LS_PREFS, S.prefs); }
    } else lsSet(LS_PREFS, S.prefs);
    emit();
  }
  Object.assign(AOS, { save, remove, setDoc, savePrefs, applyOps });
  /* changes that arrive from another device of the same person: applied here, not sent back */
  AOS.applyRemote = ops => { if (!DB) { ops.forEach(localApply); saveLocal(); emit(); } };

  /* ---------- private per-person documents (data/users/{uid}/{name}) ----------
     Only the person can read or write them (server rule). Used by Ma journée and Notifications. */
  const udocs = S.udocs = {}, watching = new Set();
  AOS.udoc = function (name) {
    if (status.mode === 'starting') return {};      // storage not chosen yet: subscribe on the next render
    if (!watching.has(name)) {
      watching.add(name);
      if (DB && me.uid) DB.doc('data/users/' + me.uid + '/' + name).onSnapshot(s => { udocs[name] = s.exists ? { ...s.data() } : {}; schedule(); }, () => { udocs[name] = {}; schedule(); });
      else { udocs[name] = lsGet('agencyos.u.' + name) || {}; }
    }
    return udocs[name];
  };
  AOS.setUdoc = async function (name, data) {
    udocs[name] = data;
    if (DB && me.uid) { try { await enqueue('u/' + name, () => DB.doc('data/users/' + me.uid + '/' + name).set(data)); } catch (e) { AOS.toast(errText(e), 'bad'); return false; } }
    else lsSet('agencyos.u.' + name, data);
    schedule(); return true;
  };

  /* ---------- migrations & maintenance (admin only) ---------- */
  async function maybeMigrate() {
    const plan = AOS.planMigration({ ...S, listsStored: S.listsStored }, Date.now());
    if (!plan.ops.length) return;
    if (!(me.isOwner || me.canEdit || me.local)) return; // others keep working on in-memory defaults
    if (DB) {
      try { const l = await DB.doc('meta/schema').acquire({ holder: me.uid || 'x', ttlMs: 60000 }); if (!l.acquired) return; } catch (e) { return; }
    }
    if (DB && AOS.backup) {   // never migrate without a restorable copy of the previous state
      try { await AOS.backup.createSnapshot('avant migration v' + plan.from + ' → v' + plan.to); }
      catch (e) { status.error = 'Migration reportée : sauvegarde préalable impossible.'; emitStatus(); return; }
    }
    /* on a device, keep an untouched copy of the data as it was before the update */
    if (!DB) { try { const raw = localStorage.getItem(LS); if (raw) localStorage.setItem(LS + '.avant-v' + plan.to, raw); } catch (e) { } }
    const res = await applyOps(plan.ops, { stopOnError: true });
    if (res.ok === plan.ops.length) { audit({ act: 'migration', label: `Données migrées de la version ${plan.from} à ${plan.to}` }); AOS.toast(`Base de données mise à jour (version ${plan.to}).`); }
  }

  /* ---------- boot ---------- */
  AOS.initStore = async function () {
    let db = null, user = null;
    try {
      const use = g.claude && g.claude.use;
      if (use) [db, user] = await Promise.all([g.claude.use('db'), g.claude.use('user')]);
    } catch (e) { db = null; }
    if (!db) {
      status.mode = 'local'; Object.assign(me, { local: true, isOwner: true, canEdit: true, uid: 'local' });
      loadLocal(); status.loaded = true; status.fromCache = false; emit();
      await maybeMigrate(); return;
    }
    DB = db; USER = user; status.mode = 'db';
    try { me.uid = user ? await user.id() : null; me.isOwner = user ? !!(await user.isOwner()) : false; me.canEdit = user ? !!(await user.canEdit()) : false; } catch (e) { }
    status.readOnly = !me.uid;
    const pending = new Set([...LIVE, 'settings/agency', 'settings/lists', 'settings/org', 'meta/schema']);
    const done = k => { if (pending.delete(k) && !pending.size) { status.loaded = true; afterLoad(); } };
    const track = (k, md) => { cacheFlags[k] = !!(md && md.fromCache); status.fromCache = Object.values(cacheFlags).some(Boolean); };
    for (const c of LIVE) {
      db.collection(c).onSnapshot(s => { S[c] = s.docs.map(d => ({ ...d.data(), id: d.id })); track(c, s.metadata); done(c); schedule(); },
        e => { status.error = 'Synchronisation interrompue (' + c + '). Recharge la page.'; done(c); schedule(); });
    }
    const docSub = (path, apply) => db.doc(path).onSnapshot(s => { apply(s.exists ? s.data() : null); track(path, s.metadata); done(path); schedule(); }, () => { done(path); schedule(); });
    docSub('settings/agency', d => { if (d) S.settings = { ...S.settings, ...d }; });
    docSub('settings/lists', d => { S.listsStored = d; });
    docSub('settings/org', d => { S.orgLayout = d; });
    docSub('meta/schema', d => { S.schema = d; });
    if (me.uid) db.doc('data/users/' + me.uid + '/prefs').onSnapshot(s => { if (s.exists) { S.prefs = { ...s.data() }; schedule(); } }, () => {});
    else S.prefs = lsGet(LS_PREFS) || {};
    setTimeout(() => { if (!status.loaded) { status.loaded = true; status.error = 'Chargement lent : certaines données peuvent manquer.'; schedule(); } }, 8000);
  };
  let raf = 0;
  function schedule() { if (typeof requestAnimationFrame === 'undefined') return emit(); cancelAnimationFrame(raf); raf = requestAnimationFrame(emit); }
  async function afterLoad() {
    emit();
    if (me.isOwner && me.uid && S.settings.ownerUid !== me.uid) await applyOps([{ op: 'set', path: 'settings/agency', data: { ...S.settings, ownerUid: me.uid } }]);
    if (me.isOwner || me.canEdit) {
      await maybeMigrate();
      if (AOS.backup) { AOS.backup.autoSnapshot().catch(() => {}); AOS.backup.pruneAudit().catch(() => {}); }
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
