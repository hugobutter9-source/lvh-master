/* Agency OS — Calls (no DM features) and Scripts (PPV / chatting script library). */
(function () {
  const AOS = window.AOS;
  const { esc, ic, pill, dot, today, addDays, dShort, dLong, sortBy, toast } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;

  /* ================= Calls ================= */
  const ck = c => AOS.kindOf(AOS.lists(), 'callStatus', c.status);
  const ckey = c => (c.date || '') + (c.time || '');
  /* earlier calls with the same person: same élève, else same créatrice, else same name. Most recent first. */
  AOS.callHistory = function (c) {
    const nameOf = x => (x.title || '').trim().toLowerCase();
    const same = x => c.studentId ? x.studentId === c.studentId : c.creatorId ? x.creatorId === c.creatorId : (!x.studentId && !x.creatorId && nameOf(x) === nameOf(c));
    return S.calls.filter(x => x.id !== c.id && same(x) && ck(x) !== 'planned' && ck(x) !== 'cancelled' && ckey(x) <= ckey(c)).sort((a, b) => ckey(b).localeCompare(ckey(a)));
  };
  AOS.callsToWrite = function () {   // calls that happened and have no notes yet
    const t = today(), from = addDays(t, -21);
    return sortBy(S.calls.filter(c => !(c.result || '').trim() && c.date >= from && (ck(c) === 'done' || (ck(c) === 'planned' && c.date < t))), c => ckey(c)).reverse();
  };
  const ago = d => { const n = AOS.diffDays(today(), d); return n <= 0 ? "aujourd'hui" : n === 1 ? 'hier' : `il y a ${n} jours`; };
  const inTxt = d => { const n = AOS.diffDays(d, today()); return n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : n > 1 ? `dans ${n} jours` : ago(d); };
  AOS.callLastTxt = function (c) {   // one line shown under an upcoming call
    const last = AOS.callHistory(c)[0];
    if (!last) return 'Premier call : pas encore de notes';
    const txt = (last.prep || last.result || '').trim().replace(/\s+/g, ' ');
    return `Dernier call ${dShort(last.date)} : ${txt || 'pas de notes'}`;
  };
  AOS.callLine = function (c, withDate, sub) {
    const L = AOS.lists(), planned = ck(c) === 'planned';
    return `<div class="line" data-edit="calls:${c.id}"><span class="when"><b>${esc(c.time ? c.time.replace(':', 'h') : '—')}</b>${withDate ? `<small>${dShort(c.date)}</small>` : ''}</span>
      <span class="what"><span class="ttl">${ic('phone', 13)} ${esc(c.title)}${AOS.demoTag(c)}</span><span class="sub">${sub ? esc(sub) : [c.type, AOS.nm('team', c.ownerId), AOS.nm('creators', c.creatorId)].filter(Boolean).map(esc).join(' · ')}</span></span>
      ${planned ? `<button class="btn sm" data-a="callbrief" data-id="${c.id}" title="Notes du dernier call et points à aborder">${ic('book', 13)}Brief</button>` : ''}
      ${planned && AOS.allowed('calls', 'u') ? `<button class="btn sm pri" data-a="calldone" data-id="${c.id}">Fait</button>` : pill(c.status, AOS.colorOf(L, 'callStatus', c.status))}</div>`;
  };

  /* ---------- brief: everything to re-read before a call ---------- */
  AOS.briefHtml = function (c) {
    const hist = AOS.callHistory(c), last = hist[0], st = c.studentId ? S.students.find(x => x.id === c.studentId) : null;
    const fin = AOS.flag(me.role, 'finance_view'), rest = st ? Math.max(0, (+st.price || 0) - (+st.paid || 0)) : 0;
    const since = st && AOS.sinceTxt ? AOS.sinceTxt(st.start) : '';
    const notes = st ? S.snotes.filter(n => n.studentId === st.id && (!last || (n.at || 0) >= new Date(last.date + 'T00:00').getTime())).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 5) : [];
    const block = (h, body) => `<div class="sec"><h5>${h}</h5>${body}</div>`;
    return `<div class="brief">
      <div class="brief-when">${ic('cal', 15)}<b>${c.date ? AOS.cap(dLong(c.date)) : 'Date à fixer'}${c.time ? ' à ' + esc(c.time.replace(':', 'h')) : ''}</b><span class="muted">${c.date ? inTxt(c.date) : ''}${c.type ? ' · ' + esc(c.type) : ''}</span></div>
      ${st ? `<div class="brief-facts">${[since ? ['Ensemble depuis', since] : null, ['Progression', `${Math.max(0, Math.min(100, +st.progress || 0))} %`], st.step ? ['Étape', esc(st.step)] : null, fin && (+st.price || 0) ? ['Reste à payer', rest ? `<b class="warn-t">${AOS.eur(rest)}</b>` : 'Tout est payé'] : null, ['Calls faits', hist.length]].filter(Boolean).map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>` : ''}
      ${last ? block(`Dernier call · ${dShort(last.date)} <span class="faint">(${ago(last.date)})</span>`, `<div class="pre brief-note">${(last.result || '').trim() ? esc(last.result) : '<span class="faint">Aucune note écrite pour ce call.</span>'}</div>`)
        : block('Dernier call', '<p class="muted">C\'est le premier call avec cette personne : rien à relire.</p>')}
      ${last && (last.prep || '').trim() ? block('Ce que tu voulais aborder cette fois', `<div class="pre brief-note hl">${esc(last.prep)}</div>`) : ''}
      ${last && last.nextAction ? block('Suite prévue après le dernier call', `<p>${esc(last.nextAction)}${last.nextDate ? ` <span class="muted">· pour le ${dShort(last.nextDate)}</span>` : ''} ${last.nextDone ? pill('Fait', 'var(--ok)') : pill('Pas encore fait', 'var(--warn)')}</p>`) : ''}
      ${st && st.goal ? block('Son objectif', `<div class="pre">${esc(st.goal)}</div>`) : ''}
      ${notes.length ? block('Notes ajoutées depuis', notes.map(n => `<p class="brief-n">${pill(n.tag || 'Note', AOS.colorOf(AOS.lists(), 'studentNoteTags', n.tag))} ${esc(n.text)}</p>`).join('')) : ''}
      ${hist.length > 1 ? block('Calls précédents', `<div class="card list">${hist.slice(1, 5).map(h => `<div class="li click" data-edit="calls:${h.id}"><div class="grow"><div class="title">${dShort(h.date)}</div><div class="sub">${esc((h.result || 'Pas de notes').replace(/\s+/g, ' '))}</div></div></div>`).join('')}</div>`) : ''}
    </div>`;
  };
  AOS.openBrief = function (id) {
    const c = S.calls.find(x => x.id === id); if (!c) return;
    document.querySelector('#layer [data-scrim="brief"]')?.remove();
    document.getElementById('layer').insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="brief"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="briefT">
      <div class="card-h"><h3 id="briefT">Avant ton call avec ${esc(c.title)}</h3><button class="btn sm ghost" data-a="briefclose" aria-label="Fermer">${ic('x')}</button></div>
      ${AOS.briefHtml(c)}
      <div class="form-foot pad">${c.studentId && S.students.some(x => x.id === c.studentId) ? `<button class="btn ghost" data-a="briefopen" data-id="${c.studentId}">Ouvrir la fiche</button>` : ''}
        ${AOS.allowed('calls', 'u') ? `<button class="btn" data-a="briefedit" data-id="${c.id}">Modifier le call</button>${ck(c) === 'planned' ? `<button class="btn pri" data-a="briefdone" data-id="${c.id}">${ic('pen', 14)}Call fait : écrire les notes</button>` : ''}` : ''}</div></div></div>`);
  };
  AOS.views.calls = function () {
    const L = AOS.lists(), t = today(), tab = ui.callTab || 'up';
    let cs = S.calls; if (ui.callType) cs = cs.filter(c => c.type === ui.callType);
    const up = sortBy(cs.filter(c => ck(c) === 'planned'), c => c.date + (c.time || '')), past = sortBy(cs.filter(c => ck(c) !== 'planned'), c => c.date + (c.time || '')).reverse();
    const follow = sortBy(S.calls.filter(c => c.nextAction && c.nextDate && c.nextDate <= addDays(t, 7) && !c.nextDone), c => c.nextDate);
    const list = tab === 'up' ? up : past;
    const toWrite = AOS.allowed('calls', 'u') ? AOS.callsToWrite() : [];
    const byDay = {}; list.forEach(c => (byDay[c.date] = byDay[c.date] || []).push(c));
    const wk = up.filter(c => c.date <= addDays(t, 7)).length;
    return AOS.header({ eyebrow: 'Agence', title: `${wk} call${wk > 1 ? 's' : ''} <span class="soft">dans les 7 jours.</span>`, actions: AOS.newBtn('calls', 'Nouveau call', 1) }) +
    (follow.length ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--warn)')}Suites à donner</span></div>${follow.map(c => `<div class="line" data-edit="calls:${c.id}"><span class="when"><b>${dShort(c.nextDate)}</b></span><span class="what"><span class="ttl">${esc(c.nextAction)}</span><span class="sub">après le call avec ${esc(c.title)}</span></span>${AOS.allowed('calls', 'u') ? `<button class="tick" data-a="callnext" data-id="${c.id}" aria-label="Marquer comme fait"></button>` : ''}</div>`).join('')}</section>` : '') +
    (toWrite.length ? `<section class="card box"><div class="box-h"><span class="lbl">${dot('var(--violet)')}Notes à écrire</span><span class="faint small">Elles te seront ressorties avant le prochain call</span></div>${toWrite.slice(0, 5).map(c => `<div class="line" data-a="callwrite" data-id="${c.id}"><span class="when"><b>${+c.date.slice(8)}</b><small>${dShort(c.date).replace(/^\d+\s*/, '')}</small></span><span class="what"><span class="ttl">${ic('phone', 13)} ${esc(c.title)}</span><span class="sub">${esc(c.type || '')}</span></span><span class="btn sm">${ic('pen', 13)}Écrire les notes</span></div>`).join('')}</section>` : '') +
    `<div class="toolbar"><div class="seg"><button class="${tab === 'up' ? 'on' : ''}" data-a="calltab" data-v="up">À venir · ${up.length}</button><button class="${tab === 'past' ? 'on' : ''}" data-a="calltab" data-v="past">Historique · ${past.length}</button></div>
      <div class="chips"><button class="chip ${!ui.callType ? 'on' : ''}" data-a="calltype" data-v="">Tous</button>${L.callTypes.map(x => `<button class="chip ${ui.callType === x.k ? 'on' : ''}" data-a="calltype" data-v="${esc(x.k)}">${dot(AOS.col(x.c))}${esc(x.k)}</button>`).join('')}</div></div>
    <section class="card box">${list.length ? Object.entries(byDay).map(([d, l]) => `<div class="box-sub">${d === t ? "Aujourd'hui" : AOS.cap(dLong(d))}</div>${l.map(c => AOS.callLine(c)).join('')}`).join('') :
      `<div class="box-empty"><p>${tab === 'up' ? 'Aucun call prévu. Planifie tes calls de recrutement, d\'onboarding ou tes points mensuels.' : 'Aucun call passé pour l\'instant.'}</p>${tab === 'up' ? AOS.newBtn('calls', 'Planifier un call', 1) : ''}</div>`}</section>
    <p class="faint hint">Les calls prévus apparaissent aussi dans le Planning, le dashboard et les notifications. Le bouton Brief ressort les notes du dernier call avec la même personne.</p>`;
  };
  Object.assign(AOS.act, {
    callbrief: el => AOS.openBrief(el.dataset.id),
    briefclose: () => document.querySelector('#layer [data-scrim="brief"]')?.remove(),
    briefopen: el => { AOS.act.briefclose(); AOS.openRecord('students', el.dataset.id); },
    briefedit: el => { AOS.act.briefclose(); AOS.openForm('calls', el.dataset.id); },
    briefdone: el => { AOS.act.briefclose(); AOS.act.calldone(el); },
    callwrite: el => AOS.openForm('calls', el.dataset.id, {}, { title: 'Notes du call' }),
    calltab: el => { ui.callTab = el.dataset.v; AOS.render(); },
    calltype: el => { ui.callType = el.dataset.v; AOS.render(); },
    calldone: async el => {
      const c = S.calls.find(x => x.id === el.dataset.id), L = AOS.lists(), done = (L.callStatus.find(x => x.kind === 'done') || {}).k; if (!c || !done) return;
      if (await AOS.save('calls', { ...c, status: done })) { toast('Call marqué comme fait : ajoute le compte-rendu'); AOS.openForm('calls', c.id, {}, { override: { status: done } }); }
    },
    callnext: async el => { const c = S.calls.find(x => x.id === el.dataset.id); if (c && await AOS.save('calls', { ...c, nextDone: true })) toast('Suite faite'); }
  });

  /* ================= Scripts ================= */
  const CUR = '$';   // OnlyFans prices are in dollars
  const total = s => (s.steps || []).filter(x => x.ppv).reduce((t, x) => t + (+x.price || 0), 0);
  const allText = s => (s.steps || []).map((x, i) => `${i + 1}. ${x.ppv ? `[PPV ${x.price || 0} ${CUR}${x.media ? ' · ' + x.media : ''}] ` : ''}${x.text || ''}`).join('\n\n');
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); toast(what + ' copié'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(what + ' copié'); } catch (_) { toast('Copie impossible ici : sélectionne le texte à la main.', 'bad'); } ta.remove(); }
  }
  AOS.views.scripts = function () {
    const L = AOS.lists();
    let ss = S.scripts;
    if (ui.scCat) ss = ss.filter(s => s.category === ui.scCat);
    if (ui.scCr) ss = ss.filter(s => s.creatorId === ui.scCr);
    if (ui.scFav) ss = ss.filter(s => s.fav);
    if (ui.scQ) { const q = ui.scQ.toLowerCase(); ss = ss.filter(s => [s.title, s.tags, ...(s.steps || []).map(x => x.text)].join(' ').toLowerCase().includes(q)); }
    ss = [...ss].sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
    const canC = AOS.allowed('scripts', 'c');
    return AOS.header({ eyebrow: 'Agence', title: `Scripts <span class="soft">· ${S.scripts.length}</span>`, actions: canC ? `<button class="btn pri" data-a="scnew">${ic('plus', 15)}Nouveau script</button>` : '' }) +
    `<div class="toolbar"><input class="input" id="scQ" placeholder="Rechercher un script, un mot…" value="${esc(ui.scQ || '')}">
      <select class="input" id="scCr" aria-label="Créatrice"><option value="">Toutes les créatrices</option>${sortBy(S.creators, c => c.name).map(c => `<option value="${c.id}" ${ui.scCr === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <button class="chip ${ui.scFav ? 'on' : ''}" data-a="scfavf">${ic('star', 13)} Favoris</button></div>
    <div class="chips"><button class="chip ${!ui.scCat ? 'on' : ''}" data-a="sccat" data-v="">Toutes</button>${L.scriptCats.map(x => `<button class="chip ${ui.scCat === x.k ? 'on' : ''}" data-a="sccat" data-v="${esc(x.k)}">${dot(AOS.col(x.c))}${esc(x.k)}</button>`).join('')}</div>
    ${ss.length ? `<div class="scripts">${ss.map(s => { const n = (s.steps || []).length, p = (s.steps || []).filter(x => x.ppv).length; return `<article class="script card" data-a="scopen" data-id="${s.id}" tabindex="0">
      <div class="g-top">${pill(s.category || 'Script', AOS.colorOf(L, 'scriptCats', s.category))}${s.creatorId ? `<span class="tag">${esc(AOS.nm('creators', s.creatorId))}</span>` : ''}${AOS.demoTag(s)}<button class="iconbtn fav ${s.fav ? 'on' : ''}" data-a="scfav" data-id="${s.id}" aria-label="Favori" style="margin-left:auto">${ic('star', 15)}</button></div>
      <h4>${esc(s.title)}</h4><p>${esc((s.steps || [])[0] ? s.steps[0].text : '')}</p>
      <div class="sc-meta"><span>${n} message${n > 1 ? 's' : ''}</span>${p ? `<span>${p} PPV · <b>${total(s)} ${CUR}</b></span>` : ''}<button class="btn sm" data-a="sccopyall" data-id="${s.id}">${ic('copy', 13)}Copier</button></div></article>`; }).join('')}</div>`
      : `<section class="card box"><div class="box-empty"><p>${S.scripts.length ? 'Aucun script ne correspond.' : 'Range ici tous tes scripts : PPV, bienvenue, relances, sexting… Chaque script est une suite de messages, avec les prix PPV.'}</p>${canC && !S.scripts.length ? `<button class="btn pri" data-a="scnew">${ic('plus', 15)}Créer mon premier script</button>` : ''}</div></section>`}`;
  };
  AOS.inputs.scQ = el => { ui.scQ = el.value; AOS.render(); };
  AOS.changes.scCr = el => { ui.scCr = el.value; AOS.render(); };

  /* editor: a script is an ordered list of steps (message or PPV) */
  let draft = null;
  function editor() {
    const L = AOS.lists(), canW = AOS.allowed('scripts', draft.id && S.scripts.some(s => s.id === draft.id) ? 'u' : 'c'), dis = canW ? '' : 'disabled';
    return `<div class="card-h"><h3>${draft.id ? 'Script' : 'Nouveau script'}</h3><button class="btn sm ghost" data-a="scclose" aria-label="Fermer">${ic('x')}</button></div>
    <div class="sc-ed">
      <div class="form2"><div class="fld full"><label for="sc-title">Titre</label><input id="sc-title" data-f="title" value="${esc(draft.title || '')}" placeholder="Ex. PPV douche – 3 paliers" ${dis}></div>
        <div class="fld"><label for="sc-cat">Catégorie</label><select id="sc-cat" data-f="category" ${dis}>${L.scriptCats.map(x => `<option ${x.k === draft.category ? 'selected' : ''}>${esc(x.k)}</option>`).join('')}</select></div>
        <div class="fld"><label for="sc-cr">Créatrice</label><select id="sc-cr" data-f="creatorId" ${dis}><option value="">Toutes</option>${sortBy(S.creators, c => c.name).map(c => `<option value="${c.id}" ${c.id === draft.creatorId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="fld full"><label for="sc-tags">Mots-clés</label><input id="sc-tags" data-f="tags" value="${esc(draft.tags || '')}" placeholder="soft, nouveau fan, week-end…" ${dis}></div></div>
      <div class="sc-steps">${(draft.steps || []).map((x, i) => `<div class="sc-step ${x.ppv ? 'ppv' : ''}">
        <div class="sc-n">${i + 1}</div>
        <div class="sc-body"><textarea data-step="${i}" data-sf="text" rows="3" placeholder="${x.ppv ? 'Message qui accompagne le PPV…' : 'Message…'}" ${dis}>${esc(x.text || '')}</textarea>
          <div class="sc-row"><label class="inline"><input type="checkbox" data-step="${i}" data-sf="ppv" ${x.ppv ? 'checked' : ''} ${dis}>PPV</label>
          ${x.ppv ? `<label class="inline">Prix <input class="input sm" type="number" min="0" step="1" data-step="${i}" data-sf="price" value="${esc(x.price ?? '')}" ${dis}> ${CUR}</label><input class="input grow" data-step="${i}" data-sf="media" value="${esc(x.media || '')}" placeholder="Média : 3 photos, vidéo 2 min…" ${dis}>` : '<span class="grow"></span>'}
          <button class="iconbtn" data-a="scstepcopy" data-i="${i}" title="Copier ce message">${ic('copy', 14)}</button>
          ${canW ? `<button class="iconbtn" data-a="scstepmove" data-i="${i}" title="Monter" ${i ? '' : 'disabled'}>↑</button><button class="iconbtn" data-a="scstepdel" data-i="${i}" title="Supprimer">${ic('trash', 14)}</button>` : ''}</div></div></div>`).join('')}</div>
      ${canW ? `<div class="actions"><button class="btn sm" data-a="scstepadd" data-ppv="">${ic('plus', 13)}Message</button><button class="btn sm" data-a="scstepadd" data-ppv="1">${ic('plus', 13)}PPV</button></div>` : ''}
      <div class="sc-total">${(draft.steps || []).filter(x => x.ppv).length} PPV · total <b>${total(draft)} ${CUR}</b></div>
      <div class="fld"><label for="sc-notes">Conseils d'utilisation</label><textarea id="sc-notes" data-f="notes" rows="2" placeholder="Quand l'utiliser, pour quel type de fan…" ${dis}>${esc(draft.notes || '')}</textarea></div>
    </div>
    <div class="form-foot pad">${draft.id && AOS.allowed('scripts', 'd') ? `<button class="btn danger" data-a="scdel">Supprimer</button>` : ''}
      <button class="btn ghost" data-a="sccopydraft">${ic('copy', 14)}Tout copier</button>
      ${draft.id && AOS.allowed('scripts', 'c') ? `<button class="btn" data-a="scdup">Dupliquer</button>` : ''}
      ${canW ? '<button class="btn pri" data-a="scsave">Enregistrer</button>' : ''}</div>`;
  }
  function openEditor(s) {
    draft = JSON.parse(JSON.stringify(s || { title: '', category: (AOS.lists().scriptCats[0] || {}).k, creatorId: ui.scCr || '', steps: [{ text: '' }, { text: '', ppv: true, price: 15 }] }));
    document.getElementById('layer').insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="script"><div class="modal wide" role="dialog" aria-modal="true" id="scModal">${editor()}</div></div>`);
    wire();
  }
  function rerender() { const m = document.getElementById('scModal'); if (!m) return; const sc = m.parentElement.scrollTop; m.innerHTML = editor(); wire(); m.parentElement.scrollTop = sc; }
  function wire() {
    const m = document.getElementById('scModal');
    m.querySelectorAll('[data-f]').forEach(el => el.oninput = el.onchange = () => { draft[el.dataset.f] = el.value; });
    m.querySelectorAll('[data-step]').forEach(el => {
      const i = +el.dataset.step, f = el.dataset.sf;
      if (f === 'ppv') el.onchange = () => { draft.steps[i].ppv = el.checked; if (el.checked && draft.steps[i].price == null) draft.steps[i].price = 15; rerender(); };
      else el.oninput = () => { draft.steps[i][f] = f === 'price' ? (el.value === '' ? '' : +el.value) : el.value; if (f === 'price') { const tEl = m.querySelector('.sc-total b'); if (tEl) tEl.textContent = total(draft) + ' ' + CUR; } };
    });
  }
  const closeEd = () => { document.querySelector('#layer [data-scrim="script"]')?.remove(); draft = null; };
  Object.assign(AOS.act, {
    scnew: () => openEditor(null),
    scopen: el => { const s = S.scripts.find(x => x.id === el.dataset.id); if (s) openEditor(s); },
    scclose: closeEd,
    sccat: el => { ui.scCat = el.dataset.v; AOS.render(); },
    scfavf: () => { ui.scFav = !ui.scFav; AOS.render(); },
    scfav: async el => { const s = S.scripts.find(x => x.id === el.dataset.id); if (s && AOS.allowed('scripts', 'u')) await AOS.save('scripts', { ...s, fav: !s.fav }); },
    sccopyall: el => { const s = S.scripts.find(x => x.id === el.dataset.id); if (s) copy(allText(s), 'Script'); },
    sccopydraft: () => copy(allText(draft), 'Script'),
    scstepcopy: el => copy(draft.steps[+el.dataset.i].text || '', 'Message'),
    scstepadd: el => { draft.steps = draft.steps || []; draft.steps.push(el.dataset.ppv ? { text: '', ppv: true, price: 15 } : { text: '' }); rerender(); },
    scstepdel: el => { draft.steps.splice(+el.dataset.i, 1); rerender(); },
    scstepmove: el => { const i = +el.dataset.i; [draft.steps[i - 1], draft.steps[i]] = [draft.steps[i], draft.steps[i - 1]]; rerender(); },
    scsave: async () => {
      if (!(draft.title || '').trim()) { toast('Donne un titre au script.'); document.getElementById('sc-title').focus(); return; }
      draft.steps = (draft.steps || []).filter(x => (x.text || '').trim() || x.ppv);
      if (await AOS.save('scripts', { ...draft, title: draft.title.trim() })) { closeEd(); toast('Script enregistré'); }
    },
    scdup: async () => { const { id, createdAt, updatedAt, demo, ...rest } = draft; if (await AOS.save('scripts', { ...rest, title: rest.title + ' (copie)', fav: false })) { closeEd(); toast('Script dupliqué'); } },
    scdel: async () => { if (!(await AOS.confirm({ title: 'Supprimer ce script ?', body: `« ${esc(draft.title)} » sera supprimé.`, ok: 'Supprimer', danger: 1 }))) return; if (await AOS.remove('scripts', draft.id)) { closeEd(); toast('Script supprimé'); } }
  });
})();
