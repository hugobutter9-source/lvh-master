/* Accompagnement: students, payments, their dated notes, and coaching calls planned straight into the Agenda.
   The notes of the last call are shown again before the next one (see AOS.briefHtml in agency.js). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, av, pill, dot, today, dShort, sortBy, eur, toast } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const L = () => AOS.lists();
  const kind = s => AOS.kindOf(L(), 'studentStages', s.stage);
  const callsOf = id => S.calls.filter(c => c.studentId === id);
  const nextCall = id => sortBy(callsOf(id).filter(c => AOS.kindOf(L(), 'callStatus', c.status) === 'planned' && c.date >= today()), c => c.date + (c.time || ''))[0];
  const notesOf = id => [...S.snotes.filter(n => n.studentId === id)].sort((a, b) => (b.at || 0) - (a.at || 0));
  const COACH_TYPE = 'Coaching élève';
  const doneCalls = id => callsOf(id).filter(c => { const k = AOS.kindOf(L(), 'callStatus', c.status); return k !== 'planned' && k !== 'cancelled'; }).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const rest = s => Math.max(0, (+s.price || 0) - (+s.paid || 0));
  const people = s => Math.max(1, Math.round(+s.people || 1));
  const payLate = s => rest(s) > 0 && s.payNext && s.payNext < today();
  /* "3 mois et 12 jours": how long we have been working together */
  AOS.sinceTxt = function (start) {
    if (!start) return '';
    const a = new Date(start + 'T12:00'), b = new Date(today() + 'T12:00');
    if (a > b) return `débute dans ${AOS.diffDays(start, today())} j`;
    let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--;
    const ref = new Date(a); ref.setMonth(ref.getMonth() + m);
    const d = Math.round((b - ref) / 864e5), y = Math.floor(m / 12), mm = m % 12;
    if (y) return `${y} an${y > 1 ? 's' : ''}${mm ? ` et ${mm} mois` : ''}`;
    if (m) return `${m} mois${d ? ` et ${d} j` : ''}`;
    return d ? `${d} jour${d > 1 ? 's' : ''}` : "aujourd'hui";
  };
  AOS.studentRest = rest; AOS.studentPayLate = payLate;

  /* plan a call: a normal call (Agenda, dashboard, notifications) linked to the student */
  AOS.planStudentCall = function (st) {
    const planned = (L().callStatus.find(x => x.kind === 'planned') || {}).k;
    AOS.openForm('calls', null, { title: st.name, studentId: st.id, type: COACH_TYPE, status: planned, ownerId: st.coachId || (me.role && me.role.memberId) || '' }, { title: 'Planifier un call avec ' + esc(st.name) });
  };

  AOS.views.accompagnement = function () {
    const stages = L().studentStages, f = ui.stStage || 'active';
    let list = S.students;
    if (f !== 'all') list = list.filter(s => kind(s) === f);
    if (ui.stProg) list = list.filter(s => s.program === ui.stProg);
    if (ui.stQ) { const q = ui.stQ.toLowerCase(); list = list.filter(s => [s.name, s.handle, s.step, s.goal].join(' ').toLowerCase().includes(q)); }
    list = sortBy(list, s => { const n = nextCall(s.id); return (n ? n.date + (n.time || '') : '9999') + s.name; });
    const active = S.students.filter(s => kind(s) === 'active').length;
    const week = S.calls.filter(c => c.studentId && AOS.kindOf(L(), 'callStatus', c.status) === 'planned' && c.date >= today() && c.date <= AOS.addDays(today(), 7)).length;
    const fin = AOS.flag(me.role, 'finance_view'), due = fin ? S.students.reduce((t, s) => t + rest(s), 0) : 0;
    const heads = S.students.filter(s => kind(s) === 'active').reduce((t, s) => t + people(s), 0), lateN = fin ? S.students.filter(payLate).length : 0;
    const canC = AOS.allowed('students', 'c');
    return AOS.header({ eyebrow: 'Agence', title: `${active} élève${active > 1 ? 's' : ''} <span class="soft">en cours.</span>`, actions: AOS.newBtn('students', 'Nouvel élève', 1) }) +
    `<section class="card stats">
      <div class="st"><b>${active}</b><span>en cours</span></div>
      <div class="st"><b>${week}</b><span>call${week > 1 ? 's' : ''} sur 7 jours</span></div>
      <div class="st"><b>${heads}</b><span>personne${heads > 1 ? 's' : ''} accompagnée${heads > 1 ? 's' : ''}</span></div>
      ${fin ? `<div class="st"><b class="${due ? 'warn-t' : ''}">${eur(due)}</b><span>reste à encaisser${lateN ? ` · <i class="down">${lateN} en retard</i>` : ''}</span></div>` : `<div class="st"><b>${S.snotes.length}</b><span>notes</span></div>`}</section>
    <div class="toolbar"><input class="input" id="stQ" placeholder="Rechercher un élève, une étape…" value="${esc(ui.stQ || '')}">
      <select class="input" id="stProg" aria-label="Programme"><option value="">Tous les programmes</option>${L().programs.map(p => `<option ${ui.stProg === p.k ? 'selected' : ''}>${esc(p.k)}</option>`).join('')}</select>
      <div class="chips">${[['active', 'En cours'], ['lead', 'Inscrits'], ['paused', 'En pause'], ['done', 'Terminés'], ['all', 'Tous']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="ststage" data-v="${k}">${l} · ${k === 'all' ? S.students.length : S.students.filter(s => kind(s) === k).length}</button>`).join('')}</div></div>
    ${list.length ? `<div class="students">${list.map(s => { const n = nextCall(s.id), last = notesOf(s.id)[0], lc = doneCalls(s.id)[0], pr = Math.max(0, Math.min(100, +s.progress || 0)), since = AOS.sinceTxt(s.start), r = rest(s);
      return `<article class="card student" data-open="students:${s.id}" tabindex="0">
        <div class="who">${av(s.name, 'lg')}<div class="grow"><h4>${esc(s.name)}${AOS.demoTag(s)}</h4><div class="muted small">${esc(s.handle || '')}</div></div>${pill(s.stage || '—', AOS.colorOf(L(), 'studentStages', s.stage))}</div>
        <div class="g-top">${s.program ? pill(s.program, AOS.colorOf(L(), 'programs', s.program)) : ''}${s.coachId ? `<span class="tag">${esc(AOS.nm('team', s.coachId))}</span>` : ''}</div>
        <div><div class="row-between small"><span class="muted">${esc(s.step || 'Progression')}</span><b class="mono">${pr} %</b></div><div class="mg-bar"><span style="width:${pr}%;background:var(--accent)"></span></div></div>
        <div class="st-meta">${since ? `<span>${ic('clock', 13)}${esc(since)}</span>` : ''}<span>${ic('users', 13)}${people(s)} pers.</span>${fin && (+s.price || 0) ? `<span class="${payLate(s) ? 'bad-t' : r ? 'warn-t' : ''}">${ic('euro', 13)}${r ? 'reste ' + eur(r) : 'payé'}</span>` : ''}</div>
        ${lc && ((lc.prep || lc.result || '').trim()) ? `<p class="st-last"><b>Dernier call ${dShort(lc.date)} :</b> ${esc((lc.prep || lc.result).trim())}</p>` : last ? `<p class="st-last">${pill(last.tag || 'Note', AOS.colorOf(L(), 'studentNoteTags', last.tag))} ${esc(last.text)}</p>` : ''}
        <div class="row-between"><span class="small ${n ? '' : 'faint'}">${ic('phone', 13)} ${n ? `Prochain call ${n.date === today() ? "aujourd'hui" : 'le ' + dShort(n.date)}${n.time ? ' à ' + n.time.replace(':', 'h') : ''}` : 'Aucun call prévu'}</span>
          <span class="actions">${n ? `<button class="btn sm" data-a="callbrief" data-id="${n.id}">${ic('book', 13)}Brief</button>` : ''}${AOS.allowed('calls', 'c') ? `<button class="btn sm" data-a="stcall" data-id="${s.id}">${ic('plus', 13)}Call</button>` : ''}</span></div></article>`; }).join('')}</div>`
      : `<section class="card box"><div class="box-empty"><p>${S.students.length ? 'Aucun élève dans cette vue.' : 'Ajoute tes accompagnements : programme, paiements, calls et notes au même endroit.'}</p>${canC && !S.students.length ? AOS.newBtn('students', 'Ajouter mon premier élève', 1) : ''}</div></section>`}`;
  };
  AOS.inputs.stQ = el => { ui.stQ = el.value; AOS.render(); };
  AOS.changes.stProg = el => { ui.stProg = el.value; AOS.render(); };
  AOS.act.ststage = el => { ui.stStage = el.dataset.v; AOS.render(); };
  AOS.act.stcall = el => { const s = S.students.find(x => x.id === el.dataset.id); if (s) AOS.planStudentCall(s); };

  /* ---------- fiche élève: info, calls, notes timeline ---------- */
  AOS.drawers.student = function (id) {
    const s = S.students.find(x => x.id === id); if (!s) return '';
    const fin = AOS.flag(me.role, 'finance_view'), pr = Math.max(0, Math.min(100, +s.progress || 0));
    const calls = sortBy(callsOf(s.id), c => c.date + (c.time || '')), up = calls.filter(c => AOS.kindOf(L(), 'callStatus', c.status) === 'planned'), past = calls.filter(c => !up.includes(c)).reverse();
    const notes = notesOf(s.id), canN = AOS.allowed('snotes', 'c'), canU = AOS.allowed('students', 'u');
    const done = doneCalls(s.id), lc = done[0], nc = up.filter(c => c.date >= today())[0], since = AOS.sinceTxt(s.start), r = rest(s), pays = [...(s.payments || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<div class="dh">${av(s.name, 'lg')}<div class="grow"><h2>${esc(s.name)}${AOS.demoTag(s)}</h2><div class="muted">${[s.handle, s.program].filter(Boolean).map(esc).join(' · ')}</div></div><button class="btn sm ghost" data-a="closedrawer" aria-label="Fermer">${ic('x')}</button></div>
    <div class="chips">${L().studentStages.map(x => AOS.allowed('students', 'u') ? `<button class="chip ${s.stage === x.k ? 'on' : ''}" data-a="ststageset" data-id="${s.id}" data-v="${esc(x.k)}">${esc(x.k)}</button>` : (s.stage === x.k ? pill(x.k, AOS.col(x.c)) : '')).join('')}</div>
    <div class="card pad stack tight"><div class="row-between"><span class="muted">${esc(s.step || 'Progression')}</span><b class="mono">${pr} %</b></div><div class="mg-bar"><span style="width:${pr}%;background:var(--accent)"></span></div>
      ${AOS.allowed('students', 'u') ? `<div class="chips">${[-10, 10, 25].map(d => `<button class="chip" data-a="stprog" data-id="${s.id}" data-v="${d}">${d > 0 ? '+' : ''}${d} %</button>`).join('')}</div>` : ''}</div>
    ${lc || nc ? `<div class="card pad stack tight brief-card"><div class="row-between"><b>${ic('book', 14)} ${nc ? `Avant le call ${nc.date === today() ? "d'aujourd'hui" : 'du ' + dShort(nc.date)}${nc.time ? ' à ' + nc.time.replace(':', 'h') : ''}` : 'Dernier call'}</b>${nc ? `<button class="btn sm" data-a="callbrief" data-id="${nc.id}">Brief complet</button>` : ''}</div>
      ${lc ? `<div class="small muted">Dernier call le ${dShort(lc.date)}</div><div class="pre brief-note">${(lc.result || '').trim() ? esc(lc.result) : '<span class="faint">Aucune note écrite pour ce call.</span>'}</div>
        ${(lc.prep || '').trim() ? `<div class="small muted">À aborder cette fois</div><div class="pre brief-note hl">${esc(lc.prep)}</div>` : ''}
        ${!(lc.result || '').trim() && AOS.allowed('calls', 'u') ? `<div><button class="btn sm pri" data-a="callwrite" data-id="${lc.id}">${ic('pen', 13)}Écrire les notes de ce call</button></div>` : ''}` : '<div class="small muted">Premier call : pas encore de notes à relire.</div>'}</div>` : ''}
    <dl class="kv"><dt>Ensemble depuis</dt><dd>${since ? `<b>${esc(since)}</b>` : '<span class="faint">Renseigne la date de début</span>'}</dd>
      <dt>Personnes</dt><dd>${people(s)}</dd>
      <dt>Calls</dt><dd>${done.length} fait${done.length > 1 ? 's' : ''}${lc ? ` · dernier le ${dShort(lc.date)}` : ''}${s.callEvery ? ` · ${esc(s.callEvery)}` : ''}</dd>
      <dt>Coach</dt><dd>${s.coachId ? `<button class="linkbtn" data-open="team:${s.coachId}">${esc(AOS.nm('team', s.coachId))}</button>` : '<span class="faint">—</span>'}</dd>
      <dt>Période</dt><dd>${s.start ? dShort(s.start) : '—'} → ${s.end ? dShort(s.end) : '—'}</dd>
      <dt>Téléphone</dt><dd>${AOS.copyable(s.phone, 1)}</dd><dt>Email</dt><dd>${AOS.copyable(s.email)}</dd><dt>Telegram</dt><dd>${AOS.copyable(s.telegram)}</dd></dl>
    ${fin ? `<div class="sec"><h5>${ic('euro', 12)} Paiements</h5><div class="card pad stack tight">
      <div class="pay-top"><div><span>Reste à payer</span><b class="${payLate(s) ? 'bad-t' : r ? 'warn-t' : 'ok-t'}">${eur(r)}</b></div><div><span>Payé</span><b>${eur(+s.paid || 0)}</b></div><div><span>Prix total</span><b>${eur(+s.price || 0)}</b></div></div>
      <div class="mg-bar"><span style="width:${(+s.price || 0) ? Math.min(100, (+s.paid || 0) / (+s.price) * 100) : 0}%;background:var(--ok)"></span></div>
      ${s.payNext && r ? `<div class="small ${payLate(s) ? 'bad-t' : 'muted'}">${payLate(s) ? 'Échéance dépassée depuis le' : 'Prochaine échéance le'} ${dShort(s.payNext)}${s.payPlan ? ' · ' + esc(s.payPlan) : ''}</div>` : s.payPlan ? `<div class="small muted">${esc(s.payPlan)}</div>` : ''}
      ${canU ? `<form class="pay-form" id="stPayForm" data-id="${s.id}"><input class="input" name="a" type="number" min="0" step="any" placeholder="Montant (€)" aria-label="Montant reçu"><input class="input" name="d" type="date" value="${today()}" aria-label="Date du paiement"><button class="btn sm pri">Encaisser</button></form>` : ''}
      ${pays.length ? `<div class="pay-list">${pays.map(p => `<div class="row-between small"><span>${dShort(p.date)}</span><span class="row-gap"><b class="mono">${eur(+p.amount || 0)}</b>${canU ? `<button class="iconbtn" data-a="stpaydel" data-id="${s.id}" data-p="${esc(p.id)}" aria-label="Annuler ce paiement">${ic('x', 12)}</button>` : ''}</span></div>`).join('')}</div>` : ''}</div></div>` : ''}
    ${s.goal ? `<div class="sec"><h5>Son objectif</h5><div class="pre">${esc(s.goal)}</div></div>` : ''}
    <div class="sec"><h5>${ic('phone', 12)} Calls</h5><div class="card list">
      ${up.length ? up.map(c => `<div class="li click" data-edit="calls:${c.id}"><div class="grow"><div class="title">${c.date === today() ? "Aujourd'hui" : dShort(c.date)}${c.time ? ' à ' + c.time.replace(':', 'h') : ''}</div><div class="sub">${esc(c.type || '')}${c.place ? ' · ' + esc(c.place) : ''}</div></div>${pill('Prévu', 'var(--info)')}</div>`).join('') : '<div class="empty">Aucun call prévu.</div>'}
      ${past.slice(0, 5).map(c => `<div class="li click" data-edit="calls:${c.id}"><div class="grow"><div class="title">${dShort(c.date)} · ${esc(c.status)}</div><div class="sub">${esc(c.result || 'Pas de notes')}</div></div>${(c.result || '').trim() ? '' : pill('Notes à écrire', 'var(--violet)')}</div>`).join('')}</div>
      ${AOS.allowed('calls', 'c') ? `<div style="margin-top:10px"><button class="btn pri" data-a="stcall" data-id="${s.id}">${ic('cal', 14)}Planifier un call</button></div>` : ''}</div>
    <div class="sec"><h5>Notes</h5>
      ${canN ? `<form class="card pad stack tight" id="stNoteForm" data-id="${s.id}"><textarea name="t" rows="3" placeholder="Ce qu'il s'est dit, ses progrès, ses blocages…" class="input" aria-label="Nouvelle note"></textarea>
        <div class="row-between"><select name="g" class="input" aria-label="Type de note">${L().studentNoteTags.map(x => `<option>${esc(x.k)}</option>`).join('')}</select><button class="btn pri sm">Ajouter la note</button></div></form>` : ''}
      <div class="timeline">${notes.length ? notes.map(n => `<div class="tl"><span class="tl-dot" style="--c:${AOS.colorOf(L(), 'studentNoteTags', n.tag)}"></span><div class="grow"><div class="row-between"><span class="small">${pill(n.tag || 'Note', AOS.colorOf(L(), 'studentNoteTags', n.tag))} <span class="faint">${AOS.dTime(n.at)}${n.byName ? ' · ' + esc(n.byName) : ''}</span></span>${AOS.allowed('snotes', 'd') ? `<button class="iconbtn" data-a="stnotedel" data-id="${n.id}" aria-label="Supprimer la note">${ic('x', 13)}</button>` : ''}</div><div class="pre">${esc(n.text)}</div></div></div>`).join('') : '<p class="faint">Aucune note pour l\'instant.</p>'}</div></div>
    <div class="actions">${AOS.allowed('students', 'u') ? `<button class="btn" data-edit="students:${s.id}">Modifier la fiche</button>` : ''}</div>`;
  };
  const prevOpen = AOS.openRecord;
  AOS.openRecord = (col, id) => col === 'students' ? AOS.openDrawer('student', id) : prevOpen(col, id);
  Object.assign(AOS.act, {
    ststageset: el => { const s = S.students.find(x => x.id === el.dataset.id); if (s) AOS.save('students', { ...s, stage: el.dataset.v }); },
    stprog: el => { const s = S.students.find(x => x.id === el.dataset.id); if (s) AOS.save('students', { ...s, progress: Math.max(0, Math.min(100, (+s.progress || 0) + +el.dataset.v)) }); },
    stpaydel: async el => {
      const s = S.students.find(x => x.id === el.dataset.id), p = s && (s.payments || []).find(x => x.id === el.dataset.p); if (!p) return;
      if (!(await AOS.confirm({ title: 'Annuler ce paiement ?', body: `${eur(+p.amount || 0)} du ${dShort(p.date)} sera retiré du total payé.`, ok: 'Annuler le paiement', danger: 1 }))) return;
      if (await AOS.save('students', { ...s, payments: s.payments.filter(x => x.id !== p.id), paid: Math.max(0, (+s.paid || 0) - (+p.amount || 0)) })) toast('Paiement annulé');
    },
    stnotedel: async el => { if (await AOS.confirm({ title: 'Supprimer cette note ?', ok: 'Supprimer', danger: 1 })) AOS.remove('snotes', el.dataset.id); }
  });
  /* the note form lives in the drawer, which is re-rendered on data changes: submit is delegated */
  document.addEventListener('submit', async e => {
    const f = e.target; if (f.id !== 'stPayForm') return; e.preventDefault();
    const s = S.students.find(x => x.id === f.dataset.id), amount = +String(f.a.value).replace(',', '.');
    if (!s || !(amount > 0)) { toast('Indique le montant reçu.'); f.a.focus(); return; }
    const date = f.d.value || today(); f.a.value = '';
    if (await AOS.save('students', { ...s, payments: [...(s.payments || []), { id: AOS.uid(), amount, date }], paid: (+s.paid || 0) + amount })) toast(`${eur(amount)} encaissés`);
  });
  document.addEventListener('submit', async e => {
    const f = e.target; if (f.id !== 'stNoteForm') return; e.preventDefault();
    const text = f.t.value.trim(); if (!text) return;
    const tag = f.g.value; f.t.value = '';
    const me2 = me.role && me.role.memberId ? AOS.nm('team', me.role.memberId) : (S.settings.owner || '');
    if (await AOS.save('snotes', { studentId: f.dataset.id, text, tag, at: Date.now(), byName: me2 })) toast('Note ajoutée');
  });
})();
