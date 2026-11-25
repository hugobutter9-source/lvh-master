/* Agency OS — Dashboard (centre de commandement). Every number is computed from stored records. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, av, pill, dot, today, addDays, diffDays, dShort, dLong, eur, eurK, monthLabel, shiftMonth, sortBy } = AOS;
  const status = AOS.status;
  const S = AOS.S, me = AOS.me;

  /* shared row renderers, reused by other modules */
  AOS.taskRow = function (t) {
    const L = AOS.lists(), who = nm('team', t.assigneeId), cr = nm('creators', t.creatorId), done = AOS.kindOf(L, 'taskStatus', t.status) === 'done';
    const canU = AOS.allowed('tasks', 'u');
    return `<div class="li click ${done ? 'done' : ''}" data-edit="tasks:${t.id}">
      ${canU ? `<button class="check ${done ? 'on' : ''}" data-a="toggletask" data-id="${t.id}" aria-label="${done ? 'Rouvrir' : 'Marquer comme faite'}">${done ? ic('ok', 12) : ''}</button>` : `<span class="check ${done ? 'on' : ''}">${done ? ic('ok', 12) : ''}</span>`}
      <div class="grow"><div class="title">${esc(t.title)}${repTag(t)}${demoTag(t)}</div><div class="sub">${[who, cr].filter(Boolean).map(esc).join(' · ') || 'Non assignée'}${!done && t.status !== (L.taskStatus[0] || {}).k ? ' · ' + esc(t.status) : ''}</div></div>
      ${!done && AOS.kindOf(L, 'priorities', t.priority) === 'high' ? pill(t.priority, AOS.colorOf(L, 'priorities', t.priority)) : ''}
      <span class="due ${done ? '' : dueCls(t.due)}">${esc(dueTxt(t.due))}</span></div>`;
  };
  AOS.evRow = function (e, showDate) {
    const L = AOS.lists(), cr = nm('creators', e.creatorId);
    return `<div class="ev" data-edit="events:${e.id}"><span class="time">${esc(showDate ? dShort(e.date) : (e.time || '—'))}</span>${dot(AOS.colorOf(L, 'eventTypes', e.type))}
     <div class="grow"><div class="title">${esc(e.title)}${demoTag(e)}</div><div class="sub">${[e.type, showDate && e.time, cr, e.place].filter(Boolean).map(esc).join(' · ')}</div></div></div>`;
  };
  const nm = AOS.nm = (c, id) => { const r = (S[c] || []).find(x => x.id === id); return r ? (r.name || r.title) : ''; };
  const demoTag = AOS.demoTag = r => r && r.demo ? ' <span class="tag">exemple</span>' : '';
  const repTag = AOS.repTag = t => t && t.repeat && t.repeat !== 'Jamais' ? ` <span class="rep" title="${esc(t.repeat)}">${ic('repeat', 12)}${esc(t.repeat.replace('Chaque ', '').replace('Toutes les ', ''))}</span>` : '';
  const dueCls = AOS.dueCls = d => !d ? '' : d < today() ? 'late' : d === today() ? 'today' : '';
  const dueTxt = AOS.dueTxt = d => !d ? '' : d === today() ? "aujourd'hui" : d === addDays(today(), 1) ? 'demain' : d < today() ? `${-diffDays(d, today())} j de retard` : dShort(d);
  AOS.openTasks = () => { const L = AOS.lists(); return S.tasks.filter(x => AOS.kindOf(L, 'taskStatus', x.status) !== 'done'); };

  AOS.act.toggletask = async el => {
    const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    if (el.classList.contains('tick')) { el.classList.add('on'); el.closest('.line')?.classList.add('leaving'); await new Promise(r => setTimeout(r, 280)); }
    const L = AOS.lists(), done = AOS.kindOf(L, 'taskStatus', t.status) === 'done';
    const target = done ? (L.taskStatus.find(s => s.kind === 'open') || {}).k : (L.taskStatus.find(s => s.kind === 'done') || {}).k;
    if (!target) { AOS.toast('Aucun statut « terminée » défini dans Personnalisation.', 'bad'); return; }
    await AOS.save('tasks', { ...t, status: target, ...(done ? {} : { doneAt: Date.now() }) });
  };

  /* ---------- Dashboard: one hero number, goals top-right, planning + tasks, one row of figures ---------- */
  AOS.views.dashboard = function () {
    const L = AOS.lists(), t = today(), h = new Date().getHours(), hi = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
    const R = me.role, canFin = AOS.flag(R, 'finance_view') && AOS.can(R, 'finances', 'r');
    const isDone = x => AOS.kindOf(L, 'taskStatus', x.status) === 'done';
    const ot = AOS.openTasks(), late = ot.filter(x => x.due && x.due < t), dToday = ot.filter(x => x.due === t);
    const doneToday = S.tasks.filter(x => isDone(x) && x.doneAt && AOS.iso(x.doneAt) === t).length;
    const due = late.length + dToday.length, total = due + doneToday, pct = total ? Math.round(doneToday / total * 100) : 0;
    const callsOn = AOS.modOn('calls') ? S.calls.filter(c => AOS.kindOf(L, 'callStatus', c.status) === 'planned').map(c => ({ ...c, _call: 1 })) : [];
    const agenda = [...S.events, ...callsOn];
    const evToday = sortBy(agenda.filter(e => e.date === t), e => e.time || '99');
    const later = sortBy(agenda.filter(e => e.date > t && e.date <= addDays(t, 7)), e => e.date + (e.time || '')).slice(0, 3);
    const team = S.team.filter(m => !m.archived), kindA = m => { const p = AOS.presence(S, L, m, t); return p.leave ? 'away' : AOS.kindOf(L, 'availability', m.avail); };
    const stageK = c => AOS.kindOf(L, 'stages', c.stage), active = S.creators.filter(c => stageK(c) === 'active');
    const owner = S.settings.owner ? ` ${esc(S.settings.owner)}` : '';
    if (!status.loaded) return AOS.header({ eyebrow: '', title: 'Ouverture de ton espace…' });

    /* things that need a decision: only shown when there are some */
    const attn = [];
    if (AOS.flag(R, 'contract_view')) S.creators.filter(c => c.contractEnd && stageK(c) !== 'inactive' && diffDays(c.contractEnd, t) >= 0 && diffDays(c.contractEnd, t) <= 30)
      .forEach(c => attn.push({ c: 'var(--warn)', t: `Contrat de ${c.name} : fin dans ${diffDays(c.contractEnd, t)} jours`, open: 'creators:' + c.id }));
    if (AOS.modOn('creatrices')) active.filter(c => !c.managerId).forEach(c => attn.push({ c: 'var(--warn)', t: `${c.name} n'a pas d'account manager`, open: 'creators:' + c.id }));
    team.filter(m => kindA(m) === 'away' && ot.some(x => x.assigneeId === m.id && x.due && x.due <= addDays(t, 2)))
      .forEach(m => attn.push({ c: 'var(--violet)', t: `${m.name} est ${String(m.avail).toLowerCase()} avec des tâches dues sous 48 h`, open: 'team:' + m.id }));

    if (canFin && AOS.modOn('accompagnement') && AOS.studentPayLate) S.students.filter(AOS.studentPayLate)
      .forEach(s => attn.push({ c: 'var(--bad)', t: `Paiement de ${s.name} attendu depuis le ${dShort(s.payNext)} (reste ${eur(AOS.studentRest(s))})`, open: 'students:' + s.id }));

    /* calls that happened and have no notes yet: the next brief would be empty */
    if (AOS.modOn('calls') && AOS.allowed('calls', 'u')) AOS.callsToWrite().slice(0, 3)
      .forEach(c => attn.push({ c: 'var(--violet)', t: `Notes à écrire : call du ${dShort(c.date)} avec ${c.title}`, a: 'callwrite', id: c.id }));
    const portalBox = AOS.portalBox ? AOS.portalBox() : '';

    /* hero */
    const hero = `<section class="hero card">
      <div class="hero-main">
        <div class="hero-n">${due}</div>
        <div class="hero-l">${due ? `tâche${due > 1 ? 's' : ''} à faire aujourd'hui` : (doneToday ? 'tout est fait pour aujourd\'hui' : 'rien d\'urgent aujourd\'hui')}</div>
        <div class="hero-dots"><span>${dot('var(--bad)')}<b>${late.length}</b> en retard</span><span>${dot('var(--warn)')}<b>${dToday.length}</b> pour aujourd'hui</span><span>${dot('var(--violet)')}<b>${evToday.length}</b> événement${evToday.length > 1 ? 's' : ''}</span></div>
        <div class="hero-prog"><div class="hp-bar"><span style="width:${pct}%"></span></div><div class="hp-txt"><span>${doneToday} fait${doneToday > 1 ? 's' : ''} aujourd'hui</span><span>${pct} %</span></div></div>
      </div>
      ${AOS.modOn('taches') ? `<button class="btn glow" data-nav="taches">Voir mes tâches ${ic('chev', 15)}</button>` : ''}
    </section>`;

    /* goals, always visible top-right */
    const goalsBox = (() => {
      if (!AOS.modOn('objectifs')) return '';
      const gs = sortBy(S.goals.filter(g => g.pinned !== false && g.start <= t && g.end >= t), g => ['risk', 'ontrack', 'reached', 'failed'].indexOf(AOS.goalInfo(g).status)).slice(0, 3);
      const row = g => {
        const x = AOS.goalInfo(g), M = AOS.GOAL_METRICS[g.metric] || AOS.GOAL_METRICS.manual, vis = !M.fin || AOS.flag(R, 'finance_view');
        const c = { reached: 'var(--ok)', ontrack: 'var(--accent)', risk: 'var(--warn)', failed: 'var(--bad)' }[x.status] || 'var(--faint)';
        const f = v => (g.metric === 'manual' ? (g.unit || '') : M.unit) === '€' ? eurK(v) : Math.round(v * 10) / 10;
        return `<button class="mg" data-edit="goals:${g.id}"><span class="mg-t">${esc(g.title)}</span>
          ${vis ? `<span class="mg-v"><b>${f(x.value)}</b> / ${f(+g.target)}<i style="color:${c}">${Math.round(x.pct * 100)} %</i></span><span class="mg-bar"><span style="width:${Math.min(100, x.pct * 100)}%;background:${c}"></span></span>` : `<span class="muted small">${ic('lock', 12)} réservé</span>`}</button>`;
      };
      return `<section class="card goalbox"><div class="box-h"><h3>${ic('target', 16)} Objectifs</h3><button class="linkbtn" data-nav="objectifs">Tous</button></div>
        ${gs.length ? gs.map(row).join('') : `<div class="box-empty"><p>Fixe ton premier objectif du mois : il s'affichera ici à chaque visite.</p>${AOS.newBtn('goals', 'Objectif')}</div>`}</section>`;
    })();

    /* planning */
    const evLine = (e, withDate) => { if (e._call) return AOS.callLine(e, withDate, AOS.callLastTxt(e)); const cr = AOS.nm('creators', e.creatorId); return `<button class="line" data-edit="events:${e.id}"><span class="when"><b>${esc(e.time ? e.time.replace(':', 'h') : 'Journée')}</b>${withDate ? `<small>${dShort(e.date)}</small>` : ''}</span>
      <span class="what"><span class="ttl">${esc(e.title)}</span><span class="sub">${[e.type, cr, e.place].filter(Boolean).map(esc).join(' · ')}</span></span>${dot(AOS.colorOf(L, 'eventTypes', e.type))}</button>`; };
    const planning = AOS.modOn('planning') ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--accent)')}Planning du jour</span><button class="linkbtn" data-nav="planning">Agenda</button></div>
      ${evToday.length ? evToday.map(e => evLine(e)).join('') : '<div class="box-empty"><p>Rien de prévu aujourd\'hui.</p></div>'}
      ${later.length ? `<div class="box-sub">Ensuite</div>${later.map(e => evLine(e, 1)).join('')}` : ''}
      ${AOS.allowed('events', 'c') ? `<button class="line add" data-new="events">${ic('plus', 16)}Ajouter un événement</button>` : ''}</section>` : '';

    /* tasks */
    const highK = p => AOS.kindOf(L, 'priorities', p) === 'high';
    const mine = [...new Set([...late, ...dToday, ...ot.filter(x => highK(x.priority))])].slice(0, 6);
    const tLine = x => { const canU = AOS.allowed('tasks', 'u'), who = AOS.nm('team', x.assigneeId);
      return `<div class="line" data-edit="tasks:${x.id}">${canU ? `<button class="tick" data-a="toggletask" data-id="${x.id}" aria-label="Marquer comme faite"></button>` : '<span class="tick"></span>'}
        <span class="what"><span class="ttl">${esc(x.title)}${repTag(x)}</span><span class="sub">${[who, AOS.nm('creators', x.creatorId)].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</span></span>
        <span class="due ${dueCls(x.due)}">${esc(dueTxt(x.due) || (highK(x.priority) ? 'prioritaire' : ''))}</span></div>`; };
    const tasks = AOS.modOn('taches') ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--warn)')}Mes tâches</span><button class="linkbtn" data-nav="taches">Toutes</button></div>
      ${mine.length ? mine.map(tLine).join('') : '<div class="box-empty"><p>Aucune tâche urgente. Profite !</p></div>'}
      ${AOS.allowed('tasks', 'c') ? `<form class="line add" id="quickTask">${ic('plus', 16)}<input id="qt" name="t" placeholder="Ajouter une tâche pour aujourd'hui…" autocomplete="off" aria-label="Nouvelle tâche"></form>` : ''}</section>` : '';

    /* one row of figures */
    const mk = t.slice(0, 7), rev = AOS.fin.rev(S, mk), prev = AOS.fin.rev(S, shiftMonth(mk, -1)), delta = prev ? Math.round((rev - prev) / prev * 100) : null;
    /* revenue of the last 6 months: the headline follows the pointer along the line */
    const serie = canFin ? AOS.monthlySeries(S, [-5, -4, -3, -2, -1, 0].map(n => shiftMonth(mk, n))) : [];
    const finOn = serie.some(x => x.rev > 0);
    finPts = finOn ? serie.map(x => ({ k: x.k, v: x.rev })) : null;
    const finCard = (() => {
      if (!finOn) return '';
      const max = Math.max(...serie.map(x => x.rev)) || 1, n = serie.length;
      const X = i => i / (n - 1) * 100, Y = v => 100 - v / max * 88;   // zero baseline, a little air on top
      const pts = serie.map((x, i) => `${X(i).toFixed(2)},${Y(x.rev).toFixed(2)}`);
      const mName = k => new Date(k + '-15T12:00').toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      return `<section class="card fin" aria-label="Chiffre d'affaires des 6 derniers mois">
        <div class="fin-top"><span class="fin-l" id="finL">CA du mois</span><b class="fin-n" id="finN">${eur(rev)}</b>
          <span class="fin-d ${delta === null ? '' : delta >= 0 ? 'up' : 'down'}" id="finD">${delta === null ? 'Pas de mois précédent pour comparer' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} % · vs ${monthLabel(shiftMonth(mk, -1)).split(' ')[0]}`}</span></div>
        <div class="fin-plot" id="finPlot" tabindex="0" role="img" aria-label="${serie.map(x => `${monthLabel(x.k)} : ${eur(x.rev)}`).join(', ')}">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="fin-area" d="M0,100 L${pts.join(' L')} L100,100 Z"/><line class="fin-base" x1="0" y1="100" x2="100" y2="100"/><path class="fin-line" d="M${pts.join(' L')}"/></svg>
          <i class="fin-cross" id="finCross" hidden></i><i class="fin-dot" id="finDot" style="left:${X(n - 1)}%;top:${Y(serie[n - 1].rev)}%"></i></div>
        <div class="fin-x">${serie.map((x, i) => `<span data-i="${i}" class="${i === n - 1 ? 'on' : ''}">${esc(mName(x.k))}</span>`).join('')}</div></section>`;
    })();
    const stat = (v, l, sub = '', nav = '') => `<div class="st ${nav ? 'click' : ''}" ${nav ? `data-nav="${nav}"` : ''}><b>${v}</b><span>${l}</span>${sub ? `<small class="sub2">${sub}</small>` : ''}</div>`;
    const coachOn = AOS.modOn('accompagnement'), actSt = S.students.filter(x => AOS.kindOf(L, 'studentStages', x.stage) === 'active');
    const heads = actSt.reduce((n, x) => n + Math.max(1, Math.round(+x.people || 1)), 0), dueSt = S.students.reduce((n, x) => n + AOS.studentRest(x), 0);
    const stats = `<section class="card stats">
      ${canFin && finOn ? stat(eurK(AOS.fin.com(S, mk)), 'commission agence', `résultat net ${eurK(AOS.fin.com(S, mk) - AOS.fin.exp(S, mk))}`, 'finances') : canFin ? stat(eurK(rev), 'CA du mois', `commission ${eurK(AOS.fin.com(S, mk))}`, 'finances') : stat(ot.length, 'tâches ouvertes', '', 'taches')}
      ${stat(active.length, `créatrice${active.length > 1 ? 's' : ''} active${active.length > 1 ? 's' : ''}`, team.length ? `équipe : ${team.filter(m => kindA(m) === 'available').length}/${team.length} disponible${team.filter(m => kindA(m) === 'available').length > 1 ? 's' : ''}` : '', 'creatrices')}
      ${coachOn ? stat(actSt.length, `accompagnement${actSt.length > 1 ? 's' : ''} en cours`, `${heads} personne${heads > 1 ? 's' : ''}`, 'accompagnement') : stat(later.length + evToday.length, 'événements sur 7 jours', '', 'planning')}
      ${coachOn && canFin ? stat(`<i class="${dueSt ? 'warn-t' : ''}">${eurK(dueSt)}</i>`, 'reste à encaisser', 'accompagnements', 'accompagnement') : stat(ot.length, 'tâches ouvertes', '', 'taches')}</section>`;

    const attnBox = attn.length ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--warn)')}À surveiller</span></div>
      ${attn.slice(0, 5).map(a => `<button class="line" ${a.a ? `data-a="${a.a}" data-id="${a.id}"` : `data-open="${a.open}"`}>${dot(a.c)}<span class="what"><span class="ttl">${esc(a.t)}</span></span>${ic('chev', 15)}</button>`).join('')}</section>` : '';

    const empty = !['creators', 'team', 'tasks', 'events'].some(c => S[c].length);
    const showClock = (S.prefs || {}).clock !== false && AOS.clockHtml;
    const mood = late.length ? { c: 'var(--warn)', t: `${late.length} tâche${late.length > 1 ? 's' : ''} en retard` }
      : dToday.length ? { c: 'var(--accent)', t: `${dToday.length} tâche${dToday.length > 1 ? 's' : ''} pour aujourd'hui` }
      : { c: 'var(--ok)', t: "Tout est à jour aujourd'hui." };
    return (showClock ? AOS.header({ bare: true }) + AOS.clockHtml({ title: `${hi}${owner}.`, mood, date: AOS.cap(dLong(t)) })
      : AOS.header({ eyebrow: AOS.cap(dLong(t)), title: `${hi}${owner}.` })) +
      (empty ? `<section class="card box"><div class="box-empty"><p><b>Bienvenue !</b> Ajoute ton équipe et tes créatrices pour commencer.</p><div class="actions center">${AOS.newBtn('team', 'Ajouter un collaborateur')}${AOS.newBtn('creators', 'Ajouter une créatrice', 1)}</div></div></section>` : '') +
      `<div class="dash-top">${hero}${goalsBox}</div>
      <div class="grid g2 top">${planning}${tasks}</div>
      ${attnBox}${finCard}${stats}${portalBox}`;
  };
  let finPts = null;
  function wireFin() {
    const plot = document.getElementById('finPlot'); if (!plot || !finPts) return;
    const n = finPts.length, max = Math.max(...finPts.map(p => p.v)) || 1, last = n - 1;
    const N = document.getElementById('finN'), Lb = document.getElementById('finL'), D = document.getElementById('finD'), dot = document.getElementById('finDot'), cross = document.getElementById('finCross');
    const rest = { l: Lb.textContent, d: D.textContent, c: D.className };
    let cur = last;
    const show = (i, live) => {
      cur = i; const p = finPts[i];
      dot.style.left = cross.style.left = (i / (n - 1) * 100) + '%'; dot.style.top = (100 - p.v / max * 88) + '%';
      cross.hidden = !live; N.textContent = eur(p.v);
      document.querySelectorAll('.fin-x span').forEach(el => el.classList.toggle('on', +el.dataset.i === i));
      if (live && i !== last) { Lb.textContent = 'CA · ' + monthLabel(p.k); const prev = i ? finPts[i - 1].v : 0, dl = prev ? Math.round((p.v - prev) / prev * 100) : null;
        D.textContent = dl === null ? ' ' : `${dl >= 0 ? '▲' : '▼'} ${Math.abs(dl)} % · vs mois précédent`; D.className = 'fin-d ' + (dl === null ? '' : dl >= 0 ? 'up' : 'down'); }
      else { Lb.textContent = rest.l; D.textContent = rest.d; D.className = rest.c; }
    };
    const at = e => { const r = plot.getBoundingClientRect(); return Math.max(0, Math.min(last, Math.round((e.clientX - r.left) / r.width * last))); };
    plot.onpointermove = e => show(at(e), true);
    plot.onpointerleave = plot.onblur = () => show(last, false);
    plot.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(Math.max(0, Math.min(last, cur + (e.key === 'ArrowLeft' ? -1 : 1))), true); } };
  }
  AOS.afterRender.dashboard = () => {
    wireFin();
    if (AOS.startClock && document.getElementById('flipH')) AOS.startClock();
    const f = document.getElementById('quickTask'); if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault(); const v = f.t.value.trim(); if (!v) return;
      const L = AOS.lists(), first = (L.taskStatus.find(x => x.kind === 'open') || {}).k, normal = (L.priorities.find(p => p.kind === 'normal') || {}).k;
      f.t.value = '';
      if (await AOS.save('tasks', { title: v, status: first, priority: normal, due: today(), assigneeId: (me.role && me.role.memberId) || '' })) AOS.toast('Tâche ajoutée');
    };
  };
})();
