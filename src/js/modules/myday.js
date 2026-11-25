/* Agency OS — Ma journée (private to each person) and Notifications (computed, read state stored per person). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, dot, pill, today, dLong, sortBy, toast } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;

  /* ================= Ma journée ================= */
  const dayKey = () => 'day-' + today();
  const day = () => { const d = AOS.udoc(dayKey()) || {}; return { top: d.top || [{}, {}, {}], blocks: d.blocks || [], notes: d.notes || '', review: d.review || {}, focus: d.focus || { sessions: 0, minutes: 0 } }; };
  const saveDay = patch => AOS.setUdoc(dayKey(), { ...day(), ...patch });
  const toMin = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const toHM = n => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const myTasks = () => { const mid = me.role && me.role.memberId, t = today(); return AOS.openTasks().filter(x => (!mid || x.assigneeId === mid) && ((x.due && x.due <= t) || AOS.kindOf(AOS.lists(), 'priorities', x.priority) === 'high')); };
  const TEMPLATE = { name: 'Journée type (exemple modifiable)', blocks: [['09:00', 30, 'Vérification de l\'agence'], ['09:30', 30, 'Analyse des performances'], ['10:00', 60, 'Réunion avec l\'équipe'], ['11:00', 120, 'Gestion des créatrices'], ['14:00', 120, 'Gestion du contenu'], ['16:00', 60, 'Finances'], ['17:00', 30, 'Bilan quotidien']].map(([start, dur, title]) => ({ start, dur, title })) };

  /* rule-based planner: fills free slots of the working day with my tasks, by urgency */
  function proposePlan() {
    const t = today(), L = AOS.lists(), d = day();
    const busy = [...S.events.filter(e => e.date === t && e.time).map(e => [toMin(e.time), toMin(e.time) + 60, e.title]),
      ...S.calls.filter(c => c.date === t && c.time && AOS.kindOf(L, 'callStatus', c.status) === 'planned').map(c => [toMin(c.time), toMin(c.time) + 45, 'Call ' + c.title]),
      ...d.blocks.map(b => [toMin(b.start), toMin(b.start) + (+b.dur || 30), b.title])].sort((a, b) => a[0] - b[0]);
    const prio = x => (x.due && x.due < t ? 0 : x.due === t ? 1 : 2) * 10 + Math.max(0, L.priorities.findIndex(p => p.k === x.priority));
    const tasks = sortBy(myTasks().filter(x => !d.blocks.some(b => b.taskId === x.id)), x => String(prio(x)).padStart(3, '0'));
    const now = new Date(), startMin = Math.max(9 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15), endMin = 19 * 60, out = [];
    let cur = startMin;
    for (const x of tasks) {
      const dur = AOS.kindOf(L, 'priorities', x.priority) === 'high' ? 60 : 30;
      let placed = false;
      while (cur + dur <= endMin) {
        if (cur >= 12 * 60 + 30 && cur < 13 * 60 + 30) { cur = 13 * 60 + 30; continue; }   // lunch break
        const clash = busy.find(([a, b]) => cur < b && cur + dur > a);
        if (clash) { cur = clash[1]; continue; }
        out.push({ start: toHM(cur), dur, title: x.title, taskId: x.id }); busy.push([cur, cur + dur]); busy.sort((a, b) => a[0] - b[0]); cur += dur; placed = true; break;
      }
      if (!placed) break;
    }
    return out;
  }
  let proposal = null, timer = { left: 25 * 60, total: 25 * 60, run: false, h: 0 };

  AOS.views['ma-journee'] = function () {
    if (!AOS.status.loaded) return AOS.header({ title: 'Ma journée' });
    const d = day(), t = today(), L = AOS.lists();
    const blocks = sortBy(d.blocks, b => b.start);
    const ev = sortBy([...S.events.filter(e => e.date === t).map(e => ({ time: e.time, title: e.title, kind: e.type, edit: 'events:' + e.id })),
      ...S.calls.filter(c => c.date === t && AOS.kindOf(L, 'callStatus', c.status) === 'planned').map(c => ({ time: c.time, title: 'Call · ' + c.title, kind: 'Call', edit: 'calls:' + c.id }))], e => e.time || '99');
    const doneTop = d.top.filter(x => x.done).length, tasks = myTasks();
    const routines = ((AOS.udoc('routines') || {}).items) || [];
    const mm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    return AOS.header({ eyebrow: AOS.cap(dLong(t)), title: 'Ma journée' }) +
    `<section class="hero card slim"><div class="hero-main"><div class="hero-row">
        <div><div class="hero-n sm">${doneTop}<small>/3</small></div><div class="hero-l">priorités faites</div></div>
        <div><div class="hero-n sm">${blocks.filter(b => b.done).length}<small>/${blocks.length}</small></div><div class="hero-l">blocs terminés</div></div>
        <div><div class="hero-n sm">${Math.round(d.focus.minutes / 6) / 10}<small> h</small></div><div class="hero-l">de focus</div></div></div></div>
      <div class="focus"><div class="f-time" id="fTime">${mm(timer.left)}</div>
        <div class="f-ctl"><button class="btn glow sm" data-a="ftoggle">${timer.run ? ic('pause', 14) + 'Pause' : ic('play', 14) + 'Focus'}</button>
        <div class="seg"><button class="${timer.total === 1500 ? 'on' : ''}" data-a="fset" data-v="25">25</button><button class="${timer.total === 3000 ? 'on' : ''}" data-a="fset" data-v="50">50</button><button class="${timer.total === 5400 ? 'on' : ''}" data-a="fset" data-v="90">90</button></div></div>
        <div class="faint small">${d.focus.sessions} session${d.focus.sessions > 1 ? 's' : ''} aujourd'hui</div></div></section>
    <div class="grid g2 top">
      <div class="stack">
        <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--accent)')}Top 3 du jour</span></div>
          ${d.top.map((x, i) => `<div class="line top3"><button class="tick ${x.done ? 'on' : ''}" data-a="toptick" data-i="${i}" aria-label="Fait"></button>
            <input class="bare ${x.done ? 'done-t' : ''}" id="top${i}" value="${esc(x.text || '')}" placeholder="Priorité n°${i + 1}…" list="myTasksDl" autocomplete="off"></div>`).join('')}
          <datalist id="myTasksDl">${tasks.map(x => `<option value="${esc(x.title)}">`).join('')}</datalist></section>
        <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--warn)')}Mes tâches du jour</span><button class="linkbtn" data-nav="taches">Toutes</button></div>
          ${tasks.length ? tasks.slice(0, 8).map(x => `<div class="line" data-edit="tasks:${x.id}"><button class="tick" data-a="toggletask" data-id="${x.id}" aria-label="Fait"></button><span class="what"><span class="ttl">${esc(x.title)}${AOS.repTag(x)}</span><span class="sub">${esc(AOS.dueTxt(x.due) || x.priority || '')}</span></span></div>`).join('') : '<div class="box-empty"><p>Aucune tâche urgente pour toi.</p></div>'}</section>
        <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--violet)')}Notes rapides</span><span class="faint small" id="noteSaved"></span></div>
          <textarea class="bare-area" id="dayNotes" placeholder="Idées, choses à ne pas oublier… (enregistré automatiquement, visible par toi seul)">${esc(d.notes)}</textarea></section>
      </div>
      <div class="stack">
        <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--ok)')}Mon planning</span><div class="actions"><button class="btn sm" data-a="dayplan">${ic('sparkles', 13)}Organiser ma journée</button></div></div>
          ${proposal ? `<div class="proposal"><div class="strong">Proposition (${proposal.length} bloc${proposal.length > 1 ? 's' : ''})</div>${proposal.length ? proposal.map(b => `<div class="pp"><span class="mono">${b.start}</span>${esc(b.title)}<span class="faint">${b.dur} min</span></div>`).join('') : '<p class="muted">Rien à placer : pas de tâche urgente ou plus de créneau libre avant 19 h.</p>'}
            <div class="actions">${proposal.length ? '<button class="btn sm pri" data-a="planok">Ajouter à mon planning</button>' : ''}<button class="btn sm ghost" data-a="planno">Annuler</button></div><p class="faint small">Basé sur l'urgence de tes tâches, tes événements et calls du jour, de 9 h à 19 h avec une pause déjeuner.</p></div>` : ''}
          <div id="blocks">${sortBy([...ev.map(e => ({ t: e.time || '00:00', e })), ...blocks.map(b => ({ t: b.start, b }))], x => x.t + (x.e ? '0' : '1')).map(({ e, b }) => e ? `<div class="line fixed" data-edit="${e.edit}"><span class="grip"></span><span class="when"><b>${esc(e.time ? e.time.replace(':', 'h') : '—')}</b></span><span class="what"><span class="ttl">${esc(e.title)}</span><span class="sub">${esc(e.kind || '')} · agenda</span></span></div>` : `<div class="line block ${b.done ? 'isdone' : ''}" draggable="true" data-bi="${d.blocks.indexOf(b)}"><span class="grip" title="Glisser pour déplacer">${ic('grip', 14)}</span>
            <span class="when"><b>${esc(b.start.replace(':', 'h'))}</b><small>${b.dur} min</small></span><span class="what"><span class="ttl">${esc(b.title)}</span></span>
            <button class="tick ${b.done ? 'on' : ''}" data-a="blocktick" data-i="${d.blocks.indexOf(b)}" aria-label="Fait"></button><button class="iconbtn" data-a="blockdel" data-i="${d.blocks.indexOf(b)}" aria-label="Supprimer">${ic('x', 14)}</button></div>`).join('')}</div>
          ${!blocks.length && !ev.length && !proposal ? '<div class="box-empty"><p>Ajoute des blocs de travail, applique une routine ou laisse l\'app organiser ta journée.</p></div>' : ''}
          <form class="line add blockadd" id="blockForm"><input type="time" name="s" value="${blocks.length ? toHM(toMin(blocks[blocks.length - 1].start) + (+blocks[blocks.length - 1].dur || 30)) : '09:00'}" aria-label="Début">
            <select name="d" aria-label="Durée"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option></select>
            <input name="t" placeholder="Nouveau bloc…" autocomplete="off" aria-label="Titre du bloc"><button class="btn sm">${ic('plus', 13)}</button></form>
          <div class="routines"><span class="faint small">Routines</span>
            <button class="chip" data-a="routineapply" data-i="-1">${esc(TEMPLATE.name)}</button>${routines.map((r, i) => `<span class="chip">${esc(r.name)}<button class="linkbtn" data-a="routineapply" data-i="${i}">Appliquer</button><button class="linkbtn" data-a="routinedel" data-i="${i}" aria-label="Supprimer">×</button></span>`).join('')}
            ${blocks.length ? '<button class="chip" data-a="routinesave">+ Enregistrer ce planning</button>' : ''}</div>
          <p class="faint small pad-x">Glisse un bloc pour le déplacer : les horaires se recalculent à la suite.</p></section>
        <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--pink)')}Bilan de fin de journée</span>${d.review.savedAt ? '<span class="faint small">enregistré</span>' : ''}</div>
          <form id="reviewForm" class="review"><div class="moods">${['😣', '😕', '😐', '🙂', '😄'].map((e, i) => `<button type="button" class="mood ${d.review.mood === i + 1 ? 'on' : ''}" data-a="mood" data-v="${i + 1}" aria-label="Humeur ${i + 1} sur 5">${e}</button>`).join('')}</div>
            <label class="fld"><span>Ce qui a bien marché</span><textarea name="wins" rows="2">${esc(d.review.wins || '')}</textarea></label>
            <label class="fld"><span>Ce qui a bloqué</span><textarea name="blockers" rows="2">${esc(d.review.blockers || '')}</textarea></label>
            <label class="fld"><span>Priorité de demain</span><input name="tomorrow" value="${esc(d.review.tomorrow || '')}"></label>
            <div><button class="btn pri sm">Enregistrer le bilan</button></div></form></section>
      </div></div>`;
  };
  let noteT = 0, topT = 0;
  AOS.afterRender['ma-journee'] = () => {
    const n = document.getElementById('dayNotes');
    if (n) n.oninput = () => { clearTimeout(noteT); const s = document.getElementById('noteSaved'); if (s) s.textContent = '…'; noteT = setTimeout(async () => { await saveDay({ notes: n.value }); const s2 = document.getElementById('noteSaved'); if (s2) s2.textContent = 'enregistré'; }, 700); };
    [0, 1, 2].forEach(i => { const el = document.getElementById('top' + i); if (el) el.onchange = () => { clearTimeout(topT); const top = day().top.map(x => ({ ...x })); top[i] = { ...top[i], text: el.value.trim() }; saveDay({ top }); }; });
    const bf = document.getElementById('blockForm');
    if (bf) bf.onsubmit = e => { e.preventDefault(); const title = bf.t.value.trim(); if (!title) return; bf.t.value = ''; saveDay({ blocks: [...day().blocks, { start: bf.s.value || '09:00', dur: +bf.d.value, title }] }); };
    const rf = document.getElementById('reviewForm');
    if (rf) rf.onsubmit = async e => { e.preventDefault(); if (await saveDay({ review: { ...day().review, wins: rf.wins.value, blockers: rf.blockers.value, tomorrow: rf.tomorrow.value, savedAt: Date.now() } })) toast('Bilan enregistré'); };
    /* drag to reorder blocks; times are recomputed from the first block's start */
    const box = document.getElementById('blocks'); if (!box) return; let from = null;
    box.querySelectorAll('.block').forEach(el => {
      el.ondragstart = () => { from = +el.dataset.bi; el.classList.add('drag'); };
      el.ondragend = () => el.classList.remove('drag');
      el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
      el.ondragleave = () => el.classList.remove('over');
      el.ondrop = e => {
        e.preventDefault(); el.classList.remove('over'); const to = +el.dataset.bi; if (from === null || from === to) return;
        const sorted = sortBy(day().blocks, b => b.start), a = sorted.indexOf(day().blocks[from]), b = sorted.indexOf(day().blocks[to]);
        const [mv] = sorted.splice(a, 1); sorted.splice(b, 0, mv);
        let cur = toMin(sortBy(day().blocks, x => x.start)[0].start);
        saveDay({ blocks: sorted.map(x => { const r = { ...x, start: toHM(cur) }; cur += +x.dur || 30; return r; }) }); from = null;
      };
    });
  };
  function tick() {
    timer.left--; const el = document.getElementById('fTime'); if (el) el.textContent = `${String(Math.floor(timer.left / 60)).padStart(2, '0')}:${String(timer.left % 60).padStart(2, '0')}`;
    if (timer.left <= 0) { clearInterval(timer.h); timer.run = false; const f = day().focus; saveDay({ focus: { sessions: f.sessions + 1, minutes: f.minutes + timer.total / 60 } }); timer.left = timer.total; toast('Session de focus terminée. Bravo !'); AOS.render(); }
  }
  Object.assign(AOS.act, {
    ftoggle: () => { timer.run = !timer.run; if (timer.run) timer.h = setInterval(tick, 1000); else clearInterval(timer.h); AOS.render(); },
    fset: el => { clearInterval(timer.h); timer.run = false; timer.total = timer.left = +el.dataset.v * 60; AOS.render(); },
    toptick: el => { const top = day().top.map(x => ({ ...x })), i = +el.dataset.i; top[i].done = !top[i].done; saveDay({ top }); },
    blocktick: el => { const b = day().blocks.map(x => ({ ...x })), i = +el.dataset.i; b[i].done = !b[i].done; saveDay({ blocks: b }); },
    blockdel: el => { const b = day().blocks.filter((_, i) => i !== +el.dataset.i); saveDay({ blocks: b }); },
    dayplan: () => { proposal = proposePlan(); AOS.render(); },
    planno: () => { proposal = null; AOS.render(); },
    planok: async () => { const p = proposal; proposal = null; if (await saveDay({ blocks: [...day().blocks, ...p] })) toast(`${p.length} bloc(s) ajoutés`); },
    mood: el => saveDay({ review: { ...day().review, mood: +el.dataset.v } }),
    routinesave: async () => {
      const name = await AOS.ask({ title: 'Enregistrer comme routine', label: 'Nom de la routine', ok: 'Enregistrer' }); if (!name) return;
      const items = [...(((AOS.udoc('routines') || {}).items) || []), { name, blocks: sortBy(day().blocks, b => b.start).map(({ start, dur, title }) => ({ start, dur, title })) }];
      if (await AOS.setUdoc('routines', { items })) toast('Routine enregistrée');
    },
    routineapply: async el => {
      const i = +el.dataset.i, r = i < 0 ? TEMPLATE : ((AOS.udoc('routines') || {}).items || [])[i]; if (!r) return;
      if (day().blocks.length && !(await AOS.confirm({ title: `Appliquer « ${esc(r.name)} » ?`, body: 'Les blocs de la routine remplacent ceux de ton planning du jour.', ok: 'Appliquer' }))) return;
      saveDay({ blocks: r.blocks.map(b => ({ ...b, done: false })) });
    },
    routinedel: async el => { const items = (((AOS.udoc('routines') || {}).items) || []).filter((_, i) => i !== +el.dataset.i); await AOS.setUdoc('routines', { items }); }
  });

  /* ================= Notifications ================= */
  const CATS = { tasks: 'Tâches en retard ou du jour', meetings: 'Réunions et calls imminents', assigned: 'Nouvelles tâches pour moi', calls: 'Suites de call', contracts: 'Fins de contrat', goals: 'Objectifs', leaves: 'Absences' };
  AOS.notifList = function () {
    const st = AOS.udoc('notifs') || {}, off = st.off || {};
    const list = AOS.notifications(S, AOS.lists(), { today: today(), now: Date.now(), memberId: me.role && me.role.memberId, uid: me.uid,
      finance: AOS.flag(me.role, 'finance_view'), contracts: AOS.flag(me.role, 'contract_view'), approver: AOS.allowed('leaves', 'u') }).filter(n => !off[n.cat] && AOS.modOn(n.cat === 'goals' ? 'objectifs' : n.cat === 'leaves' ? 'presences' : n.cat === 'contracts' ? 'creatrices' : n.cat === 'calls' ? 'calls' : n.cat === 'meetings' ? 'planning' : 'taches'));
    return list.map(n => ({ ...n, read: !!(st.read || {})[n.id] }));
  };
  AOS.notifUnread = () => AOS.status.loaded ? AOS.notifList().filter(n => !n.read).length : 0;
  const SEV = { bad: 'var(--bad)', warn: 'var(--warn)', ok: 'var(--ok)', info: 'var(--accent)' };
  AOS.views.notifications = function () {
    const all = AOS.notifList(), st = AOS.udoc('notifs') || {}, only = ui.nfUnread;
    const list = only ? all.filter(n => !n.read) : all, unread = all.filter(n => !n.read).length;
    return AOS.header({ eyebrow: 'Accueil', title: `${unread} non lue${unread > 1 ? 's' : ''}`, actions: unread ? '<button class="btn" data-a="nfallread">Tout marquer comme lu</button>' : '' }) +
    `<div class="toolbar"><div class="seg"><button class="${!only ? 'on' : ''}" data-a="nfmode" data-v="">Toutes · ${all.length}</button><button class="${only ? 'on' : ''}" data-a="nfmode" data-v="1">Non lues · ${unread}</button></div></div>
    <section class="card box">${list.length ? list.map(n => `<button class="line nf ${n.read ? 'read' : ''}" data-a="nfopen" data-id="${esc(n.id)}">${dot(n.read ? 'var(--line-2)' : SEV[n.sev])}
      <span class="what"><span class="ttl">${esc(n.title)}</span><span class="sub">${esc(n.body)}</span></span><span class="faint small">${n.at ? AOS.dTime(n.at) : ''}</span></button>`).join('') : `<div class="box-empty"><p>${only ? 'Tout est lu.' : 'Aucune notification.'}</p></div>`}</section>
    <section class="card pad"><h3 class="h3">Recevoir</h3><div class="nfcats">${Object.entries(CATS).map(([k, l]) => `<label class="inline"><input type="checkbox" data-a="nfcat" data-k="${k}" ${(st.off || {})[k] ? '' : 'checked'}>${l}</label>`).join('')}</div>
      <p class="faint small">Réglages personnels. Les notifications sont calculées à partir des données de l'agence à chaque ouverture : rien n'est envoyé par email ou téléphone.</p></section>`;
  };
  const saveNf = patch => AOS.setUdoc('notifs', { ...(AOS.udoc('notifs') || {}), ...patch });
  Object.assign(AOS.act, {
    nfmode: el => { ui.nfUnread = !!el.dataset.v; AOS.render(); },
    nfallread: () => { const read = {}; AOS.notifList().forEach(n => { read[n.id] = 1; }); saveNf({ read }); },
    nfcat: el => { const off = { ...((AOS.udoc('notifs') || {}).off || {}) }; off[el.dataset.k] = !el.checked; saveNf({ off }); },
    nfopen: el => {
      const n = AOS.notifList().find(x => x.id === el.dataset.id); if (!n) return;
      const ids = new Set(AOS.notifList().map(x => x.id)), read = Object.fromEntries(Object.entries((AOS.udoc('notifs') || {}).read || {}).filter(([k]) => ids.has(k)));   // keep only live ids
      read[n.id] = 1; saveNf({ read });
      if (n.go.edit) { const [c, i] = n.go.edit.split(':'); AOS.openForm(c, i); } else if (n.go.open) { const [c, i] = n.go.open.split(':'); AOS.openRecord(c, i); } else if (n.go.nav) location.hash = n.go.nav;
    }
  });
})();
