/* Agency OS — pure business logic (lists, permissions, finance maths, migrations, backup format).
   No DOM, no I/O: every function takes the state it needs, so it runs in Node tests too. */
(function (g) {
  const AOS = g.AOS = g.AOS || {};
  const SCHEMA_VERSION = 6;
  AOS.SCHEMA_VERSION = SCHEMA_VERSION;
  const SEG = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- customisable lists ---------- */
  /* Start from the stored lists (or defaults) and add any value already used in records,
     so customising never hides existing data. */
  function mergeLists(stored, state) {
    const out = {};
    for (const key of Object.keys(AOS.DEFAULT_LISTS)) {
      const def = AOS.DEFAULT_LISTS[key], colored = typeof def[0] === 'object';
      const base = clone(stored && Array.isArray(stored[key]) ? stored[key] : def);
      const have = new Set(base.map(x => colored ? x.k : x));
      for (const [c, f] of AOS.LIST_META[key].uses) {
        if (key === 'revenueCats' || key === 'expenseCats') continue; // category ownership is by transaction type, handled below
        for (const r of (state && state[c]) || []) {
          const v = r[f]; if (v && !have.has(v)) { have.add(v); base.push(colored ? { k: v, c: 'muted' } : v); }
        }
      }
      if (key === 'revenueCats' || key === 'expenseCats') {
        const type = key === 'revenueCats' ? 'Revenu' : 'Dépense';
        for (const r of (state && state.finances) || []) if (r.type === type && r.category && !have.has(r.category)) { have.add(r.category); base.push(r.category); }
      }
      out[key] = base;
    }
    return out;
  }
  const keyOf = x => typeof x === 'string' ? x : x.k;
  const itemOf = (L, key, v) => (L[key] || []).find(x => keyOf(x) === v);
  const kindOf = (L, key, v) => { const it = itemOf(L, key, v); return it && it.kind; };
  const colorOf = (L, key, v) => { const it = itemOf(L, key, v); return AOS.col(it && it.c); };

  /* Records whose field holds `value` for this list. */
  function usage(state, key, value) {
    const hits = [];
    for (const [c, f] of AOS.LIST_META[key].uses) for (const r of state[c] || []) {
      if (r[f] !== value) continue;
      if (key === 'revenueCats' && r.type !== 'Revenu') continue;
      if (key === 'expenseCats' && r.type !== 'Dépense') continue;
      hits.push({ col: c, rec: r, field: f });
    }
    return hits;
  }
  /* Writes needed to rename a list value everywhere it is used. */
  function renamePlan(state, key, from, to) {
    return usage(state, key, from).map(h => ({ op: 'set', col: h.col, id: h.rec.id, data: { ...h.rec, [h.field]: to } }));
  }

  /* ---------- permissions ---------- */
  function fullRole() {
    return { id: 'owner', ...AOS.BUILTIN_ROLES.owner, perms: Object.fromEntries(AOS.PERM_MODULES.map(m => [m.k, 'rcudx'])), flags: Object.fromEntries(AOS.PERM_FLAGS.map(f => [f[0], 1])) };
  }
  /* ctx: {isOwner, uid, canEdit, local}. users/roles: stored docs. */
  function resolveRole(ctx, users, roles) {
    if (ctx.isOwner || ctx.local) return fullRole();
    const u = (users || []).find(x => x.id === ctx.uid && x.active !== false);
    const rid = u && u.roleId && u.roleId !== 'owner' ? u.roleId : 'guest';
    const stored = (roles || []).find(r => r.id === rid);
    const base = stored || AOS.BUILTIN_ROLES[rid] || AOS.BUILTIN_ROLES.guest;
    return { id: stored || AOS.BUILTIN_ROLES[rid] ? rid : 'guest', ...clone(base), perms: (base.perms) || {}, flags: (base.flags) || {}, assigned: !!u, memberId: u && u.memberId };
  }
  const can = (role, mod, act = 'r') => !!role && (role.locked || ((role.perms || {})[mod] || '').includes(act));
  const flag = (role, f) => !!role && (role.locked || !!(role.flags || {})[f]);

  /* ---------- finance ---------- */
  const inMonth = (f, k) => f.date && f.date.slice(0, 7) === k;
  const fin = {
    rev: (S, k, cid) => (S.finances || []).filter(f => f.type === 'Revenu' && inMonth(f, k) && (!cid || f.creatorId === cid)).reduce((s, f) => s + (+f.amount || 0), 0),
    exp: (S, k) => (S.finances || []).filter(f => f.type === 'Dépense' && inMonth(f, k)).reduce((s, f) => s + (+f.amount || 0), 0),
    /* agency commission = Σ revenue × commission % of the linked creator (0 when unlinked) */
    com: (S, k, cid) => (S.finances || []).filter(f => f.type === 'Revenu' && inMonth(f, k) && (!cid || f.creatorId === cid)).reduce((s, f) => {
      const c = (S.creators || []).find(x => x.id === f.creatorId); return s + (+f.amount || 0) * ((c ? +c.commission : 0) || 0) / 100;
    }, 0)
  };

  /* ---------- migrations ---------- */
  /* v1 kept free-text pay on team records; v2 moves it to payroll/{memberId} (Éditeur-only on the server). */
  function splitPay(team, payroll) {
    const ops = [];
    for (const m of team || []) {
      if (!Object.prototype.hasOwnProperty.call(m, 'pay')) continue;
      const { pay, ...rest } = m;
      if (pay && !(payroll || []).some(p => p.id === m.id)) ops.push({ op: 'set', col: 'payroll', id: m.id, data: { memberId: m.id, pay, ...(m.demo ? { demo: true } : {}) } });
      ops.push({ op: 'set', col: 'team', id: m.id, data: rest });
    }
    return ops;
  }
  function planMigration(state, now) {
    const from = (state.schema && state.schema.version) || 1;
    if (from >= SCHEMA_VERSION) return { from, to: from, ops: [] };
    const ops = [];
    if (!state.listsStored && from < 2) ops.push({ op: 'set', path: 'settings/lists', data: mergeLists(null, state) });
    for (const [id, r] of Object.entries(AOS.BUILTIN_ROLES)) {
      if (id === 'owner' || (state.roles || []).some(x => x.id === id)) continue;
      ops.push({ op: 'set', col: 'roles', id, data: { name: r.name, desc: r.desc, minLevel: r.minLevel, perms: r.perms, flags: r.flags, builtin: true } });
    }
    if (from < 2) ops.push(...splitPay(state.team, state.payroll));
    /* v3/v4: modules added later get their default rights in stored built-in roles (never overwriting a choice) */
    for (const r of state.roles || []) {
      const b = AOS.BUILTIN_ROLES[r.id]; if (!b || !b.perms) continue;
      const add = (AOS.MODULES_ADDED || []).filter(k => b.perms[k] && !(r.perms && k in r.perms));
      if (add.length) { const { id, ...body } = r; ops.push({ op: 'set', col: 'roles', id, data: { ...body, perms: { ...(r.perms || {}), ...Object.fromEntries(add.map(k => [k, b.perms[k]])) } } }); }
    }
    const history = ((state.schema && state.schema.history) || []).concat([{ from, to: SCHEMA_VERSION, at: now }]);
    ops.push({ op: 'set', path: 'meta/schema', data: { version: SCHEMA_VERSION, migratedAt: now, history } });
    return { from, to: SCHEMA_VERSION, ops };
  }

  /* ---------- backup format ---------- */
  const BACKUP_COLS = ['creators', 'team', 'tasks', 'events', 'finances', 'notes', 'payroll', 'goals', 'calls', 'leaves', 'scripts', 'depts', 'students', 'snotes', 'roles', 'users'];
  const BACKUP_DOCS = ['settings/agency', 'settings/lists', 'settings/org'];
  function buildBackup(state, meta) {
    const data = {};
    for (const c of BACKUP_COLS) if (state[c]) data[c] = clone(state[c]);
    const docs = {};
    if (state.settings) docs['settings/agency'] = clone(state.settings);
    if (state.listsStored) docs['settings/lists'] = clone(state.listsStored);
    if (state.orgLayout) docs['settings/org'] = clone(state.orgLayout);
    return { app: 'agency-os', format: 1, schema: SCHEMA_VERSION, exportedAt: new Date(meta.now).toISOString(), agency: (state.settings || {}).name || '', partial: !!meta.partial, data, docs };
  }
  function validateBackup(obj) {
    const errors = [], warnings = [], counts = {};
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ["Ce fichier n'est pas une sauvegarde JSON lisible."], warnings, counts };
    if (obj.app !== 'agency-os') errors.push("Ce fichier ne vient pas de LVH Master (ni d'Agency OS).");
    if (typeof obj.schema !== 'number' || obj.schema > SCHEMA_VERSION) errors.push(`Version de données ${obj.schema} inconnue (cette version gère jusqu'à ${SCHEMA_VERSION}).`);
    if (!obj.data || typeof obj.data !== 'object') errors.push('La section des données est absente.');
    else for (const [c, rows] of Object.entries(obj.data)) {
      if (!BACKUP_COLS.includes(c)) { warnings.push(`Collection « ${c} » ignorée.`); continue; }
      if (!Array.isArray(rows)) { errors.push(`« ${c} » n'est pas une liste.`); continue; }
      const bad = rows.filter(r => !r || typeof r !== 'object' || typeof r.id !== 'string' || !SEG.test(r.id));
      if (bad.length) errors.push(`${bad.length} fiche(s) de « ${c} » sans identifiant valide.`);
      counts[c] = rows.length;
    }
    if (obj.partial) warnings.push('Sauvegarde partielle : elle ne contenait que les données visibles par son auteur.');
    return { ok: !errors.length, errors, warnings, counts };
  }
  /* mode "merge": add/overwrite records from the backup. mode "replace": also delete records absent from it
     (only in collections the backup contains). */
  function restorePlan(obj, state, mode) {
    const ops = [], data = clone(obj.data || {});
    if ((obj.schema || 1) < 2 && data.team) {
      for (const o of splitPay(data.team, data.payroll)) {
        if (o.col === 'payroll') (data.payroll = data.payroll || []).push({ id: o.id, ...o.data });
        else { const i = data.team.findIndex(t => t.id === o.id); data.team[i] = { id: o.id, ...o.data }; }
      }
    }
    for (const [c, rows] of Object.entries(data)) {
      if (!BACKUP_COLS.includes(c)) continue;
      const ids = new Set();
      for (const r of rows) { const { id, ...body } = r; ids.add(id); ops.push({ op: 'set', col: c, id, data: body }); }
      if (mode === 'replace') for (const r of state[c] || []) if (!ids.has(r.id)) ops.push({ op: 'delete', col: c, id: r.id });
    }
    for (const p of BACKUP_DOCS) if (obj.docs && obj.docs[p]) ops.push({ op: 'set', path: p, data: clone(obj.docs[p]) });
    return ops;
  }

  /* ---------- module visibility (agency-wide) ---------- */
  const isHidden = (settings, item) => { const h = (settings && settings.navHidden) || {}; return item.k in h ? !!h[item.k] : !!item.hid; };

  /* ---------- goals ---------- */
  const inRange = (d, g) => d && d >= g.start && d <= g.end;
  const dayOf = ms => { const z = new Date(ms); return z.getFullYear() + '-' + String(z.getMonth() + 1).padStart(2, '0') + '-' + String(z.getDate()).padStart(2, '0'); };
  /* Current value of a goal, computed from stored records. */
  function goalValue(S, L, g) {
    const fins = (S.finances || []).filter(f => inRange(f.date, g));
    const rev = fins.filter(f => f.type === 'Revenu'), exp = fins.filter(f => f.type === 'Dépense');
    const sum = a => a.reduce((t, f) => t + (+f.amount || 0), 0);
    const com = () => rev.reduce((t, f) => { const c = (S.creators || []).find(x => x.id === f.creatorId); return t + (+f.amount || 0) * ((c ? +c.commission : 0) || 0) / 100; }, 0);
    switch (g.metric) {
      case 'revenue': return sum(rev);
      case 'commission': return com();
      case 'net': return com() - sum(exp);
      case 'expenses_max': return sum(exp);
      case 'active_creators': return (S.creators || []).filter(c => kindOf(L, 'stages', c.stage) === 'active').length;
      case 'tasks_done': return (S.tasks || []).filter(t => kindOf(L, 'taskStatus', t.status) === 'done' && t.doneAt && inRange(dayOf(t.doneAt), g)
        && (g.scope !== 'Collaborateur' || !g.memberId || t.assigneeId === g.memberId)).length;
      default: return +g.current || 0;
    }
  }
  /* Progress against the calendar: expected share of the target at `today`, linear projection for cumulative metrics. */
  function goalStatus(g, value, today) {
    const M = AOS.GOAL_METRICS[g.metric] || AOS.GOAL_METRICS.manual, target = +g.target || 0;
    const span = Math.max(1, (new Date(g.end + 'T12:00') - new Date(g.start + 'T12:00')) / 864e5 + 1);
    const done = Math.min(span, Math.max(0, (new Date(today + 'T12:00') - new Date(g.start + 'T12:00')) / 864e5 + 1));
    const elapsed = done / span, pct = target ? value / target : 0;
    const projected = M.cumul && elapsed > 0 ? value / elapsed : null;
    let status;
    if (today < g.start) status = 'upcoming';
    else if (M.inverse) status = value > target ? (today > g.end ? 'failed' : 'risk') : (today > g.end ? 'reached' : (projected !== null && projected > target ? 'risk' : 'ontrack'));
    else if (pct >= 1) status = 'reached';
    else if (today > g.end) status = 'failed';
    else if (M.cumul ? pct >= elapsed * 0.9 : true) status = 'ontrack';
    else status = 'risk';
    if (!M.inverse && !M.cumul && status === 'ontrack' && pct < 1 && elapsed > 0.75) status = 'risk';
    return { pct, elapsed, projected, status };
  }

  /* ---------- presence ---------- */
  /* approved absence covering `day` for a member, if any */
  const leaveOn = (S, memberId, day) => (S.leaves || []).find(l => l.memberId === memberId && l.status === 'Validée' && l.start <= day && l.end >= day);
  /* declared status (what the person or their manager set) vs effective status (an approved absence wins) */
  function presence(S, L, m, day) {
    const lv = leaveOn(S, m.id, day);
    return { declared: m.avail || '', leave: lv || null, effective: lv ? lv.type : (m.avail || ''), away: !!lv || kindOf(L, 'availability', m.avail) === 'away' };
  }

  /* ---------- notifications (computed from records; only their read state is stored) ---------- */
  function notifications(S, L, ctx) {
    const t = ctx.today, out = [], mine = x => !ctx.memberId || x === ctx.memberId;
    const add = (id, cat, title, body, at, go, sev) => out.push({ id, cat, title, body, at, go, sev: sev || 'info' });
    const ms = d => new Date(d + 'T09:00').getTime();
    for (const x of S.tasks || []) {
      if (kindOf(L, 'taskStatus', x.status) === 'done') continue;
      if (x.due && x.due < t && mine(x.assigneeId)) add('late:' + x.id + ':' + x.due, 'tasks', 'Tâche en retard', x.title, ms(x.due) + 864e5, { edit: 'tasks:' + x.id }, 'bad');
      else if (x.due === t && mine(x.assigneeId)) add('today:' + x.id + ':' + t, 'tasks', 'À faire aujourd\'hui', x.title, ms(t), { edit: 'tasks:' + x.id }, 'warn');
      if (ctx.memberId && x.assigneeId === ctx.memberId && x.createdAt && ctx.now - x.createdAt < 7 * 864e5 && x.createdBy !== ctx.uid) add('assigned:' + x.id, 'assigned', 'Nouvelle tâche pour toi', x.title, x.createdAt, { edit: 'tasks:' + x.id });
    }
    const soon = (d, tm) => { const at = new Date(d + 'T' + (tm || '09:00')).getTime(); return at >= ctx.now - 3600e3 && at - ctx.now <= 24 * 3600e3 ? at : 0; };
    for (const e of S.events || []) { const at = soon(e.date, e.time); if (at && (!ctx.memberId || !(e.attendees || []).length || e.attendees.includes(ctx.memberId))) add('ev:' + e.id + ':' + e.date, 'meetings', e.time ? `${e.type || 'Événement'} à ${e.time.replace(':', 'h')}` : 'Aujourd\'hui', e.title, at, { edit: 'events:' + e.id }); }
    for (const c of S.calls || []) {
      if (kindOf(L, 'callStatus', c.status) === 'planned') { const at = soon(c.date, c.time); if (at && mine(c.ownerId)) add('call:' + c.id + ':' + c.date, 'meetings', `Call ${c.time ? 'à ' + c.time.replace(':', 'h') : 'aujourd\'hui'}`, c.title, at, { edit: 'calls:' + c.id }); }
      if (c.nextAction && c.nextDate && c.nextDate <= t && mine(c.ownerId)) add('callnext:' + c.id + ':' + c.nextDate, 'calls', 'Suite de call à faire', `${c.title} : ${c.nextAction}`, ms(c.nextDate), { edit: 'calls:' + c.id }, 'warn');
    }
    if (ctx.contracts) for (const c of S.creators || []) if (c.contractEnd && c.contractEnd >= t && (new Date(c.contractEnd) - new Date(t)) / 864e5 <= 30) add('contract:' + c.id + ':' + c.contractEnd, 'contracts', 'Fin de contrat proche', `${c.name} : ${c.contractEnd}`, ms(c.contractEnd) - 30 * 864e5, { open: 'creators:' + c.id }, 'warn');
    for (const g of S.goals || []) {
      if (g.start > t || (AOS.GOAL_METRICS[g.metric] || {}).fin && !ctx.finance) continue;
      const st = goalStatus(g, goalValue(S, L, g), t).status;
      if (st === 'reached') add('goal:' + g.id + ':ok', 'goals', 'Objectif atteint 🎉', g.title, ms(g.start), { edit: 'goals:' + g.id }, 'ok');
      if (st === 'risk' && g.end >= t) add('goal:' + g.id + ':risk:' + t.slice(0, 7), 'goals', 'Objectif à risque', g.title, ms(t), { edit: 'goals:' + g.id }, 'warn');
    }
    for (const l of S.leaves || []) {
      if (l.status === 'En attente' && ctx.approver) add('leave:' + l.id, 'leaves', 'Absence à valider', `${(S.team.find(m => m.id === l.memberId) || {}).name || '?'} : ${l.start} → ${l.end}`, l.createdAt || ms(l.start), { nav: 'presences' }, 'warn');
      if (l.status !== 'En attente' && ctx.memberId && l.memberId === ctx.memberId) add('leavedec:' + l.id + ':' + l.status, 'leaves', `Absence ${l.status.toLowerCase()}`, `${l.start} → ${l.end}`, l.decidedAt || l.updatedAt || 0, { nav: 'presences' }, l.status === 'Validée' ? 'ok' : 'bad');
    }
    return out.sort((a, b) => b.at - a.at);
  }

  /* ---------- recurring expenses ---------- */
  /* copies to create for month `k` from each recurring expense (monthly, or yearly in its month) */
  function recurringPlan(S, k) {
    const ops = [];
    for (const r of S.finances || []) {
      if (r.type !== 'Dépense' || r.recurringOf || !r.recurrence || r.recurrence === 'Aucune' || !r.date || r.date.slice(0, 7) >= k) continue;
      if (r.recurrence === 'Annuelle' && r.date.slice(5, 7) !== k.slice(5, 7)) continue;
      if ((S.finances || []).some(x => x.recurringOf === r.id && x.date && x.date.slice(0, 7) === k)) continue;
      const last = new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate(), day = String(Math.min(+r.date.slice(8, 10), last)).padStart(2, '0');
      const { id, createdAt, updatedAt, demo, ...body } = r;
      ops.push({ op: 'set', col: 'finances', id: r.id + '-' + k, data: { ...body, date: k + '-' + day, recurrence: 'Aucune', recurringOf: r.id, payStatus: 'À payer', ...(demo ? { demo } : {}) } });
    }
    return ops;
  }
  /* next due date of a recurring expense after `today` */
  function nextDue(r, today) {
    if (!r.date || r.recurrence === 'Aucune') return null;
    const d = new Date(r.date + 'T12:00'), t = new Date(today + 'T12:00');
    while (d < t) r.recurrence === 'Annuelle' ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- organigramme canvas ----------
     Nodes are people (team ids) and free boxes (layout.boxes). Hierarchy links come from team.reportsTo; free links
     (layout.links) can join anything. Positions are saved per node; a node without one is placed automatically. */
  const ORG = { GX: 260, GY: 200, W: 230, H: 150 };
  function orgGraph(team, layout) {
    const L = layout || {}, boxes = L.boxes || [], ids = new Set([...team.map(m => m.id), ...boxes.map(b => b.id)]);
    const tIds = new Set(team.map(m => m.id));
    const hier = team.filter(m => m.reportsTo && m.reportsTo !== m.id && tIds.has(m.reportsTo)).map(m => ({ id: 'h:' + m.id, a: m.reportsTo, b: m.id, kind: 'hier' }));
    const free = (L.links || []).filter(l => ids.has(l.a) && ids.has(l.b) && l.a !== l.b).map(l => ({ ...l, kind: 'free' }));
    /* tree parent for the automatic layout: the manager, or a box that links down to someone without a manager */
    const parent = {};
    for (const h of hier) parent[h.b] = h.a;
    for (const l of free) if (!parent[l.b] && boxes.some(b => b.id === l.a)) parent[l.b] = l.a;
    return { nodes: [...team.map(m => m.id), ...boxes.map(b => b.id)], hier, free, parent };
  }
  function orgAutoPos(G) {
    const kids = {}, P = {}, seen = new Set(); let slot = 0;
    for (const n of G.nodes) { const p = G.parent[n]; if (p) (kids[p] = kids[p] || []).push(n); }
    const place = (id, d) => {
      if (seen.has(id)) return; seen.add(id);
      const ks = (kids[id] || []).filter(k => !seen.has(k));
      ks.forEach(k => place(k, d + 1));
      const xs = ks.filter(k => P[k]).map(k => P[k].x);
      P[id] = xs.length ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: d * ORG.GY } : { x: (slot++) * ORG.GX, y: d * ORG.GY };
    };
    G.nodes.filter(n => !G.parent[n] || !G.nodes.includes(G.parent[n])).forEach(n => place(n, 0));
    G.nodes.forEach(n => place(n, 0));   // anything left in a loop
    return P;
  }
  /* saved positions win; a new node goes under its parent (or to the right of everything), moved right until free */
  function orgPositions(G, saved) {
    const auto = orgAutoPos(G), sv = saved || {}, P = {};
    if (!G.nodes.some(n => sv[n])) return auto;
    for (const n of G.nodes) if (sv[n]) P[n] = { x: +sv[n].x || 0, y: +sv[n].y || 0 };
    const busy = (x, y) => Object.values(P).some(p => Math.abs(p.x - x) < ORG.W + 10 && Math.abs(p.y - y) < ORG.H);
    const order = G.nodes.filter(n => !P[n]).sort((a, b) => auto[a].y - auto[b].y || auto[a].x - auto[b].x);
    for (const n of order) {
      const pp = P[G.parent[n]], xs = Object.values(P).map(p => p.x), ys = Object.values(P).map(p => p.y);
      let x = pp ? pp.x : Math.max(...xs) + ORG.GX, y = pp ? pp.y + ORG.GY : Math.min(...ys);
      while (busy(x, y)) x += ORG.GX;
      P[n] = { x, y };
    }
    return P;
  }
  /* would "a manages b" create a loop? (b is already above a) */
  function orgCycle(team, a, b) {
    const by = Object.fromEntries(team.map(m => [m.id, m])); let cur = a, n = 0;
    while (cur && n++ < 500) { if (cur === b) return true; cur = by[cur] && by[cur].reportsTo; }
    return false;
  }

  /* ---------- repeating tasks ---------- */
  const REPEATS = ['Jamais', 'Chaque jour', 'Chaque semaine', 'Toutes les 2 semaines', 'Chaque mois'];
  const isoD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /* next due date after `from`, never in the past: a daily task done three days late comes back today, not three times.
     Monthly keeps the original day of month (`anchor`), clamped to short months (31 → 30 → 28). */
  function repeatNext(repeat, from, today, anchor) {
    const step = { 'Chaque jour': 1, 'Chaque semaine': 7, 'Toutes les 2 semaines': 14 }[repeat];
    if (!step && repeat !== 'Chaque mois') return null;
    const d = new Date((from || today) + 'T12:00'), day = anchor || d.getDate();
    const adv = () => { if (step) d.setDate(d.getDate() + step); else { d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); } };
    adv(); while (isoD(d) < today) adv();
    return isoD(d);
  }
  /* writes that follow saving a task: ticking a repeating task creates the next one (deterministic id, so it is
     never created twice); reopening it removes that next one if nobody has started or edited it */
  function repeatOps(prev, r, L, tasks, today) {
    const done = x => !!x && kindOf(L, 'taskStatus', x.status) === 'done';
    if (!r.repeat || r.repeat === 'Jamais' || done(prev) === done(r)) return [];
    const series = r.series || r.id, anchor = r.anchor || +(r.due || today).slice(8, 10);
    if (done(r)) {
      const due = repeatNext(r.repeat, r.due, today, r.repeat === 'Chaque mois' ? anchor : 0);
      const id = series + '-' + due.replace(/-/g, '');
      if (!due || tasks.some(x => x.id === id)) return [];
      const { id: _i, createdAt, updatedAt, doneAt, createdBy, demo, nextId, ...body } = r;
      const open = (L.taskStatus.find(s => s.kind === 'open') || {}).k || r.status;
      return [{ op: 'set', col: 'tasks', id, data: { ...body, status: open, due, series, anchor, prevId: r.id, createdAt: Date.now(), ...(demo ? { demo } : {}) } },
        { op: 'set', col: 'tasks', id: r.id, data: { ...r, nextId: id } }];
    }
    const nx = r.nextId && tasks.find(x => x.id === r.nextId);
    if (!nx || done(nx) || nx.updatedAt) return [];
    const { nextId, ...body } = r;
    return [{ op: 'delete', col: 'tasks', id: nx.id }, { op: 'set', col: 'tasks', id: r.id, data: body }];
  }

  /* ---------- analytics ---------- */
  const monthlySeries = (S, months) => months.map(k => { const rev = fin.rev(S, k), com = fin.com(S, k), exp = fin.exp(S, k); return { k, rev, com, exp, net: com - exp }; });

  Object.assign(AOS, { ORG, orgGraph, orgAutoPos, orgPositions, orgCycle, REPEATS, repeatNext, repeatOps, leaveOn, presence, notifications, recurringPlan, nextDue, monthlySeries, isHidden, goalValue, goalStatus, mergeLists, keyOf, itemOf, kindOf, colorOf, usage, renamePlan, resolveRole, fullRole, can, flag, fin, planMigration, splitPay, buildBackup, validateBackup, restorePlan, BACKUP_COLS, SEG });
})(typeof window !== 'undefined' ? window : globalThis);
