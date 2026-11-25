/* Agency OS — Dépenses (detail, recurring, CSV import) and Analytics (trends, comparisons, profitability). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, pill, dot, today, eur, eurK, monthLabel, shiftMonth, sortBy, dShort, toast } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const locked = (title) => AOS.header({ eyebrow: 'Business', title }) + `<section class="card box"><div class="box-empty">${ic('lock', 22)}<p>Ton rôle n'inclut pas « Voir les finances ».</p></div></section>`;

  /* one measure per chart; negative values hang below a zero line; hover shows the value */
  AOS.colChart = function (pts, fmt, cur) {
    const max = Math.max(0, ...pts.map(p => p.v)), min = Math.min(0, ...pts.map(p => p.v)), range = (max - min) || 1, base = max / range * 100;
    return `<div class="cchart" role="img" aria-label="${esc(pts.map(p => `${p.label} ${fmt(p.v)}`).join(', '))}">
      ${min < 0 ? `<i class="zero" style="top:${base}%"></i>` : ''}
      ${pts.map(p => { const h = Math.abs(p.v) / range * 100; return `<div class="cc ${p.k === cur ? 'cur' : ''}" title="${esc(p.label)} : ${esc(fmt(p.v))}">
        <span class="cb ${p.v < 0 ? 'neg' : ''}" style="${p.v < 0 ? `top:${base}%` : `bottom:${100 - base}%`};height:${Math.max(p.v ? 1.5 : 0, h)}%"><em>${esc(fmt(p.v))}</em></span><span class="cx">${esc(p.short)}</span></div>`; }).join('')}</div>`;
  };
  const months = (end, n) => [...Array(n)].map((_, i) => shiftMonth(end, i - n + 1));
  const short = k => new Date(k + '-15T12:00').toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const pct = (a, b) => b ? Math.round((a - b) / Math.abs(b) * 100) : null;
  const delta = (a, b, inverse) => { const d = pct(a, b); if (d === null) return '<span class="faint">—</span>'; const good = inverse ? d <= 0 : d >= 0; return `<span class="${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} %</span>`; };

  /* ================= Dépenses ================= */
  AOS.views.depenses = function () {
    if (!AOS.flag(me.role, 'finance_view')) return locked('Dépenses');
    const L = AOS.lists(), mk = ui.expMonth || today().slice(0, 7);
    const exps = S.finances.filter(f => f.type === 'Dépense'), inM = exps.filter(f => f.date && f.date.slice(0, 7) === mk);
    const sum = a => a.reduce((t, f) => t + (+f.amount || 0), 0);
    const total = sum(inM), prev = sum(exps.filter(f => f.date && f.date.slice(0, 7) === shiftMonth(mk, -1)));
    const due = inM.filter(f => f.payStatus === 'À payer');
    const recs = exps.filter(f => f.recurrence && f.recurrence !== 'Aucune' && !f.recurringOf);
    const monthlyCost = recs.reduce((t, f) => t + (+f.amount || 0) / (f.recurrence === 'Annuelle' ? 12 : 1), 0);
    const plan = AOS.recurringPlan(S, mk);
    const byCat = {}; inM.forEach(f => { byCat[f.category || 'Autre'] = (byCat[f.category || 'Autre'] || 0) + (+f.amount || 0); });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...cats.map(c => c[1]));
    const canC = AOS.allowed('finances', 'c'), canU = AOS.allowed('finances', 'u');
    return AOS.header({ eyebrow: 'Business', title: AOS.cap(monthLabel(mk)),
      actions: `<div class="seg"><button data-a="expm" data-v="-1" aria-label="Mois précédent">${ic('left', 15)}</button><button data-a="expm" data-v="0">Ce mois</button><button data-a="expm" data-v="1" aria-label="Mois suivant">${ic('chev', 15)}</button></div>
        ${canC ? `<button class="btn" data-a="csvin">${ic('upload', 15)}Importer un CSV</button><button class="btn pri" data-new="finances" data-preset-type="Dépense" data-preset-category="${esc(L.expenseCats[0] || '')}">${ic('plus', 15)}Dépense</button>` : ''}` }) +
    (plan.length && canC ? `<div class="banner info">${ic('swap', 15)}<span><b>${plan.length} dépense${plan.length > 1 ? 's' : ''} récurrente${plan.length > 1 ? 's' : ''}</b> à ajouter pour ${monthLabel(mk)} (${eur(plan.reduce((t, o) => t + (+o.data.amount || 0), 0))}).</span><button class="btn sm pri" data-a="recgen">Ajouter</button></div>` : '') +
    `<section class="card stats">
      <div class="st"><b>${eurK(total)}</b><span>dépenses du mois · ${delta(total, prev, true)}</span></div>
      <div class="st"><b class="${due.length ? 'warn-t' : ''}">${eurK(sum(due))}</b><span>${due.length} à payer</span></div>
      <div class="st"><b>${eurK(monthlyCost)}</b><span>abonnements / mois</span></div>
      <div class="st"><b>${inM.length}</b><span>opérations</span></div></section>
    <div class="grid g32 top">
      <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--bad)')}Dépenses du mois</span></div>
        ${inM.length ? sortBy(inM, f => f.date).reverse().map(f => `<div class="line" data-edit="finances:${f.id}"><span class="when"><b>${dShort(f.date)}</b></span>
          <span class="what"><span class="ttl">${esc(f.label)}${AOS.demoTag(f)}${f.recurringOf || (f.recurrence && f.recurrence !== 'Aucune') ? ' <span class="tag">récurrente</span>' : ''}</span><span class="sub">${[f.category, f.supplier, f.payMethod].filter(Boolean).map(esc).join(' · ')}</span></span>
          ${f.receipt ? `<a class="iconbtn" href="${esc(f.receipt)}" target="_blank" rel="noopener" title="Justificatif">${ic('file', 14)}</a>` : ''}
          ${canU ? `<button class="chip ${f.payStatus === 'À payer' ? 'warnchip' : ''}" data-a="paytoggle" data-id="${f.id}">${f.payStatus === 'À payer' ? 'À payer' : 'Payée'}</button>` : pill(f.payStatus || 'Payée', f.payStatus === 'À payer' ? 'var(--warn)' : 'var(--ok)')}
          <b class="mono amt">−${eur(f.amount)}</b></div>`).join('') : `<div class="box-empty"><p>Aucune dépense en ${monthLabel(mk)}.</p></div>`}</section>
      <div class="stack">
        <section class="card box"><div class="box-h"><span class="lbl">Par catégorie</span></div><div class="card-b">${cats.length ? `<div class="bars">${cats.map(([c, v]) => `<div class="bar"><span class="n">${esc(c)}</span><span class="track"><span class="fill" style="width:${v / mx * 100}%;--c:var(--bad)"></span></span><span class="v">${eurK(v)}</span></div>`).join('')}</div>` : '<div class="empty flush">—</div>'}</div></section>
        <section class="card box"><div class="box-h"><span class="lbl">${dot('var(--violet)')}Abonnements et récurrentes</span></div>
          ${recs.length ? sortBy(recs, f => AOS.nextDue(f, today()) || '').map(f => `<div class="line" data-edit="finances:${f.id}"><span class="what"><span class="ttl">${esc(f.label)}</span><span class="sub">${esc(f.recurrence)} · prochaine le ${dShort(AOS.nextDue(f, today()))}</span></span><b class="mono">${eur(f.amount)}</b></div>`).join('') : '<div class="box-empty"><p>Choisis « Mensuelle » ou « Annuelle » dans une dépense pour la suivre ici.</p></div>'}</section>
      </div></div>
    <p class="faint hint">Les dépenses font partie des Finances : elles comptent dans le résultat, les objectifs et Analytics. Budgets : retirés à ta demande.</p>`;
  };
  Object.assign(AOS.act, {
    expm: el => { const cur = ui.expMonth || today().slice(0, 7); ui.expMonth = el.dataset.v === '0' ? null : shiftMonth(cur, +el.dataset.v); AOS.render(); },
    paytoggle: async el => { const f = S.finances.find(x => x.id === el.dataset.id); if (f) await AOS.save('finances', { ...f, payStatus: f.payStatus === 'À payer' ? 'Payée' : 'À payer' }); },
    recgen: async () => {
      const ops = AOS.recurringPlan(S, ui.expMonth || today().slice(0, 7));
      const r = await AOS.applyOps(ops.map(o => ({ ...o, data: { ...o.data, createdAt: Date.now(), updatedAt: Date.now(), createdBy: me.uid || 'local' } })));
      AOS.audit({ act: 'create', col: 'finances', label: `${r.ok} dépense(s) récurrente(s) ajoutée(s)` }); toast(`${r.ok} dépense(s) ajoutée(s), marquées « À payer »`);
    },
    csvin: () => openCsv()
  });

  /* ----- CSV import (bank export or spreadsheet) ----- */
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '', sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  AOS.parseCsv = parseCsv;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const pickCol = (head, names) => head.findIndex(h => names.some(n => norm(h).includes(n)));
  /* map CSV rows to transactions; returns {items, errors} */
  AOS.csvToTx = function (rows, defType) {
    const head = rows[0] || [], c = { date: pickCol(head, ['date']), label: pickCol(head, ['libelle', 'label', 'description', 'intitule', 'objet']), amount: pickCol(head, ['montant', 'amount', 'debit', 'somme']),
      cat: pickCol(head, ['categorie', 'category']), type: pickCol(head, ['type']), sup: pickCol(head, ['fournisseur', 'beneficiaire', 'supplier', 'tiers']) };
    if (c.date < 0 || c.amount < 0) return { items: [], errors: ['Colonnes « date » et « montant » introuvables dans la première ligne.'] };
    const items = [], errors = [];
    rows.slice(1).forEach((r, i) => {
      const ds = (r[c.date] || '').trim(), m = ds.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/) || null;
      const date = m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}/.test(ds) ? ds.slice(0, 10) : '');
      const raw = String(r[c.amount] || '').replace(/\s|€|\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'), amt = parseFloat(raw);
      if (!date || Number.isNaN(amt)) { errors.push(`Ligne ${i + 2} ignorée (date ou montant illisible).`); return; }
      const t = c.type >= 0 && /revenu|recette|credit|income/i.test(r[c.type]) ? 'Revenu' : c.type >= 0 && /depense|debit|expense/i.test(norm(r[c.type])) ? 'Dépense' : amt < 0 ? 'Dépense' : defType;
      items.push({ date, label: (c.label >= 0 ? r[c.label] : '').trim() || 'Import CSV', amount: Math.abs(amt), type: t, category: c.cat >= 0 ? (r[c.cat] || '').trim() : '', supplier: c.sup >= 0 ? (r[c.sup] || '').trim() : '', payStatus: 'Payée', recurrence: 'Aucune' });
    });
    return { items, errors };
  };
  function openCsv() {
    document.getElementById('layer').insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="csv"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="csvT"><div class="card-h"><h3 id="csvT">Importer des transactions (CSV)</h3><button class="btn sm ghost" data-a="csvclose" aria-label="Fermer">${ic('x')}</button></div>
      <div class="modal-b stack"><p class="muted">Export de ta banque ou d'un tableur. Colonnes reconnues : <b>date</b>, <b>montant</b>, libellé, catégorie, type, fournisseur. Un montant négatif est une dépense.</p>
      <input type="file" id="csvFile" accept=".csv,text/csv" class="input"><div id="csvPrev"></div></div></div></div>`);
    document.getElementById('csvFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const { items, errors } = AOS.csvToTx(parseCsv(await f.text()), 'Dépense'), box = document.getElementById('csvPrev');
      const L = AOS.lists();
      items.forEach(x => { if (!x.category) x.category = x.type === 'Dépense' ? L.expenseCats[L.expenseCats.length - 1] : L.revenueCats[L.revenueCats.length - 1]; });
      box.innerHTML = `${errors.map(x => `<div class="faint small">${esc(x)}</div>`).join('')}
        ${items.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Libellé</th><th>Type</th><th class="r">Montant</th></tr></thead><tbody>${items.slice(0, 8).map(x => `<tr class="static"><td class="mono">${x.date}</td><td>${esc(x.label)}</td><td>${x.type}</td><td class="r mono">${eur(x.amount)}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted">${items.length} transaction(s) prête(s)${items.length > 8 ? ' (8 premières affichées)' : ''}. Elles seront marquées « Import CSV » pour les retrouver.</p><div class="form-foot"><button class="btn pri" id="csvGo">Importer ${items.length} transaction(s)</button></div>` : ''}`;
      const go = document.getElementById('csvGo');
      if (go) go.onclick = async () => {
        go.disabled = true; const batch = 'csv' + Date.now().toString(36);
        const r = await AOS.applyOps(items.map((x, i) => ({ op: 'set', col: 'finances', id: batch + '-' + i, data: { ...x, importBatch: batch, createdAt: Date.now(), updatedAt: Date.now(), createdBy: me.uid || 'local' } })));
        AOS.audit({ act: 'create', col: 'finances', label: `Import CSV : ${r.ok} transaction(s)` });
        document.querySelector('#layer [data-scrim="csv"]')?.remove(); toast(`${r.ok} transaction(s) importée(s)${r.failed ? `, ${r.failed} échec(s)` : ''}`, r.failed ? 'bad' : '');
      };
    };
  }
  AOS.act.csvclose = () => document.querySelector('#layer [data-scrim="csv"]')?.remove();

  /* ================= Analytics ================= */
  AOS.views.analytics = function () {
    const n = ui.anN || 6, end = today().slice(0, 7), ks = months(end, n), canFin = AOS.flag(me.role, 'finance_view');
    const L = AOS.lists(), isDone = x => AOS.kindOf(L, 'taskStatus', x.status) === 'done';
    const done = ks.map(k => ({ k, label: monthLabel(k), short: short(k), v: S.tasks.filter(x => isDone(x) && x.doneAt && AOS.iso(x.doneAt).slice(0, 7) === k).length }));
    const callsDone = ks.map(k => ({ k, label: monthLabel(k), short: short(k), v: S.calls.filter(c => AOS.kindOf(L, 'callStatus', c.status) === 'done' && (c.date || '').slice(0, 7) === k).length }));
    const intF = v => String(Math.round(v));
    let fin = '';
    if (canFin) {
      const ser = AOS.monthlySeries(S, ks), pts = f => ser.map(x => ({ k: x.k, label: monthLabel(x.k), short: short(x.k), v: x[f] }));
      const sumOf = f => ser.reduce((t, x) => t + x[f], 0);
      const cm = AOS.monthlySeries(S, [end, shiftMonth(end, -1), shiftMonth(end, -12)]);
      const from = ks[0] + '-01', to = end + '-31', inP = f => f.date && f.date >= from && f.date <= to;
      const rows = S.creators.map(c => {
        const rev = S.finances.filter(f => f.type === 'Revenu' && f.creatorId === c.id && inP(f)).reduce((t, f) => t + (+f.amount || 0), 0);
        const com = rev * (+c.commission || 0) / 100, exp = S.finances.filter(f => f.type === 'Dépense' && f.creatorId === c.id && inP(f)).reduce((t, f) => t + (+f.amount || 0), 0);
        return { c, rev, com, exp, net: com - exp };
      }).filter(r => r.rev || r.exp).sort((a, b) => b.net - a.net);
      const cats = {}; S.finances.filter(f => f.type === 'Dépense' && inP(f)).forEach(f => { cats[f.category || 'Autre'] = (cats[f.category || 'Autre'] || 0) + (+f.amount || 0); });
      const catL = Object.entries(cats).sort((a, b) => b[1] - a[1]), cmx = Math.max(1, ...catL.map(c => c[1]));
      const chart = (title, f, note) => `<section class="card pad"><div class="ch-h"><span class="muted">${title}</span><b>${eurK(sumOf(f))}</b><span class="faint small">${note || `sur ${n} mois`}</span></div>${AOS.colChart(pts(f), eurK, end)}</section>`;
      fin = `<h2 class="sh">Finances</h2>
      <div class="grid g2">${chart('CA créatrices', 'rev')}${chart('Commission agence', 'com')}${chart('Dépenses', 'exp')}${chart('Résultat (commission − dépenses)', 'net')}</div>
      <section class="card"><div class="tbl-wrap"><table><thead><tr><th>Comparaison</th><th class="r">${AOS.cap(monthLabel(end))}</th><th class="r">Mois précédent</th><th class="r">Évolution</th><th class="r">Même mois N-1</th><th class="r">Évolution</th></tr></thead><tbody>
        ${[['CA créatrices', 'rev'], ['Commission agence', 'com'], ['Dépenses', 'exp', 1], ['Résultat', 'net']].map(([l, f, inv]) => `<tr class="static"><td>${l}</td><td class="r mono">${eur(cm[0][f])}</td><td class="r mono">${eur(cm[1][f])}</td><td class="r">${delta(cm[0][f], cm[1][f], inv)}</td><td class="r mono">${eur(cm[2][f])}</td><td class="r">${delta(cm[0][f], cm[2][f], inv)}</td></tr>`).join('')}
      </tbody></table></div></section>
      <div class="grid g32 top"><section class="card"><div class="card-h"><h3>Rentabilité par créatrice · ${n} mois</h3></div>${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Créatrice</th><th class="r">CA</th><th class="r">Commission</th><th class="r">Dépenses liées</th><th class="r">Résultat agence</th></tr></thead><tbody>
        ${rows.map(r => `<tr data-open="creators:${r.c.id}"><td>${esc(r.c.name)}</td><td class="r mono">${eurK(r.rev)}</td><td class="r mono">${eurK(r.com)}</td><td class="r mono">${eurK(r.exp)}</td><td class="r mono ${r.net < 0 ? 'down' : ''}"><b>${eurK(r.net)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucun revenu sur la période.</div>'}</section>
        <section class="card"><div class="card-h"><h3>Dépenses par catégorie</h3></div><div class="card-b">${catL.length ? `<div class="bars">${catL.map(([c, v]) => `<div class="bar"><span class="n">${esc(c)}</span><span class="track"><span class="fill" style="width:${v / cmx * 100}%;--c:var(--bad)"></span></span><span class="v">${eurK(v)}</span></div>`).join('')}</div>` : '<div class="empty flush">—</div>'}</div></section></div>`;
    }
    return AOS.header({ eyebrow: 'Business', title: 'Analytics', actions: `<div class="seg"><button class="${n === 6 ? 'on' : ''}" data-a="ann" data-v="6">6 mois</button><button class="${n === 12 ? 'on' : ''}" data-a="ann" data-v="12">12 mois</button></div>` }) +
      fin + `<h2 class="sh">Activité</h2><div class="grid g2">
        <section class="card pad"><div class="ch-h"><span class="muted">Tâches terminées</span><b>${done.reduce((t, x) => t + x.v, 0)}</b><span class="faint small">sur ${n} mois</span></div>${AOS.colChart(done, intF, end)}</section>
        <section class="card pad"><div class="ch-h"><span class="muted">Calls réalisés</span><b>${callsDone.reduce((t, x) => t + x.v, 0)}</b><span class="faint small">sur ${n} mois</span></div>${AOS.colChart(callsDone, intF, end)}</section></div>
      ${canFin ? '' : '<p class="faint hint">Les graphiques financiers sont réservés aux personnes qui voient les finances.</p>'}
      <p class="faint hint">Survole une barre pour voir sa valeur. Le mois en cours est en couleur pleine.</p>`;
  };
  AOS.act.ann = el => { ui.anN = +el.dataset.v; AOS.render(); };
})();
