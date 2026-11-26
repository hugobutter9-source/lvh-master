/* Sync between a person's own devices.
   The device stays the working copy (the app opens and saves without a connection). Every change is also
   queued and sent to the person's private rows in the portal database; other devices fetch "what changed
   since" and apply it. Per record, the last write to reach the server wins. Only the person can read
   these rows (see the crm_records access rules); appearance and favourites stay per device. */
(function (g) {
  const AOS = g.AOS, S = AOS.S;
  const K = { queue: 'lvh.sync.queue', cursor: 'lvh.sync.cursor', user: 'lvh.sync.user', on: 'lvh.sync.on' };
  const DOCS = { 'settings/agency': 'settings_agency', 'settings/lists': 'settings_lists', 'settings/org': 'settings_org', 'meta/schema': 'meta_schema' };
  const PATHS = Object.fromEntries(Object.entries(DOCS).map(([p, i]) => [i, p]));
  const COLS = () => AOS.BACKUP_COLS;
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  const Y = AOS.sync = { busy: false, error: '', last: 0, queue: get(K.queue, {}), pendingOther: false };
  const pending = () => Object.keys(Y.queue).length;
  const uid = () => { const L = AOS.portalLink; return L && L.me ? L.me.id : null; };
  const wanted = () => get(K.on, true) !== false;
  /* on = linked to an account, allowed on this device, and this device's data belongs to that account */
  Y.on = () => !!uid() && wanted() && get(K.user, null) === uid() && AOS.status.mode === 'local';
  Y.pending = pending;

  /* ---------- outgoing: every local write is queued (latest version per record) ---------- */
  AOS.syncEnqueue = function (ops) {
    if (!get(K.user, null)) return;   // a device that was never linked keeps nothing in a queue: the first link sends everything
    let n = 0;
    for (const o of ops) {
      let col, id, row;
      if (o.path) { if (!DOCS[o.path]) continue; col = '_doc'; id = DOCS[o.path]; row = { data: o.path === 'settings/agency' ? S.settings : (o.data || {}), deleted: false }; }
      else { if (!COLS().includes(o.col) || !o.id) continue; col = o.col; id = String(o.id); row = o.op === 'delete' ? { data: {}, deleted: true } : { data: o.data || {}, deleted: false }; }
      Y.queue[col + '/' + id] = { col, id, ...row }; n++;
    }
    if (!n) return;
    set(K.queue, Y.queue);
    if (Y.on()) later(900);
    if (AOS.renderStatus) AOS.renderStatus();
  };
  let timer = 0;
  function later(ms) { clearTimeout(timer); timer = setTimeout(() => Y.now(), ms); }

  async function push(c, me) {
    const keys = Object.keys(Y.queue);
    for (let i = 0; i < keys.length; i += 200) {
      const part = keys.slice(i, i + 200), rows = part.map(k => ({ user_id: me, col: Y.queue[k].col, id: Y.queue[k].id, data: Y.queue[k].data, deleted: !!Y.queue[k].deleted }));
      const sent = Object.fromEntries(part.map(k => [k, Y.queue[k]]));
      const { error } = await c.from('crm_records').upsert(rows, { onConflict: 'user_id,col,id' });
      if (error) throw error;
      for (const k of part) if (Y.queue[k] === sent[k]) delete Y.queue[k];   // keep what changed again while it was being sent
      set(K.queue, Y.queue);
    }
  }
  /* ---------- incoming: what changed on the server since the last look ---------- */
  async function pull(c, me, onRow) {
    let cursor = get(K.cursor, null), seen = 0;
    for (;;) {
      let q = c.from('crm_records').select('col, id, data, deleted, updated_at').eq('user_id', me).order('updated_at', { ascending: true }).limit(500);
      if (cursor) q = q.gt('updated_at', cursor);
      const { data, error } = await q; if (error) throw error;
      if (!data.length) break;
      const ops = [];
      for (const r of data) {
        if (onRow) onRow(r);
        if (Y.queue[r.col + '/' + r.id]) continue;            // a newer local change is waiting to be sent
        if (r.col === '_doc') { if (PATHS[r.id] && !r.deleted) ops.push({ op: 'set', path: PATHS[r.id], data: r.data }); }
        else if (COLS().includes(r.col)) {
          const cur = (S[r.col] || []).find(x => x.id === r.id);
          if (r.deleted) { if (cur) ops.push({ op: 'delete', col: r.col, id: r.id }); }
          else if (!cur || JSON.stringify(cur) !== JSON.stringify({ ...r.data, id: r.id })) ops.push({ op: 'set', col: r.col, id: r.id, data: r.data });
        }
      }
      if (ops.length) AOS.applyRemote(ops);
      seen += data.length; cursor = data[data.length - 1].updated_at; set(K.cursor, cursor);
      if (data.length < 500) break;
    }
    return seen;
  }

  /* ---------- one round: first link merges, later rounds exchange changes ---------- */
  Y.now = async function () {
    const c = AOS.portalClient && AOS.portalClient(), me = uid();
    if (!c || !me || !Y.on() || Y.busy) return false;
    if (g.navigator && navigator.onLine === false) { Y.error = 'offline'; if (AOS.renderStatus) AOS.renderStatus(); return false; }
    Y.busy = true; if (AOS.renderStatus) AOS.renderStatus();
    try {
      if (!get(K.cursor, null)) {
        /* first time on this device: take what the account already has, then add what only this device has */
        const have = new Set();
        await pull(c, me, r => have.add(r.col + '/' + r.id));
        const ops = [];
        for (const col of COLS()) for (const r of S[col] || []) if (!have.has(col + '/' + r.id) && !r.demo) ops.push({ op: 'set', col, id: r.id, data: r });
        if (!have.has('_doc/settings_agency')) ops.push({ op: 'set', path: 'settings/agency', data: S.settings });
        if (!have.has('_doc/settings_lists') && S.listsStored) ops.push({ op: 'set', path: 'settings/lists', data: S.listsStored });
        if (!have.has('_doc/settings_org') && S.orgLayout) ops.push({ op: 'set', path: 'settings/org', data: S.orgLayout });
        if (!have.has('_doc/meta_schema') && S.schema) ops.push({ op: 'set', path: 'meta/schema', data: S.schema });
        const mine = { ...Y.queue }; Y.queue = {}; AOS.syncEnqueue(ops); Object.assign(Y.queue, mine); set(K.queue, Y.queue);
        if (!get(K.cursor, null)) set(K.cursor, '1970-01-01T00:00:00Z');
      }
      if (pending()) await push(c, me);
      await pull(c, me);
      Y.error = ''; Y.last = Date.now();
    } catch (e) { Y.error = /fetch|network|load failed/i.test((e && e.message) || '') ? 'offline' : 'server'; }
    finally { Y.busy = false; if (AOS.renderStatus) AOS.renderStatus(); }
    return !Y.error;
  };

  /* called when the portal account is known (after sign-in, and at start from the saved session) */
  AOS.syncKick = function () {
    const me = uid(); if (!me || AOS.status.mode !== 'local') return;
    const prev = get(K.user, null);
    if (prev && prev !== me) { Y.pendingOther = true; if (AOS.renderStatus) AOS.renderStatus(); return; }   // another account's data is on this device: ask first
    if (!prev) { set(K.user, me); set(K.cursor, undefined); }
    Y.pendingOther = false;
    if (Y.on()) Y.now();
  };
  /* the person confirms that this device's data goes to the account that is now signed in */
  Y.adopt = function () { const me = uid(); if (!me) return; set(K.user, me); set(K.cursor, undefined); Y.pendingOther = false; set(K.on, true); Y.now(); };
  Y.setWanted = function (v) { set(K.on, !!v); if (v) Y.now(); if (AOS.renderStatus) AOS.renderStatus(); };
  Y.wanted = wanted;
  AOS.syncStop = function () { clearTimeout(timer); Y.error = ''; if (AOS.renderStatus) AOS.renderStatus(); };

  setInterval(() => { if (document.visibilityState === 'visible' && Y.on()) Y.now(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Y.on()) Y.now(); });
  g.addEventListener('online', () => { if (Y.on()) Y.now(); });
  /* look for a saved session even when the app opens on a page that does not show the portal */
  setTimeout(() => { if (AOS.portalTouch) AOS.portalTouch(); }, 0);
})(window);
