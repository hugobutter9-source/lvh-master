/* Agency OS — Créatrices (list + fiche) and Recrutement (pipeline kanban). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, av, pill, dot, today, diffDays, dShort, eur, eurK, sortBy } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const nm = (c, id) => AOS.nm(c, id);

  AOS.views.creatrices = function () {
    const L = AOS.lists(), R = me.role, mk = today().slice(0, 7);
    const showFin = AOS.flag(R, 'finance_view'), showCon = AOS.flag(R, 'contract_view');
    let rows = S.creators;
    if (ui.crStage !== 'Toutes') rows = rows.filter(c => c.stage === ui.crStage);
    if (ui.crQ) { const q = ui.crQ.toLowerCase(); rows = rows.filter(c => [c.name, c.handle, c.platforms, c.country].join(' ').toLowerCase().includes(q)); }
    rows = sortBy(rows, c => String(L.stages.findIndex(s => s.k === c.stage)).padStart(3, '0') + c.name);
    const nAct = S.creators.filter(c => AOS.kindOf(L, 'stages', c.stage) === 'active').length;
    return AOS.header({ eyebrow: 'Agence', title: `${nAct} active${nAct > 1 ? 's' : ''} <span class="soft">sur ${S.creators.length} créatrices.</span>`, actions: AOS.newBtn('creators', 'Créatrice', 1) }) +
    `<div class="toolbar"><input class="input" id="crQ" placeholder="Rechercher un nom, un handle, un pays…" value="${esc(ui.crQ)}">
      <div class="chips">${['Toutes', ...L.stages.map(s => s.k)].map(s => `<button class="chip ${ui.crStage === s ? 'on' : ''}" data-a="crstage" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
    <div class="card tbl-wrap">${rows.length ? `<table><thead><tr><th>Créatrice</th><th>Statut</th><th>Account manager</th><th>Équipe</th>${showFin ? '<th class="r">CA du mois</th>' : ''}${showCon ? '<th class="r">Commission</th><th>Fin de contrat</th>' : ''}<th>Prochaine action</th></tr></thead><tbody>
    ${rows.map(c => { const end = c.contractEnd, soon = end && diffDays(end, today()) <= 30; return `<tr data-open="creators:${c.id}" tabindex="0">
      <td><div class="who">${av(c.name)}<div><div class="strong">${esc(c.name)}${AOS.demoTag(c)}</div><div class="muted small">${esc(c.handle || '')}</div></div></div></td>
      <td>${pill(c.stage || '—', AOS.colorOf(L, 'stages', c.stage))}</td><td>${esc(nm('team', c.managerId)) || '<span class="faint">—</span>'}</td>
      <td class="muted">${(c.staff || []).length || '—'}</td>${showFin ? `<td class="r mono">${eur(AOS.fin.rev(S, mk, c.id))}</td>` : ''}
      ${showCon ? `<td class="r mono">${c.commission !== '' && c.commission != null ? c.commission + ' %' : '—'}</td><td class="mono" style="color:${soon ? 'var(--warn)' : 'var(--muted)'}">${end ? dShort(end) : '—'}</td>` : ''}
      <td class="muted ellip">${esc(c.nextAction || '')}</td></tr>`; }).join('')}
    </tbody></table>` : `<div class="empty big">${S.creators.length ? 'Aucune créatrice ne correspond à ce filtre.' : 'Ajoute ta première créatrice pour suivre son contrat, son équipe et ses revenus.'}</div>`}</div>`;
  };
  AOS.act.crstage = el => { ui.crStage = el.dataset.v; AOS.render(); };
  AOS.inputs.crQ = el => { ui.crQ = el.value; AOS.render(); };

  /* ---------- pipeline ---------- */
  AOS.views.recrutement = function () {
    const L = AOS.lists(), canU = AOS.allowed('creators', 'u');
    return AOS.header({ eyebrow: 'Agence', title: 'Recrutement <span class="soft">et suivi des créatrices.</span>', actions: AOS.newBtn('creators', 'Créatrice', 1) }) +
    `<p class="muted hint">${canU ? 'Glisse une carte vers une autre colonne pour changer son statut. Sur mobile, ouvre la fiche pour le modifier.' : 'Lecture seule pour ton rôle.'} Les colonnes se modifient dans Paramètres › Personnalisation.</p>
    <div class="kanban">${L.stages.map(s => { const cs = sortBy(S.creators.filter(c => c.stage === s.k), c => c.name); return `<div class="col" data-stage="${esc(s.k)}">
      <div class="col-h">${dot(AOS.col(s.c))}${esc(s.k)}<span class="c">${cs.length}</span></div>
      <div class="col-b">${cs.map(c => `<div class="kc" ${canU ? 'draggable="true"' : ''} data-card="${c.id}" data-open="creators:${c.id}" tabindex="0"><div class="t">${esc(c.name)}${AOS.demoTag(c)}</div>
        <div class="m">${c.handle ? `<span>${esc(c.handle)}</span>` : ''}${c.managerId ? `<span>· ${esc(nm('team', c.managerId))}</span>` : ''}</div>
        ${c.nextAction ? `<div class="m">→ ${esc(c.nextAction)}</div>` : ''}</div>`).join('')}
        ${AOS.allowed('creators', 'c') ? `<button class="btn ghost sm add" data-new="creators" data-preset-stage="${esc(s.k)}">${ic('plus', 14)}Ajouter</button>` : ''}</div></div>`; }).join('')}</div>`;
  };
  let dragId = null;
  document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-card]'); if (!c) return; dragId = c.dataset.card; c.classList.add('drag'); try { e.dataTransfer.setData('text/plain', dragId); } catch (_) { } });
  document.addEventListener('dragend', e => { e.target.classList && e.target.classList.remove('drag'); document.querySelectorAll('.col.over').forEach(x => x.classList.remove('over')); });
  document.addEventListener('dragover', e => { const col = e.target.closest && e.target.closest('[data-stage]'); if (col && dragId) { e.preventDefault(); document.querySelectorAll('.col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
  document.addEventListener('drop', e => {
    const col = e.target.closest && e.target.closest('[data-stage]'); if (!col || !dragId) return; e.preventDefault();
    const c = S.creators.find(x => x.id === dragId); dragId = null;
    if (c && c.stage !== col.dataset.stage) AOS.save('creators', { ...c, stage: col.dataset.stage });
  });

  /* ---------- fiche créatrice ---------- */
  AOS.drawers.creator = function (id) {
    const c = S.creators.find(x => x.id === id); if (!c) return '';
    const L = AOS.lists(), R = me.role, mk = today().slice(0, 7);
    const ts = sortBy(AOS.openTasks().filter(t => t.creatorId === c.id), t => t.due || '9999');
    const es = sortBy(S.events.filter(e => e.creatorId === c.id && e.date >= today()), e => e.date);
    const ns = S.notes.filter(n => n.creatorId === c.id);
    const canU = AOS.allowed('creators', 'u'), showFin = AOS.flag(R, 'finance_view'), showCon = AOS.flag(R, 'contract_view');
    const rev = AOS.fin.rev(S, mk, c.id);
    return `<div class="dh">${av(c.name, 'lg')}<div class="grow"><h2>${esc(c.name)}${AOS.demoTag(c)}</h2><div class="muted">${[c.handle, c.platforms, c.country].filter(Boolean).map(esc).join(' · ')}</div></div><button class="btn sm ghost" data-a="closedrawer" aria-label="Fermer">${ic('x')}</button></div>
    <div class="sec"><h5>Statut</h5><div class="chips">${L.stages.map(s => canU ? `<button class="chip ${c.stage === s.k ? 'on' : ''}" data-a="setstage" data-id="${c.id}" data-v="${esc(s.k)}">${esc(s.k)}</button>` : (c.stage === s.k ? pill(s.k, AOS.col(s.c)) : '')).join('')}</div></div>
    ${showFin ? `<div class="grid g2 tight"><div class="card kpi sm"><span class="lbl">CA ce mois</span><span class="v">${eurK(rev)}</span></div>
      <div class="card kpi sm"><span class="lbl">Part agence${showCon ? ` (${c.commission || 0} %)` : ''}</span><span class="v">${eurK(AOS.fin.com(S, mk, c.id))}</span></div></div>` : ''}
    <dl class="kv"><dt>Account manager</dt><dd>${c.managerId ? `<button class="linkbtn" data-open="team:${c.managerId}">${esc(nm('team', c.managerId))}</button>` : '<span class="faint">—</span>'}</dd>
      <dt>Équipe assignée</dt><dd>${(c.staff || []).filter(i => S.team.some(m => m.id === i)).map(i => `<button class="linkbtn" data-open="team:${i}">${esc(nm('team', i))}</button>`).join(', ') || '<span class="faint">—</span>'}</dd>
      <dt>Langue</dt><dd>${esc(c.language || '—')}</dd>
      <dt>Téléphone</dt><dd>${AOS.copyable(c.phone, 1)}</dd><dt>Email</dt><dd>${AOS.copyable(c.email)}</dd>
      ${showCon ? `<dt>Collaboration</dt><dd>${c.contractStart ? dShort(c.contractStart) + ' ' + c.contractStart.slice(0, 4) : '—'} → ${c.contractEnd ? dShort(c.contractEnd) + ' ' + c.contractEnd.slice(0, 4) : '—'}</dd>` : ''}
      <dt>Prochaine action</dt><dd>${esc(c.nextAction || '—')}</dd></dl>
    ${AOS.driveSection ? AOS.driveSection(c) : ''}
    ${c.notes ? `<div class="sec"><h5>Notes</h5><div class="pre">${esc(c.notes)}</div></div>` : ''}
    ${AOS.modOn('taches') ? `<div class="sec"><h5>Tâches ouvertes</h5><div class="card list">${ts.length ? ts.map(AOS.taskRow).join('') : '<div class="empty">Aucune.</div>'}</div></div>` : ''}
    ${AOS.modOn('planning') ? `<div class="sec"><h5>Événements à venir</h5><div class="card pad6">${es.length ? es.map(e => AOS.evRow(e, 1)).join('') : '<div class="empty">Aucun.</div>'}</div></div>` : ''}
    ${ns.length && AOS.modOn('sop') ? `<div class="sec"><h5>Notes liées</h5><div class="card list">${ns.map(n => `<div class="li click" data-edit="notes:${n.id}"><div class="grow"><div class="title">${esc(n.title)}</div><div class="sub">${esc(n.tag || '')}</div></div></div>`).join('')}</div></div>` : ''}
    <div class="actions">${canU ? `<button class="btn pri" data-edit="creators:${c.id}">Modifier la fiche</button>` : `<button class="btn" data-edit="creators:${c.id}">Voir toute la fiche</button>`}
      ${AOS.newBtn('tasks', 'Tâche', 0, `data-preset-creator-id="${c.id}"`)}${AOS.newBtn('events', 'Événement', 0, `data-preset-creator-id="${c.id}"`)}${AOS.newBtn('notes', 'Note', 0, `data-preset-creator-id="${c.id}"`)}</div>`;
  };
  AOS.act.setstage = el => { const c = S.creators.find(x => x.id === el.dataset.id); if (c) AOS.save('creators', { ...c, stage: el.dataset.v }); };
})();
