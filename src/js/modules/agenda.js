/* Agency OS — Agenda: day / week / month views of events, calls, task deadlines and approved absences.
   Drag an event or a call to move it; click an empty slot to create one. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, dot, today, addDays, iso, sortBy, toast } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const H0 = 7, H1 = 24, PX = 52;                       // visible hours and pixels per hour
  const toMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  const toHM = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const monday = d => { const z = new Date(d + 'T12:00'), wd = (z.getDay() + 6) % 7; return addDays(d, -wd); };

  /* everything that has a place in the agenda, normalised */
  function items(from, to) {
    const L = AOS.lists(), out = [], f = ui.agFilter || {};
    if (!f.events) for (const e of S.events) if (e.date >= from && e.date <= to) out.push({ kind: 'event', id: e.id, date: e.date, time: e.time, dur: +e.dur || 60, title: e.title, sub: e.place || e.type, c: AOS.colorOf(L, 'eventTypes', e.type), edit: 'events:' + e.id, move: 1, demo: e.demo });
    if (!f.calls && AOS.modOn('calls')) for (const c of S.calls) if (c.date >= from && c.date <= to && AOS.kindOf(L, 'callStatus', c.status) !== 'cancelled') out.push({ kind: 'call', id: c.id, date: c.date, time: c.time, dur: 45, title: 'Call · ' + c.title, sub: AOS.nm('team', c.ownerId), c: 'var(--pink)', edit: 'calls:' + c.id, move: 1, done: AOS.kindOf(L, 'callStatus', c.status) !== 'planned' });
    if (!f.tasks && AOS.modOn('taches')) for (const x of AOS.openTasks()) if (x.due && x.due >= from && x.due <= to) out.push({ kind: 'task', id: x.id, date: x.due, title: x.title, sub: AOS.nm('team', x.assigneeId), c: 'var(--warn)', edit: 'tasks:' + x.id });
    if (!f.leaves && AOS.modOn('presences')) for (const l of S.leaves) if (l.status === 'Validée' && l.end >= from && l.start <= to) for (let d = l.start < from ? from : l.start; d <= l.end && d <= to; d = addDays(d, 1)) out.push({ kind: 'leave', id: l.id, date: d, title: `${AOS.nm('team', l.memberId)} · ${l.type}`, c: AOS.colorOf(L, 'leaveTypes', l.type), edit: 'leaves:' + l.id });
    return out;
  }
  /* overlapping timed items get side-by-side lanes; overlap of events/calls = scheduling conflict */
  function lanes(list) {
    const sorted = sortBy(list, x => x.time), ends = [];
    for (const x of sorted) {
      const s = toMin(x.time), e = s + x.dur; let lane = ends.findIndex(v => v <= s); if (lane < 0) { lane = ends.length; ends.push(0); } ends[lane] = e; x.lane = lane;
      x.clash = sorted.some(y => y !== x && toMin(y.time) < e && toMin(y.time) + y.dur > s);
    }
    for (const x of sorted) x.lanes = Math.max(...sorted.filter(y => toMin(y.time) < toMin(x.time) + x.dur && toMin(y.time) + y.dur > toMin(x.time)).map(y => y.lane)) + 1;
    return sorted;
  }
  const chip = x => `<button class="ag-chip ${x.kind} ${x.done ? 'past' : ''}" style="--c:${x.c}" data-agedit="${x.edit}" ${x.move ? `draggable="true" data-drag="${x.kind}:${x.id}"` : ''} title="${esc(x.title)}">${x.time ? `<b>${x.time.replace(':', 'h')}</b> ` : ''}${esc(x.title)}</button>`;

  function timeGrid(days, all) {
    const t = today(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const hours = [...Array(H1 - H0)].map((_, i) => H0 + i);
    return `<div class="ag-scroll"><div class="ag-grid" style="--cols:${days.length}">
      <div class="ag-head"><span></span>${days.map(d => { const z = new Date(d + 'T12:00'); return `<button class="ag-dh ${d === t ? 'now' : ''}" data-a="agday" data-d="${d}"><small>${z.toLocaleDateString('fr-FR', { weekday: 'short' })}</small><b>${z.getDate()}</b></button>`; }).join('')}</div>
      <div class="ag-all"><span class="faint small">journée</span>${days.map(d => `<div class="ag-allcell" data-dropday="${d}">${all.filter(x => x.date === d && !x.time).map(chip).join('')}</div>`).join('')}</div>
      <div class="ag-body" style="height:${(H1 - H0) * PX}px"><div class="ag-hours">${hours.map(h => `<span style="top:${(h - H0) * PX}px">${h}h</span>`).join('')}</div>
        ${days.map(d => `<div class="ag-col ${d === t ? 'now' : ''}" data-col="${d}">${hours.map(h => `<i class="ag-slot" style="top:${(h - H0) * PX}px" data-slot="${d}T${String(h).padStart(2, '0')}:00"></i>`).join('')}
          ${lanes(all.filter(x => x.date === d && x.time)).map(x => { const top = Math.max(0, (toMin(x.time) - H0 * 60) / 60 * PX), h = Math.max(22, x.dur / 60 * PX - 3);
            return `<button class="ag-ev ${x.kind} ${x.clash && x.kind !== 'task' ? 'clash' : ''} ${x.done ? 'past' : ''}" style="--c:${x.c};top:${top}px;height:${h}px;left:calc(${x.lane / x.lanes * 100}% + 2px);width:calc(${100 / x.lanes}% - 4px)" data-agedit="${x.edit}" ${x.move ? `draggable="true" data-drag="${x.kind}:${x.id}"` : ''}>
              <b>${esc(x.time.replace(':', 'h'))}${x.clash && x.kind !== 'task' ? ' ⚠' : ''}</b><span>${esc(x.title)}</span>${h > 40 && x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`; }).join('')}
          ${d === t && nowMin >= H0 * 60 ? `<i class="ag-now" style="top:${(nowMin - H0 * 60) / 60 * PX}px"></i>` : ''}</div>`).join('')}
      </div></div></div>`;
  }
  function monthGrid(anchor) {
    const t = today(), first = anchor.slice(0, 8) + '01', start = monday(first), days = [...Array(42)].map((_, i) => addDays(start, i));
    const all = items(days[0], days[41]), m = anchor.slice(0, 7);
    return `<div class="ag-month"><div class="ag-mh">${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="ag-mg">${days.map(d => { const its = sortBy(all.filter(x => x.date === d), x => ({ event: 0, call: 1, leave: 2, task: 3 }[x.kind]) + (x.time || '00:00')); return `<div class="ag-mc ${d.slice(0, 7) !== m ? 'out' : ''} ${d === t ? 'now' : ''}" data-dropday="${d}">
        <div class="ag-mt"><button class="ag-dn" data-a="agday" data-d="${d}">${+d.slice(8)}</button>${AOS.allowed('events', 'c') ? `<button class="ag-add" data-new="events" data-preset-date="${d}" aria-label="Ajouter le ${d}">+</button>` : ''}</div>
        ${its.slice(0, 3).map(chip).join('')}${its.length > 3 ? `<button class="ag-more" data-a="agday" data-d="${d}">+${its.length - 3} autre${its.length - 3 > 1 ? 's' : ''}</button>` : ''}</div>`; }).join('')}</div></div>`;
  }

  AOS.views.planning = function () {
    const L = AOS.lists(), view = ui.agView || (window.innerWidth < 700 ? 'day' : 'week'), d = ui.agDate || today(), f = ui.agFilter || {};
    let title, body;
    if (view === 'day') { title = AOS.cap(AOS.dLong(d)); body = timeGrid([d], items(d, d)); }
    else if (view === 'week') { const s = monday(d), days = [...Array(7)].map((_, i) => addDays(s, i)); const a = new Date(s + 'T12:00'), b = new Date(days[6] + 'T12:00');
      title = `${a.getDate()} ${a.getMonth() !== b.getMonth() ? a.toLocaleDateString('fr-FR', { month: 'short' }) : ''} – ${b.getDate()} ${b.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`; body = timeGrid(days, items(days[0], days[6])); }
    else { title = AOS.cap(AOS.monthLabel(d.slice(0, 7))); body = monthGrid(d); }
    const tg = (k, l, c) => `<button class="chip ${f[k] ? '' : 'on'}" data-a="agf" data-k="${k}">${dot(c)}${l}</button>`;
    return AOS.header({ eyebrow: 'Agenda', title: esc(title), actions: AOS.newBtn('events', 'Événement', 1, `data-preset-date="${d}"`) }) +
    `<div class="toolbar ag-bar"><div class="seg">${[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-a="agview" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="seg"><button data-a="agnav" data-v="-1" aria-label="Précédent">${ic('left', 15)}</button><button data-a="agnav" data-v="0">Aujourd'hui</button><button data-a="agnav" data-v="1" aria-label="Suivant">${ic('chev', 15)}</button></div>
      <div class="chips">${tg('events', 'Événements', 'var(--violet)')}${AOS.modOn('calls') ? tg('calls', 'Calls', 'var(--pink)') : ''}${AOS.modOn('taches') ? tg('tasks', 'Échéances', 'var(--warn)') : ''}${AOS.modOn('presences') ? tg('leaves', 'Absences', 'var(--info)') : ''}</div></div>
    <section class="card ag">${body}</section>
    <p class="faint hint">${view === 'month' ? 'Glisse un événement ou un call sur un autre jour pour le déplacer. Clique sur un numéro de jour pour l\'ouvrir.' : 'Clique sur un créneau vide pour créer un événement, glisse un bloc pour le déplacer (au quart d\'heure). ⚠ = conflit horaire.'}</p>`;
  };
  Object.assign(AOS.act, {
    agview: el => { ui.agView = el.dataset.v; AOS.render(); },
    agday: el => { ui.agView = 'day'; ui.agDate = el.dataset.d; AOS.render(); },
    agf: el => { ui.agFilter = { ...(ui.agFilter || {}), [el.dataset.k]: !(ui.agFilter || {})[el.dataset.k] }; AOS.render(); },
    agnav: el => {
      const v = +el.dataset.v, view = ui.agView || (window.innerWidth < 700 ? 'day' : 'week'), d = ui.agDate || today();
      if (!v) ui.agDate = today();
      else if (view === 'day') ui.agDate = addDays(d, v);
      else if (view === 'week') ui.agDate = addDays(d, 7 * v);
      else ui.agDate = AOS.shiftMonth(d.slice(0, 7), v) + '-01';
      AOS.render();
    }
  });

  /* moving: events and calls keep their duration; snapped to 15 minutes */
  async function moveTo(ref, date, time) {
    const [kind, id] = ref.split(':'), col = kind === 'call' ? 'calls' : 'events', r = S[col].find(x => x.id === id); if (!r) return;
    if (!AOS.allowed(col, 'u')) { toast('Ton rôle ne permet pas de déplacer cet élément.', 'bad'); return; }
    const next = { ...r, date, ...(time !== undefined ? { time } : {}) };
    if (next.date === r.date && next.time === r.time) return;
    if (await AOS.save(col, next)) toast(`Déplacé au ${AOS.dShort(date)}${next.time ? ' à ' + next.time.replace(':', 'h') : ''}`);
  }
  let dragging = null, moved = false;
  AOS.afterRender.planning = () => {
    const root = document.querySelector('.ag'); if (!root) return;
    root.querySelectorAll('[data-drag]').forEach(el => {
      el.ondragstart = e => { dragging = el.dataset.drag; moved = true; el.classList.add('drag'); try { e.dataTransfer.setData('text/plain', dragging); e.dataTransfer.effectAllowed = 'move'; } catch (_) { } };
      el.ondragend = () => { el.classList.remove('drag'); setTimeout(() => { moved = false; }, 50); root.querySelectorAll('.over').forEach(x => x.classList.remove('over')); };
    });
    root.querySelectorAll('[data-col]').forEach(col => {
      col.ondragover = e => { if (dragging) { e.preventDefault(); col.classList.add('over'); } };
      col.ondragleave = () => col.classList.remove('over');
      col.ondrop = e => { if (!dragging) return; e.preventDefault(); col.classList.remove('over'); const y = e.clientY - col.getBoundingClientRect().top;
        const m = Math.max(0, Math.min((H1 - H0) * 60 - 15, Math.round(y / PX * 60 / 15) * 15)); moveTo(dragging, col.dataset.col, toHM(H0 * 60 + m)); dragging = null; };
    });
    root.querySelectorAll('[data-dropday]').forEach(cell => {
      cell.ondragover = e => { if (dragging) { e.preventDefault(); cell.classList.add('over'); } };
      cell.ondragleave = () => cell.classList.remove('over');
      cell.ondrop = e => { if (!dragging) return; e.preventDefault(); cell.classList.remove('over'); moveTo(dragging, cell.dataset.dropday, cell.classList.contains('ag-allcell') ? '' : undefined); dragging = null; };
    });
    root.onclick = e => {
      if (moved) return;
      const it = e.target.closest('[data-agedit]'); if (it) { const [c, i] = it.dataset.agedit.split(':'); AOS.openForm(c, i); return; }
      const sl = e.target.closest('[data-slot]');
      if (sl && AOS.allowed('events', 'c')) { const col = sl.parentElement, y = e.clientY - col.getBoundingClientRect().top, m = Math.floor(y / PX * 60 / 30) * 30;
        AOS.openForm('events', null, { date: col.dataset.col, time: toHM(H0 * 60 + m) }); }
    };
    const sc = root.querySelector('.ag-body');
    if (sc) { const h = new Date().getHours(); sc.scrollTop = ui.agScroll ?? Math.max(0, (Math.min(Math.max(h, 8), 20) - H0 - 1) * PX); sc.onscroll = () => { ui.agScroll = sc.scrollTop; }; }
  };
})();
