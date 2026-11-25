/* Agency OS — Finances (phase 1 scope: revenues, expenses, commission, net result per month). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, dot, today, eur, eurK, monthLabel, shiftMonth, sortBy, dShort } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;

  /* edit / delete buttons on a transaction row (the whole row also opens the form) */
  const rowActs = f => `<td class="r acts">${AOS.allowed('finances', 'u') ? `<button class="iconbtn" data-edit="finances:${f.id}" aria-label="Modifier ${esc(f.label)}" title="Modifier">${ic('pen', 14)}</button>` : ''}${AOS.allowed('finances', 'd') ? `<button class="iconbtn del" data-a="delrec" data-col="finances" data-id="${f.id}" aria-label="Supprimer ${esc(f.label)}" title="Supprimer">${ic('trash', 14)}</button>` : ''}</td>`;
  const amt = f => `<td class="r mono" style="color:${f.type === 'Dépense' ? 'var(--bad)' : 'var(--ok)'}">${f.type === 'Dépense' ? '−' : '+'}${eur(f.amount)}</td>`;

  /* every transaction, all months: folded by default, with search, filters and edit / delete on each line */
  function allTx() {
    const open = !!ui.finAll, all = S.finances;
    const head = `<button class="fin-all-h" data-a="finall" aria-expanded="${open}">${ic(open ? 'down' : 'chev', 15)}<span>Toutes les transactions</span><b class="mono">${all.length}</b><span class="faint small">${open ? '' : 'modifier, supprimer, rechercher dans tout l\'historique'}</span></button>`;
    if (!open) return `<section class="card fin-all">${head}</section>`;
    const q = (ui.finQ || '').toLowerCase(), ty = ui.finType || '';
    let rows = all.filter(f => (!ty || f.type === ty) && (!q || [f.label, f.category, f.supplier, f.payMethod, AOS.nm('creators', f.creatorId), f.notes, f.date, String(f.amount)].join(' ').toLowerCase().includes(q)));
    rows = sortBy(rows, f => (f.date || '') + (f.createdAt || '')).reverse();
    const inc = rows.filter(f => f.type !== 'Dépense').reduce((t, f) => t + (+f.amount || 0), 0), out = rows.filter(f => f.type === 'Dépense').reduce((t, f) => t + (+f.amount || 0), 0);
    const lim = ui.finLim || 50, shown = rows.slice(0, lim);
    return `<section class="card fin-all open">${head}
      <div class="toolbar pad-x"><input class="input" id="finQ" placeholder="Rechercher un libellé, une catégorie, une créatrice, un montant…" value="${esc(ui.finQ || '')}" autocomplete="off">
        <div class="seg">${[['', 'Tout'], ['Revenu', 'Revenus'], ['Dépense', 'Dépenses']].map(([k, l]) => `<button class="${ty === k ? 'on' : ''}" data-a="fintype" data-v="${k}">${l}</button>`).join('')}</div>
        <span class="fin-sum"><span style="color:var(--ok)">+${eur(inc)}</span><span style="color:var(--bad)">−${eur(out)}</span><span class="faint">${rows.length} ligne${rows.length > 1 ? 's' : ''}</span></span></div>
      ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Libellé</th><th>Catégorie</th><th>Créatrice</th><th class="r">Montant</th><th class="r"><span class="sr">Actions</span></th></tr></thead><tbody>
        ${shown.map(f => `<tr data-edit="finances:${f.id}" tabindex="0"><td class="mono muted">${f.date ? dShort(f.date) + ' ' + f.date.slice(0, 4) : '—'}</td><td class="muted">${esc(f.type || '')}</td><td>${esc(f.label)}${AOS.demoTag(f)}${f.recurringOf || (f.recurrence && f.recurrence !== 'Aucune') ? ' <span class="tag">récurrente</span>' : ''}</td><td class="muted">${esc(f.category || '')}</td><td>${esc(AOS.nm('creators', f.creatorId))}</td>${amt(f)}${rowActs(f)}</tr>`).join('')}
      </tbody></table></div>${rows.length > lim ? `<div class="pad center"><button class="btn" data-a="finmore">Afficher ${Math.min(50, rows.length - lim)} de plus (${rows.length - lim} restantes)</button></div>` : ''}`
      : `<div class="empty big">${all.length ? 'Aucune transaction ne correspond.' : 'Aucune transaction saisie.'}</div>`}</section>`;
  }
  AOS.act.finall = () => { ui.finAll = !ui.finAll; AOS.render(); };
  AOS.act.fintype = el => { ui.finType = el.dataset.v; ui.finLim = 50; AOS.render(); };
  AOS.act.finmore = () => { ui.finLim = (ui.finLim || 50) + 50; AOS.render(); };
  AOS.inputs.finQ = el => { ui.finQ = el.value; ui.finLim = 50; AOS.render(); };

  AOS.views.finances = function () {
    if (!AOS.flag(me.role, 'finance_view')) return AOS.header({ eyebrow: 'Business', title: 'Finances' }) + `<div class="card"><div class="empty big">${ic('lock', 22)}<h3>Données financières masquées</h3><p>Ton rôle n'inclut pas « Voir les finances ».</p></div></div>`;
    const mk = ui.finMonth || today().slice(0, 7);
    const rev = AOS.fin.rev(S, mk), exp = AOS.fin.exp(S, mk), com = AOS.fin.com(S, mk);
    const months = [...Array(6)].map((_, i) => shiftMonth(mk, i - 5)).map(k => ({ k, v: AOS.fin.com(S, k) })); const mx = Math.max(1, ...months.map(m => m.v));
    const per = S.creators.map(c => ({ c, v: AOS.fin.rev(S, mk, c.id) })).filter(x => x.v).sort((a, b) => b.v - a.v); const mp = Math.max(1, ...per.map(x => x.v));
    const tx = sortBy(S.finances.filter(f => f.date && f.date.slice(0, 7) === mk), f => f.date).reverse();
    const unlinked = tx.filter(f => f.type === 'Revenu' && !f.creatorId).length;
    return AOS.header({ eyebrow: 'Business', title: AOS.cap(monthLabel(mk)),
      actions: `<div class="seg"><button data-a="month" data-v="-1" aria-label="Mois précédent">${ic('left', 15)}</button><button data-a="month" data-v="0">Ce mois</button><button data-a="month" data-v="1" aria-label="Mois suivant">${ic('chev', 15)}</button></div>${AOS.can(me.role, 'finances', 'x') ? `<button class="btn" data-a="csvexport" data-col="finances">${ic('download', 15)}CSV</button>` : ''}${AOS.newBtn('finances', 'Transaction', 1)}` }) +
    `<div class="grid g4">
      <div class="card kpi"><span class="lbl">${dot('var(--accent)')}CA créatrices</span><span class="v">${eurK(rev)}</span><span class="s">Revenus bruts saisis</span></div>
      <div class="card kpi"><span class="lbl">${dot('var(--ok)')}Commission agence</span><span class="v">${eurK(com)}</span><span class="s">CA × % du contrat de chaque créatrice</span></div>
      <div class="card kpi"><span class="lbl">${dot('var(--bad)')}Dépenses agence</span><span class="v">${eurK(exp)}</span><span class="s">Salaires, outils, pub…</span></div>
      <div class="card kpi"><span class="lbl">${dot('var(--info)')}Résultat</span><span class="v ${com - exp < 0 ? 'down' : ''}">${eurK(com - exp)}</span><span class="s">Commission − dépenses</span></div>
    </div>
    ${unlinked ? `<div class="banner">${ic('star', 15)}<span>${unlinked} revenu(s) sans créatrice liée : ils comptent dans le CA mais pas dans la commission.</span></div>` : ''}
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Commission agence · 6 mois</h3></div><div class="card-b"><div class="cols" role="img" aria-label="Commission agence sur 6 mois">${months.map(m => `<div class="c ${m.k === mk ? 'cur' : ''}"><div class="b" style="height:${Math.max(2, m.v / mx * 100)}%"><span>${m.v ? eurK(m.v) : ''}</span></div><span class="x">${new Date(m.k + '-15T12:00').toLocaleDateString('fr-FR', { month: 'short' })}</span></div>`).join('')}</div></div></div>
      <div class="card"><div class="card-h"><h3>CA par créatrice</h3></div><div class="card-b">${per.length ? `<div class="bars">${per.map(x => `<div class="bar"><span class="n">${esc(x.c.name)}</span><span class="track"><span class="fill" style="width:${x.v / mp * 100}%"></span></span><span class="v">${eurK(x.v)}</span></div>`).join('')}</div>` : '<div class="empty flush">Aucun revenu saisi pour ce mois.</div>'}</div></div>
    </div>
    <div class="card tbl-wrap">${tx.length ? `<table><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Créatrice</th><th class="r">Montant</th><th class="r"><span class="sr">Actions</span></th></tr></thead><tbody>
      ${tx.map(f => `<tr data-edit="finances:${f.id}" tabindex="0"><td class="mono muted">${dShort(f.date)}</td><td>${esc(f.label)}${AOS.demoTag(f)}</td><td class="muted">${esc(f.category || '')}</td><td>${esc(AOS.nm('creators', f.creatorId))}</td>${amt(f)}${rowActs(f)}</tr>`).join('')}
    </tbody></table>` : `<div class="empty big">Aucune transaction en ${monthLabel(mk)}.</div>`}</div>
    ${allTx()}
    <p class="faint hint">Frais de plateforme, part créatrice, trésorerie, multi-devises et simulateur : phase 4. Les dépenses récurrentes se gèrent dans Dépenses.</p>`;
  };
  AOS.act.month = el => { const cur = ui.finMonth || today().slice(0, 7); ui.finMonth = el.dataset.v === '0' ? null : shiftMonth(cur, +el.dataset.v); AOS.render(); };
})();
