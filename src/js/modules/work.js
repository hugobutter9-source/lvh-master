/* Agency OS — Tâches, Planning, SOP & notes. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, pill, dot, today, addDays, sortBy } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;

  /* ---------- Tâches ---------- */
  AOS.views.taches = function () {
    const L = AOS.lists(), t = today();
    let ts = S.tasks; if (ui.taskWho) ts = ts.filter(x => x.assigneeId === ui.taskWho);
    const isDone = x => AOS.kindOf(L, 'taskStatus', x.status) === 'done';
    const o = ts.filter(x => !isDone(x));
    const prio = x => { const i = L.priorities.findIndex(p => p.k === x.priority); return i < 0 ? 9 : i; };
    const sorted = a => sortBy(a, x => (x.due || '9999') + prio(x));
    const groups = [['En retard', o.filter(x => x.due && x.due < t), 'var(--bad)'], ["Aujourd'hui", o.filter(x => x.due === t), 'var(--warn)'], ['7 prochains jours', o.filter(x => x.due > t && x.due <= addDays(t, 7)), 'var(--info)'], ['Plus tard', o.filter(x => x.due > addDays(t, 7)), 'var(--faint)'], ['Sans échéance', o.filter(x => !x.due), 'var(--faint)']];
    const done = ts.filter(isDone);
    return AOS.header({ eyebrow: 'Organisation', title: `${o.length} tâche${o.length > 1 ? 's' : ''} ouverte${o.length > 1 ? 's' : ''}.`, actions: `${AOS.can(me.role, 'taches', 'x') ? `<button class="btn" data-a="csvexport" data-col="tasks">${ic('download', 15)}CSV</button>` : ''}${AOS.allowed('tasks', 'c') ? `<button class="btn" data-a="tplopen">${ic('layers', 15)}Checklists</button>` : ''}${AOS.newBtn('tasks', 'Tâche', 1)}` }) +
    `<div class="toolbar"><select class="input" id="taskWho" aria-label="Filtrer par collaborateur"><option value="">Toute l'équipe</option>${me.role && me.role.memberId ? `<option value="${me.role.memberId}" ${ui.taskWho === me.role.memberId ? 'selected' : ''}>Mes tâches</option>` : ''}${sortBy(S.team.filter(m => !m.archived), m => m.name).map(m => `<option value="${m.id}" ${ui.taskWho === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <span class="faint small">Sous-tâches, projets et vues kanban/timeline : phase 3.</span></div>` +
    (ts.length ? groups.filter(g => g[1].length).map(g => `<div class="card"><div class="card-h"><span class="lbl">${dot(g[2])}${g[0]}</span><span class="mono faint">${g[1].length}</span></div><div class="list">${sorted(g[1]).map(AOS.taskRow).join('')}</div></div>`).join('') +
      (done.length ? `<div class="card"><div class="card-h"><span class="lbl">${dot('var(--ok)')}Terminées</span><button class="linkbtn" data-a="toggledone">${ui.showDone ? 'Masquer' : 'Afficher'} (${done.length})</button></div>${ui.showDone ? `<div class="list">${sortBy(done, x => -(x.doneAt || x.updatedAt || 0)).map(AOS.taskRow).join('')}</div>` : ''}</div>` : '')
      : `<div class="card"><div class="empty big">Aucune tâche. Crée-en une et assigne-la à quelqu'un de l'équipe.</div></div>`);
  };
  AOS.changes.taskWho = el => { ui.taskWho = el.value; AOS.render(); };
  AOS.act.toggledone = () => { ui.showDone = !ui.showDone; AOS.render(); };

  /* Planning moved to modules/agenda.js (day / week / month views) */

  /* ---------- SOP & notes ---------- */
  AOS.views.sop = function () {
    const L = AOS.lists();
    let ns = S.notes; if (ui.noteTag !== 'Toutes') ns = ns.filter(n => n.tag === ui.noteTag);
    if (ui.noteQ) { const q = ui.noteQ.toLowerCase(); ns = ns.filter(n => (n.title + ' ' + (n.body || '')).toLowerCase().includes(q)); }
    ns = [...ns].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
    return AOS.header({ eyebrow: 'Productivité', title: 'SOP, process <span class="soft">et notes.</span>', actions: AOS.newBtn('notes', 'Note', 1) }) +
    `<div class="toolbar"><input class="input" id="noteQ" placeholder="Rechercher dans les notes…" value="${esc(ui.noteQ)}">
     <div class="chips">${['Toutes', ...L.noteTags].map(s => `<button class="chip ${ui.noteTag === s ? 'on' : ''}" data-a="notetag" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` +
    (ns.length ? `<div class="notes">${ns.map(n => `<button class="note" data-edit="notes:${n.id}"><div class="m">${pill(n.tag || 'Note', 'var(--accent)')}${n.pinned ? '<span class="tag">épinglée</span>' : ''}${n.demo ? '<span class="tag">exemple</span>' : ''}</div><h4>${esc(n.title)}</h4><p>${esc(n.body || '')}</p>
      ${n.creatorId ? `<div class="m"><span class="muted small">↳ ${esc(AOS.nm('creators', n.creatorId))}</span></div>` : ''}</button>`).join('')}</div>`
    : `<div class="card"><div class="empty big">${S.notes.length ? 'Aucune note ne correspond.' : 'Garde ici tes procédures, scripts, idées et comptes-rendus.'}</div></div>`) +
    `<p class="faint hint">SOP structurées (étapes, version, responsable) transformables en checklists : phase 5.</p>`;
  };
  AOS.inputs.noteQ = el => { ui.noteQ = el.value; AOS.render(); };
  AOS.act.notetag = el => { ui.noteTag = el.dataset.v; AOS.render(); };
})();
