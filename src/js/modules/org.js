/* Agency OS — Départements and Présences & congés (leave requests, approvals, team calendar). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, av, pill, dot, today, addDays, dShort, sortBy, toast } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const team = () => S.team.filter(m => !m.archived);

  /* ================= Départements ================= */
  const deptDoc = name => S.depts.find(d => d.name === name);
  AOS.views.departements = function () {
    const L = AOS.lists(), t = today(), canU = AOS.allowed('depts', 'u') || AOS.allowed('depts', 'c');
    const cards = L.departments.map(name => {
      const d = deptDoc(name) || {}, ms = team().filter(m => m.dept === name);
      const here = ms.filter(m => !AOS.presence(S, L, m, t).away).length;
      const ids = new Set(ms.map(m => m.id)), open = AOS.openTasks().filter(x => ids.has(x.assigneeId)), late = open.filter(x => x.due && x.due < t);
      const goals = S.goals.filter(g => g.scope === 'Département' && g.dept === name && g.start <= t && g.end >= t);
      return `<article class="card dept">
        <div class="box-h"><h3>${esc(name)}</h3>${canU ? `<button class="btn sm ghost" data-a="deptedit" data-n="${esc(name)}">Modifier</button>` : ''}</div>
        <div class="dept-lead">${d.leadId ? `${av(AOS.nm('team', d.leadId))}<div><div class="strong">${esc(AOS.nm('team', d.leadId))}</div><div class="muted small">Responsable</div></div>` : '<span class="muted small">Pas de responsable désigné</span>'}</div>
        ${d.mission ? `<p class="muted">${esc(d.mission)}</p>` : ''}
        <div class="dept-stats"><div><b>${ms.length}</b><span>membre${ms.length > 1 ? 's' : ''}</span></div><div><b>${here}</b><span>présent${here > 1 ? 's' : ''}</span></div><div><b>${open.length}</b><span>tâches</span></div><div class="${late.length ? 'down' : ''}"><b>${late.length}</b><span>en retard</span></div></div>
        <div class="avs">${ms.map(m => `<button class="avbtn" data-open="team:${m.id}" title="${esc(m.name)} · ${esc(m.role || '')}">${av(m.name, '', AOS.colorOf(L, 'availability', m.avail))}</button>`).join('') || '<span class="faint small">Aucun membre</span>'}</div>
        ${goals.length ? goals.map(g => { const x = AOS.goalInfo(g); return `<button class="mg" data-edit="goals:${g.id}"><span class="mg-t">${esc(g.title)}</span><span class="mg-bar"><span style="width:${Math.min(100, x.pct * 100)}%;background:var(--accent)"></span></span></button>`; }).join('') : ''}
      </article>`;
    });
    return AOS.header({ eyebrow: 'Organisation', title: `${L.departments.length} départements`, actions: AOS.can(me.role, 'parametres', 'u') ? `<button class="btn pri" data-a="deptnew">${ic('plus', 15)}Département</button>` : '' }) +
      `<div class="depts">${cards.join('')}</div><p class="faint hint">Renommer ou supprimer un département : Paramètres › Personnalisation. Les membres se rattachent depuis leur fiche.</p>`;
  };
  AOS.act.deptedit = el => { const n = el.dataset.n, d = deptDoc(n); d ? AOS.openForm('depts', d.id) : AOS.openForm('depts', null, { name: n }); };
  AOS.act.deptnew = async () => {
    const n = await AOS.ask({ title: 'Nouveau département', label: 'Nom', ok: 'Créer' }); if (!n) return;
    const lists = JSON.parse(JSON.stringify(AOS.lists()));
    if (lists.departments.some(x => x.toLowerCase() === n.toLowerCase())) { toast('Ce département existe déjà.'); return; }
    lists.departments.push(n);
    const r = await AOS.applyOps([{ op: 'set', path: 'settings/lists', data: lists }]);
    if (r.ok) { AOS.audit({ act: 'settings', col: 'settings/lists', label: 'Département ajouté : ' + n }); AOS.openForm('depts', null, { name: n }); }
  };

  /* ================= Présences & congés ================= */
  const approver = () => AOS.allowed('leaves', 'u');
  AOS.views.presences = function () {
    const L = AOS.lists(), t = today(), days = ui.prDays || 14;
    let ms = team(); if (ui.prDept) ms = ms.filter(m => m.dept === ui.prDept);
    ms = sortBy(ms, m => m.name);
    const pres = new Map(ms.map(m => [m.id, AOS.presence(S, L, m, t)]));
    const absent = ms.filter(m => pres.get(m.id).away);
    const pending = sortBy(S.leaves.filter(l => l.status === 'En attente'), l => l.start);
    const range = [...Array(days)].map((_, i) => addDays(t, i));
    const cell = (m, d) => {
      const l = S.leaves.find(x => x.memberId === m.id && x.status !== 'Refusée' && x.start <= d && x.end >= d);
      const wd = new Date(d + 'T12:00').getDay(), we = wd === 0 || wd === 6;
      return `<td class="${we ? 'we' : ''} ${d === t ? 'now' : ''}">${l ? `<span class="lv ${l.status === 'En attente' ? 'pend' : ''}" style="--c:${AOS.colorOf(L, 'leaveTypes', l.type)}" title="${esc(l.type)} · ${esc(l.status)}" data-edit="leaves:${l.id}"></span>` : ''}</td>`;
    };
    const mineId = me.role && me.role.memberId;
    const upcoming = sortBy(S.leaves.filter(l => l.end >= t && (approver() || l.memberId === mineId)), l => l.start);
    return AOS.header({ eyebrow: 'Organisation', title: `${absent.length} absent${absent.length > 1 ? 's' : ''} <span class="soft">aujourd'hui sur ${ms.length}.</span>`,
      actions: AOS.allowed('leaves', 'c') ? `<button class="btn pri" data-new="leaves" ${mineId ? `data-preset-member-id="${mineId}"` : ''}>${ic('plus', 15)}Déclarer une absence</button>` : '' }) +
    (pending.length && approver() ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--warn)')}À valider · ${pending.length}</span></div>
      ${pending.map(l => `<div class="line" data-edit="leaves:${l.id}">${av(AOS.nm('team', l.memberId))}<span class="what"><span class="ttl">${esc(AOS.nm('team', l.memberId))} · ${esc(l.type)}</span><span class="sub">${dShort(l.start)} → ${dShort(l.end)}${l.note ? ' · ' + esc(l.note) : ''}</span></span>
        <button class="btn sm" data-a="leavedecide" data-id="${l.id}" data-v="Refusée">Refuser</button><button class="btn sm pri" data-a="leavedecide" data-id="${l.id}" data-v="Validée">Valider</button></div>`).join('')}</section>` : '') +
    `<div class="toolbar"><select class="input" id="prDept" aria-label="Département"><option value="">Tous les départements</option>${L.departments.map(d => `<option ${ui.prDept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
      <div class="seg"><button class="${days === 14 ? 'on' : ''}" data-a="prdays" data-v="14">14 jours</button><button class="${days === 31 ? 'on' : ''}" data-a="prdays" data-v="31">31 jours</button></div>
      <div class="legend">${L.leaveTypes.map(x => `<span>${dot(AOS.col(x.c))}${esc(x.k)}</span>`).join('')}<span><i class="lv pend demo-sw"></i>en attente</span></div></div>
    <section class="card"><div class="tbl-wrap"><table class="teamcal"><thead><tr><th>Équipe</th>${range.map(d => { const z = new Date(d + 'T12:00'); return `<th class="c ${d === t ? 'now' : ''}">${z.toLocaleDateString('fr-FR', { weekday: 'narrow' })}<br><b>${z.getDate()}</b></th>`; }).join('')}</tr></thead>
      <tbody>${ms.map(m => `<tr class="static"><td><button class="who linkbtn" data-open="team:${m.id}">${av(m.name, '', AOS.colorOf(L, 'availability', m.avail))}<span>${esc(m.name)}</span></button></td>${range.map(d => cell(m, d)).join('')}</tr>`).join('')}</tbody></table></div></section>
    <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--accent)')}Aujourd'hui, personne par personne</span></div>
      <div class="pr-legend"><span><b>Horaires</b> planifiés dans la fiche</span><span><b>Statut</b> déclaré par la personne ou son responsable</span><span><b>Absence</b> validée ici, qui l'emporte sur le statut</span></div>
      ${ms.map(m => { const p = pres.get(m.id); return `<div class="line" data-open="team:${m.id}">${av(m.name)}<span class="what"><span class="ttl">${esc(m.name)}</span><span class="sub">${esc(m.shift || 'horaires non renseignés')}</span></span>
        ${p.leave ? pill(`${p.leave.type} jusqu'au ${dShort(p.leave.end)}`, AOS.colorOf(L, 'leaveTypes', p.leave.type)) : pill(p.declared || '—', AOS.colorOf(L, 'availability', p.declared))}</div>`; }).join('')}
      <p class="faint hint pad-x">La présence réellement constatée n'est pas mesurée : aucun outil de pointage n'est connecté.</p></section>
    ${upcoming.length ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--violet)')}Absences en cours et à venir</span></div>${upcoming.map(l => `<div class="line" data-edit="leaves:${l.id}"><span class="when"><b>${dShort(l.start)}</b><small>→ ${dShort(l.end)}</small></span><span class="what"><span class="ttl">${esc(AOS.nm('team', l.memberId))}</span><span class="sub">${esc(l.type)}${l.note ? ' · ' + esc(l.note) : ''}</span></span>${pill(l.status, l.status === 'Validée' ? 'var(--ok)' : l.status === 'Refusée' ? 'var(--bad)' : 'var(--warn)')}</div>`).join('')}</section>` : ''}`;
  };
  AOS.changes.prDept = el => { ui.prDept = el.value; AOS.render(); };
  AOS.act.prdays = el => { ui.prDays = +el.dataset.v; AOS.render(); };
  AOS.act.leavedecide = async el => {
    const l = S.leaves.find(x => x.id === el.dataset.id); if (!l) return;
    if (await AOS.save('leaves', { ...l, status: el.dataset.v })) {
      toast(`Absence ${el.dataset.v.toLowerCase()}`);
      if (el.dataset.v === 'Validée') {
        const n = AOS.openTasks().filter(x => x.assigneeId === l.memberId && x.due && x.due >= l.start && x.due <= l.end).length;
        if (n) toast(`${AOS.nm('team', l.memberId)} a ${n} tâche(s) à échéance pendant son absence : pense à les réattribuer.`, 'bad');
      }
    }
  };
})();
