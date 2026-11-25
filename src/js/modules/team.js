/* Agency OS — Organigramme, Équipe (annuaire) and the collaborator fiche. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, av, pill, dot, dShort, sortBy } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const active = () => S.team.filter(m => !m.archived);

  function legend() {
    const L = AOS.lists();
    return `<div class="legend">${L.availability.map(a => `<span>${dot(AOS.col(a.c))}${esc(a.k)} <b class="num">${active().filter(m => m.avail === a.k).length}</b></span>`).join('')}</div>`;
  }
  AOS.views.organigramme = function () {
    const L = AOS.lists(), team = active(), nAv = team.filter(m => AOS.kindOf(L, 'availability', m.avail) === 'available').length;
    return AOS.header({ eyebrow: 'Organisation', title: `${team.length} personne${team.length > 1 ? 's' : ''} <span class="soft">· ${nAv} disponible${nAv > 1 ? 's' : ''}.</span>`, actions: AOS.newBtn('team', 'Collaborateur', 1) }) +
      `<div class="toolbar">${legend()}</div>` +
      (!team.length ? `<div class="card"><div class="empty big">Ajoute les membres de ton agence et indique leur responsable direct : l'organigramme se dessine tout seul.</div></div>` :
      `${AOS.orgCanvas()}<p class="faint hint">Clique sur une personne pour ouvrir sa fiche. Les statuts sont <b>déclarés</b> (par la personne ou son responsable) : l'application ne vérifie pas la présence réelle. Un lien hiérarchique est le « Responsable direct » de la fiche ; les liens libres et les cases ne servent qu'au dessin.</p>`);
  };

  AOS.views.equipe = function () {
    const L = AOS.lists(), R = me.role;
    let rows = active();
    if (ui.teamDept) rows = rows.filter(m => m.dept === ui.teamDept);
    if (ui.teamQ) { const q = ui.teamQ.toLowerCase(); rows = rows.filter(m => [m.name, m.role, m.dept, m.phone, m.email, m.telegram].join(' ').toLowerCase().includes(q)); }
    return AOS.header({ eyebrow: 'Organisation', title: `Équipe <span class="soft">· ${active().length} collaborateurs.</span>`, actions: `${AOS.can(R, 'equipe', 'x') ? `<button class="btn" data-a="csvexport" data-col="team">${ic('download', 15)}CSV</button>` : ''}${AOS.newBtn('team', 'Collaborateur', 1)}` }) +
    `<div class="toolbar"><input class="input" id="teamQ" placeholder="Rechercher un nom, un poste, un numéro…" value="${esc(ui.teamQ)}">
      <select class="input" id="teamDept" aria-label="Département"><option value="">Tous les départements</option>${L.departments.map(d => `<option ${ui.teamDept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>${legend()}</div>
    <div class="card tbl-wrap">${rows.length ? `<table><thead><tr><th>Nom</th><th>Poste</th><th>Département</th><th>Statut déclaré</th><th>Horaires</th><th>Téléphone</th><th>Email</th><th>Telegram</th><th>Responsable</th></tr></thead><tbody>
    ${sortBy(rows, m => String(L.departments.indexOf(m.dept)).padStart(3, '0') + m.name).map(m => `<tr data-open="team:${m.id}" tabindex="0"><td><div class="who">${av(m.name, '', AOS.colorOf(L, 'availability', m.avail))}<b class="strong">${esc(m.name)}</b>${AOS.demoTag(m)}</div></td>
      <td>${esc(m.role || '')}</td><td class="muted">${esc(m.dept || '')}</td><td>${m.avail ? pill(m.avail, AOS.colorOf(L, 'availability', m.avail)) : ''}</td><td class="mono muted">${esc(m.shift || '')}</td>
      <td class="mono">${esc(m.phone || '')}</td><td class="muted">${esc(m.email || '')}</td><td class="muted">${esc(m.telegram || '')}</td><td class="muted">${esc(AOS.nm('team', m.reportsTo))}</td></tr>`).join('')}
    </tbody></table>` : `<div class="empty big">${S.team.length ? 'Personne ne correspond à ce filtre.' : 'Ajoute ton premier collaborateur.'}</div>`}</div>`;
  };
  AOS.inputs.teamQ = el => { ui.teamQ = el.value; AOS.render(); };
  AOS.changes.teamDept = el => { ui.teamDept = el.value; AOS.render(); };

  /* ---------- fiche collaborateur ---------- */
  AOS.drawers.member = function (id) {
    const m = S.team.find(x => x.id === id); if (!m) return '';
    const L = AOS.lists(), R = me.role;
    const reports = active().filter(x => x.reportsTo === m.id && x.id !== m.id);
    const crs = S.creators.filter(c => c.managerId === m.id || (c.staff || []).includes(m.id));
    const ts = sortBy(AOS.openTasks().filter(t => t.assigneeId === m.id), t => t.due || '9999');
    const isSelf = R && R.memberId === m.id, canU = AOS.allowed('team', 'u'), canStatus = canU || isSelf;
    const pay = S.payroll.find(p => p.id === m.id), showPay = AOS.flag(R, 'salary_view');
    return `<div class="dh">${av(m.name, 'lg', AOS.colorOf(L, 'availability', m.avail))}<div class="grow"><h2>${esc(m.name)}${AOS.demoTag(m)}</h2><div class="muted">${[m.role, m.dept].filter(Boolean).map(esc).join(' · ')}</div></div><button class="btn sm ghost" data-a="closedrawer" aria-label="Fermer">${ic('x')}</button></div>
    <div class="sec"><h5>Statut déclaré</h5><div class="chips">${L.availability.map(a => canStatus ? `<button class="chip ${m.avail === a.k ? 'on' : ''}" data-a="setavail" data-id="${m.id}" data-v="${esc(a.k)}">${dot(AOS.col(a.c))}${esc(a.k)}</button>` : (m.avail === a.k ? pill(a.k, AOS.col(a.c)) : '')).join('')}</div>
      <p class="faint small">Déclaratif. Horaires planifiés : ${esc(m.shift || 'non renseignés')}.</p></div>
    <dl class="kv"><dt>Téléphone</dt><dd>${AOS.copyable(m.phone, 1)}</dd><dt>Email</dt><dd>${AOS.copyable(m.email)}</dd><dt>Telegram</dt><dd>${AOS.copyable(m.telegram)}</dd>
      <dt>Localisation</dt><dd>${esc(m.location || '—')}</dd>
      <dt>Responsable</dt><dd>${m.reportsTo && S.team.some(x => x.id === m.reportsTo) ? `<button class="linkbtn" data-open="team:${m.reportsTo}">${esc(AOS.nm('team', m.reportsTo))}</button>` : '<span class="faint">—</span>'}</dd>
      <dt>Équipe directe</dt><dd>${reports.map(r => `<button class="linkbtn" data-open="team:${r.id}">${esc(r.name)}</button>`).join(', ') || '<span class="faint">—</span>'}</dd>
      <dt>Missions</dt><dd>${esc(m.missions || '—')}</dd>
      <dt>Arrivée</dt><dd>${m.startDate ? dShort(m.startDate) + ' ' + m.startDate.slice(0, 4) : '—'}</dd></dl>
    ${showPay ? `<div class="sec"><h5>${ic('lock', 12)} Rémunération · confidentiel</h5><div class="card pad">${pay ? `<div>${esc(pay.pay || '—')}</div>${pay.notes ? `<div class="muted small pre">${esc(pay.notes)}</div>` : ''}` : '<span class="faint">Non renseignée.</span>'}
      ${AOS.allowed('payroll', 'u') ? `<div style="margin-top:10px"><button class="btn sm" data-a="editpay" data-id="${m.id}">${pay ? 'Modifier' : 'Renseigner'}</button></div>` : ''}</div><p class="faint small">Calcul automatique des paies et historique : phase 2.</p></div>` : ''}
    ${m.notes ? `<div class="sec"><h5>Notes</h5><div class="pre">${esc(m.notes)}</div></div>` : ''}
    ${AOS.modOn('creatrices') ? `<div class="sec"><h5>Créatrices suivies</h5><div class="card list">${crs.length ? crs.map(c => `<div class="li click" data-open="creators:${c.id}">${av(c.name)}<div class="grow"><div class="title">${esc(c.name)}</div><div class="sub">${c.managerId === m.id ? 'Account manager' : 'Équipe assignée'}</div></div>${pill(c.stage, AOS.colorOf(L, 'stages', c.stage))}</div>`).join('') : '<div class="empty">Aucune.</div>'}</div></div>` : ''}
    ${AOS.modOn('taches') ? `<div class="sec"><h5>Tâches ouvertes</h5><div class="card list">${ts.length ? ts.map(AOS.taskRow).join('') : '<div class="empty">Aucune.</div>'}</div></div>` : ''}
    <div class="actions">${canU ? `<button class="btn pri" data-edit="team:${m.id}">Modifier la fiche</button>` : ''}${AOS.newBtn('tasks', 'Lui assigner une tâche', 0, `data-preset-assignee-id="${m.id}"`)}</div>`;
  };
  AOS.act.setavail = async el => {
    const m = S.team.find(x => x.id === el.dataset.id); if (!m) return;
    const v = el.dataset.v;
    if (AOS.allowed('team', 'u')) { if (await AOS.save('team', { ...m, avail: v })) AOS.toast(`${m.name} : ${v}`); return; }
    if (me.role && me.role.memberId === m.id) {   // a collaborator may declare their own status
      const r = await AOS.applyOps([{ op: 'set', col: 'team', id: m.id, data: { ...m, avail: v, updatedAt: Date.now() } }]);
      if (r.ok) { AOS.audit({ act: 'update', col: 'team', docId: m.id, label: m.name, keys: ['avail'] }); AOS.toast('Statut mis à jour'); }
    }
  };
  AOS.act.editpay = el => {
    const m = S.team.find(x => x.id === el.dataset.id), exists = S.payroll.some(p => p.id === m.id);
    AOS.openForm('payroll', exists ? m.id : null, { memberId: m.id, ...(m.demo ? { demo: true } : {}) }, { id: m.id, title: 'Rémunération : ' + esc(m.name) });
  };
})();
