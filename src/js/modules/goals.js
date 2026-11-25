/* Agency OS — Objectifs. Values are computed from stored records (see AOS.goalValue); each goal
   shows its definition and data source. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, pill, dShort, eurK, diffDays, today, sortBy } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;

  const ST = { reached: ['Atteint', 'var(--ok)'], ontrack: ['En bonne voie', 'var(--accent)'], risk: ['À risque', 'var(--warn)'], failed: ['Non atteint', 'var(--bad)'], upcoming: ['À venir', 'var(--faint)'] };
  const metric = g => AOS.GOAL_METRICS[g.metric] || AOS.GOAL_METRICS.manual;
  const fmt = (g, v) => { const M = metric(g), u = g.metric === 'manual' ? (g.unit || '') : M.unit; if (v == null) return '—'; return u === '€' ? eurK(v) : `${Math.round(v * 10) / 10}${u ? ' ' + esc(u) : ''}`; };
  const canSee = g => !metric(g).fin || AOS.flag(me.role, 'finance_view');
  const scopeTxt = g => g.scope === 'Département' ? (g.dept || 'Département') : g.scope === 'Collaborateur' ? (AOS.nm('team', g.memberId) || 'Collaborateur') : 'Agence';

  AOS.goalInfo = g => {
    const value = AOS.goalValue(S, AOS.lists(), g);
    return { value, ...AOS.goalStatus(g, value, today()) };
  };
  AOS.goalCard = function (g, compact) {
    const M = metric(g), vis = canSee(g), x = AOS.goalInfo(g), [stTxt, stC] = ST[x.status];
    const t = today(), left = diffDays(g.end, t);
    const width = Math.max(0, Math.min(100, x.pct * 100));
    const marker = M.cumul && x.status !== 'upcoming' && t <= g.end ? `<i class="pace" style="left:${Math.min(100, x.elapsed * 100)}%" title="Rythme attendu aujourd'hui"></i>` : '';
    return `<div class="goal ${compact ? 'compact' : ''}" data-edit="goals:${g.id}" tabindex="0">
      <div class="g-top"><span class="tag">${esc(scopeTxt(g))}</span>${pill(stTxt, stC)}${AOS.demoTag(g)}</div>
      <h4>${esc(g.title)}</h4>
      ${vis ? `<div class="g-val"><b>${fmt(g, x.value)}</b><span class="muted"> / ${fmt(g, +g.target)}</span><span class="g-pct" style="color:${stC}">${Math.round(x.pct * 100)} %</span></div>
        <div class="g-bar"><span style="width:${width}%;background:${stC}"></span>${marker}</div>` : `<div class="g-val muted small">${ic('lock', 12)} Valeur réservée aux personnes qui voient les finances</div>`}
      <div class="g-meta"><span class="mono">${dShort(g.start)} → ${dShort(g.end)}</span>${x.status === 'upcoming' ? `<span>débute dans ${diffDays(g.start, t)} j</span>` : t <= g.end ? `<span>${left} j restant${left > 1 ? 's' : ''}</span>` : '<span>terminé</span>'}
        ${vis && x.projected !== null && t <= g.end && x.status !== 'upcoming' ? `<span>Projection : <b>${fmt(g, x.projected)}</b></span>` : ''}</div>
      ${compact ? '' : `<div class="g-def"><b>${esc(M.l)}</b> · ${esc(M.def)} <span class="faint">Source : ${esc(M.src)}.</span>${g.ownerId ? ` <span class="faint">Suivi : ${esc(AOS.nm('team', g.ownerId))}.</span>` : ''}</div>
        ${AOS.allowed('goals', 'c') ? `<div class="g-act"><button class="btn sm ghost" data-a="goaldup" data-id="${g.id}">${ic('plus', 13)}Reconduire le mois suivant</button></div>` : ''}`}
    </div>`;
  };

  AOS.views.objectifs = function () {
    const t = today(), sc = ui.goalScope || 'Toutes';
    let gs = S.goals; if (sc !== 'Toutes') gs = gs.filter(g => (g.scope || 'Agence') === sc);
    const info = new Map(gs.map(g => [g.id, AOS.goalInfo(g)]));
    const cur = gs.filter(g => g.start <= t && g.end >= t), up = gs.filter(g => g.start > t), past = gs.filter(g => g.end < t);
    const n = st => cur.filter(g => info.get(g.id).status === st).length;
    const sort = a => sortBy(a, g => ['risk', 'ontrack', 'reached', 'failed', 'upcoming'].indexOf(info.get(g.id).status) + g.end);
    const grid = a => `<div class="goals">${sort(a).map(g => AOS.goalCard(g)).join('')}</div>`;
    return AOS.header({ eyebrow: 'Accueil', title: `${cur.length} objectif${cur.length > 1 ? 's' : ''} en cours <span class="soft">· ${n('risk')} à risque.</span>`, actions: AOS.newBtn('goals', 'Objectif', 1) }) +
    `<div class="grid g4">
      <div class="card kpi"><span class="lbl">${AOS.dot('var(--accent)')}En bonne voie</span><span class="v">${n('ontrack')}</span><span class="s">au rythme attendu ou au-dessus</span></div>
      <div class="card kpi"><span class="lbl">${AOS.dot('var(--warn)')}À risque</span><span class="v">${n('risk')}</span><span class="s">sous 90 % du rythme attendu</span></div>
      <div class="card kpi"><span class="lbl">${AOS.dot('var(--ok)')}Atteints</span><span class="v">${n('reached') + past.filter(g => info.get(g.id).status === 'reached').length}</span><span class="s">en cours et terminés</span></div>
      <div class="card kpi"><span class="lbl">${AOS.dot('var(--faint)')}À venir</span><span class="v">${up.length}</span><span class="s">pas encore commencés</span></div></div>
    <div class="toolbar"><div class="chips">${['Toutes', ...AOS.GOAL_SCOPES].map(s => `<button class="chip ${sc === s ? 'on' : ''}" data-a="goalscope" data-v="${s}">${s}</button>`).join('')}</div>
      <span class="faint small">Le repère vertical sur la barre indique où tu devrais être aujourd'hui.</span></div>
    ${!S.goals.length ? `<div class="card"><div class="empty big">${ic('target', 22)}<h3>Aucun objectif</h3><p>Fixe un objectif de CA, de commission, de créatrices actives, de tâches terminées ou une valeur libre. La progression se calcule toute seule à partir de tes données.</p><div class="actions center">${AOS.newBtn('goals', 'Créer un objectif', 1)}</div></div></div>` : ''}
    ${cur.length ? `<h2 class="sh">En cours</h2>${grid(cur)}` : ''}
    ${up.length ? `<h2 class="sh">À venir</h2>${grid(up)}` : ''}
    ${past.length ? `<div class="sh-row"><h2 class="sh">Terminés · ${past.length}</h2><button class="linkbtn" data-a="goalpast">${ui.goalPast ? 'Masquer' : 'Afficher'}</button></div>${ui.goalPast ? grid(past) : ''}` : ''}
    <p class="faint hint">Historique et courbes de progression : phase 6.</p>`;
  };
  AOS.act.goalscope = el => { ui.goalScope = el.dataset.v; AOS.render(); };
  AOS.act.goalpast = () => { ui.goalPast = !ui.goalPast; AOS.render(); };
  AOS.act.goaldup = async el => {
    const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return;
    const s = new Date(g.end + 'T12:00'); s.setDate(s.getDate() + 1);
    const e = new Date(s); e.setMonth(e.getMonth() + 1); e.setDate(0);
    const { id, createdAt, updatedAt, demo, ...rest } = g;
    if (await AOS.save('goals', { ...rest, start: AOS.iso(s), end: AOS.iso(e), current: g.metric === 'manual' ? 0 : rest.current })) AOS.toast(`Objectif reconduit du ${dShort(AOS.iso(s))} au ${dShort(AOS.iso(e))}`);
  };

  /* dashboard block: pinned goals in progress, at-risk first */
  AOS.goalsWidget = function () {
    if (!AOS.modOn('objectifs')) return '';
    const t = today(), gs = S.goals.filter(g => g.pinned !== false && g.start <= t && g.end >= t);
    const order = ['risk', 'ontrack', 'reached', 'failed'];
    const list = sortBy(gs, g => order.indexOf(AOS.goalInfo(g).status)).slice(0, 4);
    return `<div class="card"><div class="card-h"><h3>Objectifs en cours</h3><button class="linkbtn" data-nav="objectifs">Tous les objectifs</button></div>
      <div class="card-b">${list.length ? `<div class="goals dash">${list.map(g => AOS.goalCard(g, 1)).join('')}</div>` : `<div class="empty flush">Aucun objectif épinglé en cours. ${AOS.allowed('goals', 'c') ? '<button class="linkbtn" data-new="goals">Créer un objectif</button>' : ''}</div>`}</div></div>`;
  };
})();
