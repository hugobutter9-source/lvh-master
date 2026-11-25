/* Agency OS — UI kit: record forms, drawer, confirm dialog, global search. */
(function (g) {
  const AOS = g.AOS;
  const { $, esc, ic, av, sortBy, toast } = AOS;
  const S = AOS.S, me = AOS.me;
  const layer = () => $('#layer');
  /* registries filled by modules (loaded after this file) and read by the shell */
  Object.assign(AOS, { views: {}, act: {}, inputs: {}, changes: {}, afterRender: {}, routeHooks: [],
    ui: { crStage: 'Toutes', crQ: '', teamQ: '', teamDept: '', taskWho: '', noteTag: 'Toutes', noteQ: '', finMonth: null, showPast: false, showDone: false, auditQ: '', roleSel: null } });

  /* ---------- confirm ---------- */
  AOS.confirm = function ({ title, body, ok = 'Confirmer', danger, typeToConfirm }) {
    return new Promise(res => {
      layer().insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="confirm"><div class="modal sm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
        <div class="card-h"><h3 id="cf-t">${esc(title)}</h3></div>
        <div class="modal-b"><div class="muted">${body || ''}</div>
        ${typeToConfirm ? `<div class="fld" style="margin-top:14px"><label for="cf-in">Tape <b>${esc(typeToConfirm)}</b> pour confirmer</label><input id="cf-in" autocomplete="off"></div>` : ''}</div>
        <div class="form-foot pad"><button class="btn ghost" id="cf-no">Annuler</button><button class="btn ${danger ? 'danger armed' : 'pri'}" id="cf-ok" ${typeToConfirm ? 'disabled' : ''}>${esc(ok)}</button></div></div></div>`);
      const sc = layer().lastElementChild, done = v => { sc.remove(); res(v); };
      sc.querySelector('#cf-no').onclick = () => done(false);
      sc.querySelector('#cf-ok').onclick = () => done(true);
      sc.addEventListener('click', e => { if (e.target === sc) done(false); });
      const inp = sc.querySelector('#cf-in');
      if (inp) { inp.oninput = () => { sc.querySelector('#cf-ok').disabled = inp.value.trim() !== typeToConfirm; }; setTimeout(() => inp.focus(), 20); }
      else setTimeout(() => sc.querySelector('#cf-ok').focus(), 20);
    });
  };

  /* ---------- one-value prompt (text or choice) ---------- */
  AOS.ask = function ({ title, label, ok = 'Valider', options, value = '' }) {
    return new Promise(res => {
      layer().insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="ask"><div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="ask-t">
        <div class="card-h"><h3 id="ask-t">${esc(title)}</h3></div>
        <form class="ask" id="askf"><div class="fld full"><label for="ask-in">${esc(label)}</label>${options ? `<select id="ask-in">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input id="ask-in" value="${esc(value)}" autocomplete="off" required>`}</div>
        <div class="form-foot"><button type="button" class="btn ghost" id="ask-no">Annuler</button><button class="btn pri">${esc(ok)}</button></div></form></div></div>`);
      const sc = layer().lastElementChild, inp = sc.querySelector('#ask-in'), done = v => { sc.remove(); res(v); };
      sc.querySelector('#ask-no').onclick = () => done(null);
      sc.addEventListener('click', e => { if (e.target === sc) done(null); });
      sc.querySelector('#askf').onsubmit = e => { e.preventDefault(); const v = options ? inp.value : inp.value.trim(); if (!options && !v) return; done(v); };
      setTimeout(() => inp.focus(), 20);
    });
  };

  /* ---------- record form ---------- */
  function field(f, val, recId, ro) {
    const id = 'f-' + f.k, v = val ?? '', dis = ro ? 'disabled' : '';
    let inp;
    if (f.t === 'select') { const opts = f.o.includes(v) || v === '' ? f.o : [...f.o, v]; inp = `<select id="${id}" name="${f.k}" ${dis}>${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc((f.labels && f.labels[o]) || o || '—')}</option>`).join('')}</select>`; }
    else if (f.t === 'ref') inp = `<select id="${id}" name="${f.k}" ${dis}><option value="">—</option>${sortBy(S[f.ref].filter(x => !(f.self && x.id === recId) && !x.archived), x => x.name || x.title).map(x => `<option value="${x.id}" ${x.id === v ? 'selected' : ''}>${esc(x.name || x.title)}</option>`).join('')}</select>`;
    else if (f.t === 'multi') inp = S[f.ref].length ? `<div class="multi" id="${id}">${sortBy(S[f.ref].filter(x => !x.archived), x => x.name).map(x => `<label><input type="checkbox" name="${f.k}" value="${x.id}" ${(v || []).includes(x.id) ? 'checked' : ''} ${dis}>${esc(x.name)}</label>`).join('')}</div>` : '<span class="faint" style="font-size:13px">Ajoute d\'abord des collaborateurs dans l\'équipe.</span>';
    else if (f.t === 'textarea') inp = `<textarea id="${id}" name="${f.k}" class="${f.tall ? 'tall' : ''}" ${dis}>${esc(v)}</textarea>`;
    else if (f.t === 'bool') inp = `<label class="inline"><input type="checkbox" id="${id}" name="${f.k}" ${v ? 'checked' : ''} ${dis}>${esc(f.txt || 'Garder en haut de la liste')}</label>`;
    else if (f.t === 'list') inp = `<input id="${id}" name="${f.k}" list="dl-${f.k}" value="${esc(v)}" autocomplete="off" ${dis}><datalist id="dl-${f.k}">${f.o.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
    else inp = `<input id="${id}" name="${f.k}" type="${f.t || 'text'}" value="${esc(v)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.req ? 'required' : ''} ${f.t === 'number' ? 'step="any"' : ''} ${dis}>`;
    return `<div class="fld ${f.full ? 'full' : ''}" ${f.showIf ? `data-showif="${f.showIf[0]}" data-showv="${esc(f.showIf[1].join('|'))}"` : ''}><label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>${inp}</div>`;
  }
  AOS.openForm = function (col, id, preset = {}, opts = {}) {
    const sch = AOS.schema(col), rec = id ? S[col].find(x => x.id === id) : null;
    if (id && !rec && col !== 'payroll') { toast('Cette fiche n\'existe plus.'); return; }
    const canWrite = AOS.allowed(col, rec ? 'u' : 'c'), canDel = rec && AOS.allowed(col, 'd');
    if (!rec && !canWrite) { toast('Ton rôle ne permet pas de créer cette fiche.', 'bad'); return; }
    const fields = sch.fields.filter(f => (!f.flag || AOS.flag(me.role, f.flag)) && (!f.approve || (rec ? AOS.allowed(col, 'u') : AOS.can(me.role, AOS.COL_MODULE[col], 'u'))));
    const locked = sch.fields.filter(f => f.approve && !fields.includes(f));   // e.g. a leave request stays "En attente" unless an approver sets it
    const base = {}; fields.forEach(f => { if (f.d !== undefined) base[f.k] = f.d; });
    if (col === 'events' || col === 'finances' || col === 'calls') base.date = AOS.today();
    if (col === 'leaves') { base.start = base.end = AOS.today(); }
    if (col === 'goals') { const t = AOS.today(); base.start = t.slice(0, 8) + '01'; const e = new Date(t.slice(0, 7) + '-01T12:00'); e.setMonth(e.getMonth() + 1); e.setDate(0); base.end = AOS.iso(e); }
    const ov = opts.override || {};   // values that win over a record not yet refreshed from the server
    const r = { ...base, ...preset, ...(rec || {}), ...ov };
    const title = opts.title || (rec ? (canWrite ? 'Modifier' : 'Consulter') + ' : ' + esc(rec.name || rec.title || rec.label || sch.one.toLowerCase()) : (sch.fem ? 'Nouvelle ' : 'Nouveau ') + sch.one.toLowerCase());
    layer().insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="form"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
     <div class="card-h"><h3 id="mt">${title}</h3><button class="btn sm ghost" data-a="closeform" aria-label="Fermer">${ic('x')}</button></div>
     <form id="frm" novalidate>${fields.map(f => field(f, r[f.k], r.id, !canWrite)).join('')}
     ${rec && rec.demo ? '<p class="full faint" style="margin:0;font-size:12.5px">Fiche d\'exemple (mode démonstration).</p>' : ''}
     <div class="form-foot">${canDel ? `<button type="button" class="btn danger" data-a="delrec" data-col="${col}" data-id="${rec.id}">Supprimer</button>` : ''}<button type="button" class="btn ghost" data-a="closeform">${canWrite ? 'Annuler' : 'Fermer'}</button>${canWrite ? `<button class="btn pri" type="submit">${rec ? 'Enregistrer' : 'Créer'}</button>` : ''}</div></form></div></div>`);
    const frm = $('#frm');
    if (col === 'finances') {
      const L = AOS.lists(), ty = frm.elements.type, ca = frm.elements.category;
      const sync = () => { const cur = ca.value, list = ty.value === 'Dépense' ? L.expenseCats : L.revenueCats; ca.innerHTML = list.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join(''); };
      ty.addEventListener('change', sync); sync();
    }
    /* fields shown only for some values of another field */
    const syncShow = () => frm.querySelectorAll('[data-showif]').forEach(el => { const ctl = frm.elements[el.dataset.showif]; el.hidden = !ctl || !el.dataset.showv.split('|').includes(ctl.value); });
    frm.addEventListener('change', syncShow); syncShow();
    setTimeout(() => frm.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')?.focus(), 20);
    frm.addEventListener('submit', async e => {
      e.preventDefault();
      const out = { ...(rec || {}), ...preset, ...ov };
      for (const f of fields) {
        const wrap = frm.querySelector(`[data-showif] [name="${f.k}"]`); if (wrap && wrap.closest('[data-showif]').hidden) { out[f.k] = ''; continue; }
        if (f.t === 'multi') out[f.k] = [...frm.querySelectorAll(`input[name="${f.k}"]:checked`)].map(x => x.value);
        else if (f.t === 'bool') out[f.k] = frm.elements[f.k].checked;
        else { const el = frm.elements[f.k]; let v = el ? el.value.trim() : ''; if (f.t === 'number') { v = v === '' ? '' : +v.replace(',', '.'); if (Number.isNaN(v)) { toast(`« ${f.l} » doit être un nombre.`); el.focus(); return; } } out[f.k] = v; }
        if (f.req && (out[f.k] === '' || out[f.k] === undefined)) { toast(`Renseigne le champ « ${f.l} ».`); frm.elements[f.k]?.focus(); return; }
      }
      for (const f of locked) out[f.k] = rec ? rec[f.k] : f.d;
      if (opts.id) out.id = opts.id;
      if (col === 'tasks' && out.assigneeId && out.due && AOS.leaveOn(S, out.assigneeId, out.due) && (!rec || rec.assigneeId !== out.assigneeId || rec.due !== out.due)) {
        const lv = AOS.leaveOn(S, out.assigneeId, out.due);
        if (!(await AOS.confirm({ title: 'Personne absente ce jour-là', body: `${esc(AOS.nm('team', out.assigneeId))} est en ${esc(lv.type.toLowerCase())} du ${AOS.dShort(lv.start)} au ${AOS.dShort(lv.end)}. Assigner quand même ?`, ok: 'Assigner quand même' }))) return;
      }
      if (col === 'team' && out.reportsTo && createsCycle(out.id, out.reportsTo)) { toast('Ce responsable dépend déjà de cette personne : boucle impossible.', 'bad'); return; }
      const btn = frm.querySelector('[type=submit]'); btn.disabled = true;
      const nid = await AOS.save(col, out);
      btn.disabled = false;
      if (!nid) return;
      AOS.closeForm();
      toast(rec ? 'Modifications enregistrées' : `${sch.one} ${sch.fem ? 'créée' : 'créé'}`);
      if (opts.after) opts.after(nid);
    });
  };
  /* true if making `parent` the manager of `id` would create a loop in the org chart */
  function createsCycle(id, parent) {
    let cur = parent, seen = new Set();
    while (cur && !seen.has(cur)) { if (cur === id) return true; seen.add(cur); cur = (S.team.find(m => m.id === cur) || {}).reportsTo; }
    return false;
  }
  AOS.createsCycle = createsCycle;
  AOS.closeForm = () => { const s = layer().querySelector('[data-scrim="form"]'); if (s) s.remove(); };

  /* ---------- drawer ---------- */
  let drawer = null;
  AOS.drawers = {};
  AOS.openDrawer = (kind, id) => { drawer = { kind, id }; AOS.renderDrawer(); };
  AOS.closeDrawer = () => { drawer = null; AOS.renderDrawer(); };
  AOS.drawerState = () => drawer;
  AOS.renderDrawer = function () {
    const L = layer(); let d = L.querySelector('.drawer');
    const fn = drawer && AOS.drawers[drawer.kind], html = fn && fn(drawer.id);
    if (!html) { drawer = null; L.querySelector('.drawer-scrim')?.remove(); d?.remove(); return; }
    if (!d) { L.insertAdjacentHTML('afterbegin', '<div class="drawer-scrim" data-a="closedrawer"></div><aside class="drawer" role="dialog" aria-modal="true"></aside>'); d = L.querySelector('.drawer'); }
    /* keep what is being typed in the drawer (e.g. a note) when data changes underneath */
    const keep = {}; d.querySelectorAll('textarea[name], input[name]').forEach(el => { if (el.value) keep[(el.form && el.form.id) + ':' + el.name] = el.value; });
    const sc = d.scrollTop; d.innerHTML = html; d.scrollTop = sc;
    d.querySelectorAll('textarea[name], input[name]').forEach(el => { const k = (el.form && el.form.id) + ':' + el.name; if (k in keep && !el.value) el.value = keep[k]; });
  };

  /* ---------- global search (Ctrl/Cmd+K) ---------- */
  AOS.openSearch = function () {
    if (layer().querySelector('[data-scrim="search"]')) return;
    layer().insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="search"><div class="search" role="dialog" aria-modal="true" aria-label="Recherche globale"><input id="sq" placeholder="Créatrice, collaborateur, tâche, SOP, numéro, page…" autocomplete="off"><div class="res" id="sres"></div></div></div>`);
    const q = $('#sq'), res = $('#sres'); let sel = 0;
    const src = [
      ['creators', 'creatrices', 'Créatrices', r => [r.name, r.handle, r.platforms, r.phone, r.email].join(' '), r => r.name, r => r.stage],
      ['students', 'accompagnement', 'Accompagnement', r => [r.name, r.handle, r.program, r.phone, r.email].join(' '), r => r.name, r => r.program],
      ['team', 'equipe', 'Équipe', r => [r.name, r.role, r.dept, r.phone, r.email, r.telegram].join(' '), r => r.name, r => r.role],
      ['tasks', 'taches', 'Tâches', r => r.title + ' ' + (r.notes || ''), r => r.title, r => r.status],
      ['events', 'planning', 'Planning', r => r.title + ' ' + (r.place || ''), r => r.title, r => AOS.dShort(r.date)],
      ['notes', 'sop', 'SOP & notes', r => r.title + ' ' + (r.body || ''), r => r.title, r => r.tag],
      ['finances', 'finances', 'Finances', r => r.label + ' ' + (r.category || ''), r => r.label, r => AOS.eur(r.amount)]];
    const run = () => {
      const s = q.value.trim().toLowerCase(); let html = '', n = 0;
      const pages = AOS.NAV_FLAT.filter(p => AOS.navVisible(p) && (!s || AOS.modName(p).toLowerCase().includes(s))).slice(0, s ? 6 : 0);
      if (pages.length) html += `<div class="grp">Pages</div>` + pages.map(p => `<button class="hit ${n++ === sel ? 'sel' : ''}" data-hit="page:${p.k}">${ic(p.i)}<span class="grow">${esc(AOS.modName(p))}</span><span class="muted">${p.view ? esc(p.sec) : 'Phase ' + p.phase}</span></button>`).join('');
      for (const [c, mod, lab, txt, ti, sub] of src) {
        if (!AOS.can(me.role, mod, 'r') || (c === 'finances' && !AOS.flag(me.role, 'finance_view'))) continue;
        const hits = S[c].filter(r => !s || txt(r).toLowerCase().includes(s)).slice(0, s ? 6 : 3); if (!hits.length) continue;
        html += `<div class="grp">${lab}</div>` + hits.map(r => `<button class="hit ${n++ === sel ? 'sel' : ''}" data-hit="${c}:${r.id}">${c === 'creators' || c === 'team' || c === 'students' ? av(ti(r)) : ''}<span class="grow">${esc(ti(r))}</span><span class="muted">${esc(sub(r) || '')}</span></button>`).join('');
      }
      res.innerHTML = html || '<div class="empty">Aucun résultat.</div>';
    };
    q.addEventListener('input', () => { sel = 0; run(); });
    q.addEventListener('keydown', e => {
      const hits = res.querySelectorAll('.hit');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(1, hits.length); run(); res.querySelector('.hit.sel')?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter' && hits[sel]) hits[sel].click();
    });
    run(); setTimeout(() => q.focus(), 20);
  };
  AOS.openRecord = function (col, id) {
    if (col === 'creators') AOS.openDrawer('creator', id);
    else if (col === 'team') AOS.openDrawer('member', id);
    else AOS.openForm(col, id);
  };
  AOS.copyable = (v, mono) => v ? `<span class="copy"><span class="${mono ? 'mono' : ''}">${esc(v)}</span><button data-copy="${esc(v)}">Copier</button></span>` : '<span class="faint">—</span>';
})(window);
