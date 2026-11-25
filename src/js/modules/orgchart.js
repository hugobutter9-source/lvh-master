/* Agency OS — Organigramme as a free canvas: move cards, draw links, add free boxes, pan and zoom.
   Hierarchy links are the collaborators' "Responsable direct" (team.reportsTo); free links, boxes and positions
   live in settings/org, shared by the whole agency. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, av, dot } = AOS;
  const S = AOS.S, me = AOS.me, ui = AOS.ui;
  const COLORS = [['accent', 'Accent'], ['violet', 'Violet'], ['ok', 'Vert'], ['warn', 'Orange'], ['bad', 'Rouge'], ['info', 'Bleu'], ['pink', 'Rose'], ['faint', 'Gris']];
  const active = () => S.team.filter(m => !m.archived);
  const lay = () => S.orgLayout || {};
  /* settings/* is written by Éditeurs and the owner only (server rule), so the layout follows the same level */
  const canEdit = () => AOS.can(me.role, 'organigramme', 'u') && (me.local || me.isOwner || me.canEdit);
  const canBoss = () => AOS.allowed('team', 'u');
  /* cards can be moved and linked straight away; the lock button freezes the layout */
  const edOn = () => !ui.orgLock && canEdit();
  const cam = () => ui.orgCam || (ui.orgCam = { x: 40, y: 30, k: 1, fit: true });
  let geo = null;   // { G, P } of the last render, used by the pointer handlers

  async function saveLay(patch) {
    const next = { ...lay(), ...patch, updatedAt: Date.now() };
    S.orgLayout = next;   // optimistic: the card stays where it was dropped while the write travels
    return AOS.setDoc('settings/org', next);
  }

  function personCard(m, L, P) {
    const pr = AOS.presence(S, L, m, AOS.today()), n = AOS.openTasks().filter(t => t.assigneeId === m.id).length;
    const ac = pr.leave ? AOS.colorOf(L, 'leaveTypes', pr.leave.type) : AOS.colorOf(L, 'availability', m.avail);
    return `<div class="oc-n node" data-nid="${m.id}" data-open="team:${m.id}" tabindex="0" style="left:${P.x}px;top:${P.y}px">
      <div class="top">${av(m.name, '', ac)}<div class="grow"><div class="nm">${esc(m.name)}</div><div class="rl">${esc(m.role || '—')}</div></div></div>
      <div class="ft"><span class="tag">${esc(m.dept || '—')}</span><span style="color:${ac}">${esc(pr.effective || '')}</span></div>
      ${m.missions ? `<div class="ms">${esc(m.missions)}</div>` : ''}
      ${m.phone || n ? `<div class="ft"><span class="ph">${esc(m.phone || '')}</span>${n ? `<span class="faint">${n} tâche${n > 1 ? 's' : ''}</span>` : ''}</div>` : ''}
      ${edOn() ? '<span class="oc-h" data-h title="Tirer vers une autre carte pour relier"></span>' : ''}</div>`;
  }
  function boxCard(b, P) {
    return `<div class="oc-n oc-box" data-nid="${b.id}" ${canEdit() ? `data-a="ocbox" data-id="${b.id}"` : ''} tabindex="0" style="left:${P.x}px;top:${P.y}px;--c:${AOS.col(b.color || 'accent')}">
      <div class="nm">${esc(b.title)}</div>${b.sub ? `<div class="rl">${esc(b.sub)}</div>` : ''}
      ${edOn() ? '<span class="oc-h" data-h title="Tirer vers une autre carte pour relier"></span>' : ''}</div>`;
  }

  AOS.orgCanvas = function () {
    const L = AOS.lists(), team = active(), boxes = lay().boxes || [];
    const G = AOS.orgGraph(team, lay()), P = AOS.orgPositions(G, lay().pos);
    geo = { G, P };
    const c = cam(), ed = edOn(), sel = ui.orgSel && [...G.hier, ...G.free].find(l => l.id === ui.orgSel);
    const name = id => AOS.nm('team', id) || (boxes.find(b => b.id === id) || {}).title || '?';
    const tools = `<div class="oc-bar">
      ${canEdit() ? `<button class="btn sm" data-a="ocedit" title="${ed ? 'Figer la disposition' : 'Pouvoir déplacer et relier les cartes'}">${ic(ed ? 'lock' : 'pen', 14)}${ed ? 'Verrouiller' : 'Déverrouiller'}</button>` : ''}
      ${ed ? `<button class="btn sm" data-a="ocbox">${ic('plus', 14)}Case libre</button>
        <div class="seg sm" role="group" aria-label="Type de lien">${[['hier', 'Lien hiérarchique'], ['free', 'Lien libre']].map(([k, l]) => `<button class="${(ui.orgLink || 'hier') === k ? 'on' : ''}" data-a="oclink" data-v="${k}" ${k === 'hier' && !canBoss() ? 'disabled title="Ton rôle ne permet pas de modifier les responsables"' : ''}>${l}</button>`).join('')}</div>
        <button class="btn sm ghost" data-a="ocauto">${ic('layers', 14)}Disposition auto</button>` : ''}
      <span class="oc-zoom"><button class="iconbtn" data-a="oczoom" data-v="-1" aria-label="Dézoomer">−</button><b id="ocPct">${Math.round(c.k * 100)} %</b><button class="iconbtn" data-a="oczoom" data-v="1" aria-label="Zoomer">+</button><button class="btn sm ghost" data-a="ocfit">Ajuster</button></span></div>`;
    const selBar = ed && sel ? `<div class="oc-sel">${sel.kind === 'hier' ? `<span><b>${esc(name(sel.a))}</b> est responsable de <b>${esc(name(sel.b))}</b></span>` : `<span>Lien libre : <b>${esc(name(sel.a))}</b> — <b>${esc(name(sel.b))}</b></span>
        <button class="btn sm" data-a="ocstyle">${sel.style === 'dashed' ? 'Trait plein' : 'Pointillés'}</button>`}
        <button class="btn sm danger" data-a="ocunlink">${ic('trash', 14)}Supprimer le lien</button><button class="iconbtn" data-a="ocdesel" aria-label="Fermer">${ic('x', 14)}</button></div>` : '';
    return `<div class="card org oc ${ed ? 'editing' : ''}">${tools}${selBar}
      <div class="oc-vp" id="ocVp"><div class="oc-world" id="ocWorld" style="transform:translate(${c.x}px,${c.y}px) scale(${c.k})">
        <svg class="oc-links" id="ocLinks" aria-hidden="true"></svg>
        ${team.map(m => personCard(m, L, P[m.id])).join('')}${boxes.map(b => boxCard(b, P[b.id])).join('')}
      </div></div>
      ${ed ? `<p class="oc-help">Glisse une carte pour la déplacer · tire le <span class="oc-h demo"></span> vers une autre carte pour les relier · clique sur un lien pour le supprimer · un clic sur une personne ouvre sa fiche.</p>` : ''}</div>`;
  };

  /* ---------- links: drawn after render, from the cards' real sizes ---------- */
  function box(id) { const el = document.querySelector(`.oc-n[data-nid="${id}"]`); return el && { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }
  /* bottom → top when b is below a, top → bottom when above, side to side when they share a row */
  function curve(a, b) {
    if (b.y >= a.y + a.h - 10 || b.y + b.h <= a.y + 10) {
      const down = b.y >= a.y + a.h - 10, x1 = a.x + a.w / 2, y1 = down ? a.y + a.h : a.y, x2 = b.x + b.w / 2, y2 = down ? b.y : b.y + b.h;
      const dy = Math.max(40, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
      return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
    }
    const right = b.x + b.w / 2 >= a.x + a.w / 2, x1 = right ? a.x + a.w : a.x, y1 = a.y + a.h / 2, x2 = right ? b.x : b.x + b.w, y2 = b.y + b.h / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2) * (right ? 1 : -1);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  }
  function drawLinks(extra) {
    const svg = document.getElementById('ocLinks'); if (!svg || !geo) return;
    const all = [...geo.G.hier, ...geo.G.free];
    /* the svg is a large sheet offset by 5000px so clicks on links far from the origin still land on it */
    svg.innerHTML = '<g transform="translate(5000,5000)">' + all.map(l => { const a = box(l.a), b = box(l.b); if (!a || !b) return '';
      const d = curve(a, b), cls = `oc-l ${l.kind} ${l.style === 'dashed' || (l.kind === 'free' && !l.style) ? 'dashed' : ''} ${ui.orgSel === l.id ? 'sel' : ''}`;
      return `<path d="${d}" class="${cls}"/>${edOn() ? `<path d="${d}" class="oc-hit" data-link="${l.id}"/>` : ''}`; }).join('') + (extra || '') + '</g>';
  }

  /* ---------- camera ---------- */
  function applyCam() {
    const c = cam(), w = document.getElementById('ocWorld'); if (w) w.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.k})`;
    const p = document.getElementById('ocPct'); if (p) p.textContent = Math.round(c.k * 100) + ' %';
  }
  function zoomAt(k, px, py) {
    const c = cam(), nk = Math.min(2, Math.max(.25, k));
    c.x = px - (px - c.x) * nk / c.k; c.y = py - (py - c.y) * nk / c.k; c.k = nk; c.fit = false; applyCam();
  }
  function fit() {
    const vp = document.getElementById('ocVp'), els = [...document.querySelectorAll('.oc-n')]; if (!vp || !els.length) return;
    const xs = els.map(e => e.offsetLeft), ys = els.map(e => e.offsetTop), x2 = Math.max(...els.map(e => e.offsetLeft + e.offsetWidth)), y2 = Math.max(...els.map(e => e.offsetTop + e.offsetHeight));
    const x1 = Math.min(...xs), y1 = Math.min(...ys), pad = 40, c = cam();
    c.k = Math.min(1.1, Math.max(.25, Math.min((vp.clientWidth - pad * 2) / (x2 - x1 || 1), (vp.clientHeight - pad * 2) / (y2 - y1 || 1))));
    c.x = (vp.clientWidth - (x2 - x1) * c.k) / 2 - x1 * c.k; c.y = pad - y1 * c.k; c.fit = false; applyCam();
  }

  /* ---------- pointer: pan the background, move cards, draw links ---------- */
  let drag = null, justDragged = false;   // the click fired by the same gesture as a drag is ignored
  function world(e) { const vp = document.getElementById('ocVp').getBoundingClientRect(), c = cam(); return { x: (e.clientX - vp.left - c.x) / c.k, y: (e.clientY - vp.top - c.y) / c.k }; }
  function wire() {
    const vp = document.getElementById('ocVp'); if (!vp) return;
    vp.addEventListener('pointerdown', e => {
      justDragged = false;   // a new gesture starts
      if (e.button !== 0) return;
      const h = e.target.closest('[data-h]'), n = e.target.closest('.oc-n'), hit = e.target.closest('[data-link]');
      if (hit) return;
      if (h && edOn()) { const id = h.closest('.oc-n').dataset.nid; drag = { kind: 'link', id }; e.preventDefault(); }
      else if (n && edOn()) { const p = world(e); drag = { kind: 'move', id: n.dataset.nid, el: n, dx: p.x - n.offsetLeft, dy: p.y - n.offsetTop, moved: false, sx: e.clientX, sy: e.clientY }; }
      else if (!n) { const c = cam(); drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, x: c.x, y: c.y, moved: false }; }
      else return;
      vp.setPointerCapture(e.pointerId);
    });
    vp.addEventListener('pointermove', e => {
      if (!drag) return;
      if (drag.kind === 'pan') { const c = cam(); c.x = drag.x + e.clientX - drag.sx; c.y = drag.y + e.clientY - drag.sy; c.fit = false; drag.moved = drag.moved || Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3; applyCam(); }
      else if (drag.kind === 'move') {
        if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
        drag.moved = true; drag.el.classList.add('dragging');
        const p = world(e), snap = v => Math.round(v / 10) * 10;
        drag.el.style.left = snap(p.x - drag.dx) + 'px'; drag.el.style.top = snap(p.y - drag.dy) + 'px'; drawLinks();
      } else if (drag.kind === 'link') {
        const a = box(drag.id), p = world(e);
        document.querySelectorAll('.oc-n.target').forEach(x => x.classList.remove('target'));
        const t = document.elementFromPoint(e.clientX, e.clientY), tn = t && t.closest('.oc-n');
        if (tn && tn.dataset.nid !== drag.id) tn.classList.add('target');
        drawLinks(`<path class="oc-l drawing" d="${curve(a, { x: p.x, y: p.y, w: 0, h: 0 })}"/>`);
      }
    });
    const end = async e => {
      if (!drag) return; const d = drag; drag = null;
      if (d.moved || d.kind === 'link') justDragged = true;
      /* the pointer is captured while a card is held, so a plain click is handled here: it opens the fiche (or the box editor) */
      if (d.kind === 'move' && !d.moved) { justDragged = true; if (d.el.dataset.a === 'ocbox') AOS.act.ocbox(d.el); else AOS.openRecord('team', d.id); return; }
      if (d.kind === 'move' && d.moved) {
        d.el.classList.remove('dragging');
        const P = Object.fromEntries(Object.entries(geo.P).map(([k, v]) => [k, { x: v.x, y: v.y }]));
        document.querySelectorAll('.oc-n').forEach(el => { P[el.dataset.nid] = { x: el.offsetLeft, y: el.offsetTop }; });
        await saveLay({ pos: P });
      } else if (d.kind === 'link') {
        document.querySelectorAll('.oc-n.target').forEach(x => x.classList.remove('target'));
        const t = document.elementFromPoint(e.clientX, e.clientY), tn = t && t.closest('.oc-n');
        if (tn && tn.dataset.nid !== d.id) await connect(d.id, tn.dataset.nid); else drawLinks();
      }
    };
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', () => { drag = null; drawLinks(); });
    /* a drag must not also open the card under the pointer */
    vp.addEventListener('click', e => { if (justDragged) { e.stopPropagation(); e.preventDefault(); return; }
      const hit = e.target.closest('[data-link]'); if (hit) { e.stopPropagation(); ui.orgSel = hit.dataset.link; AOS.render(); } }, true);
    vp.addEventListener('wheel', e => {
      e.preventDefault(); const r = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(cam().k * Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top);
      else { const c = cam(); c.x -= e.deltaX; c.y -= e.deltaY; c.fit = false; applyCam(); }
    }, { passive: false });
  }

  /* ---------- editing ---------- */
  const isPerson = id => S.team.some(m => m.id === id);
  async function connect(a, b) {
    const L = lay(), mode = ui.orgLink || 'hier';
    if (mode === 'hier' && isPerson(a) && isPerson(b) && canBoss()) {
      if (AOS.orgCycle(S.team, a, b)) { AOS.toast(`${AOS.nm('team', b)} est déjà au-dessus de ${AOS.nm('team', a)} : boucle impossible.`, 'bad'); drawLinks(); return; }
      const m = S.team.find(x => x.id === b);
      if (m.reportsTo === a) { drawLinks(); return; }
      if (await AOS.save('team', { ...m, reportsTo: a })) AOS.toast(`${m.name} est maintenant rattaché(e) à ${AOS.nm('team', a)}`);
      return;
    }
    const links = L.links || [];
    if (links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a))) { drawLinks(); return; }
    await saveLay({ links: [...links, { id: 'l' + AOS.uid().slice(0, 10), a, b, style: isPerson(a) && isPerson(b) ? 'dashed' : 'solid' }] });
    AOS.render();
  }
  AOS.act.ocedit = () => { ui.orgLock = edOn(); ui.orgSel = null; AOS.render(); };
  AOS.act.oclink = el => { ui.orgLink = el.dataset.v; AOS.render(); };
  AOS.act.ocdesel = () => { ui.orgSel = null; AOS.render(); };
  AOS.act.oczoom = el => { const vp = document.getElementById('ocVp'); zoomAt(cam().k * (el.dataset.v === '1' ? 1.2 : 1 / 1.2), vp.clientWidth / 2, vp.clientHeight / 2); };
  AOS.act.ocfit = () => { cam().fit = true; fit(); };
  AOS.act.ocauto = async () => {
    if (!(await AOS.confirm({ title: 'Disposition automatique', body: 'Toutes les cartes reprennent une place calculée depuis les liens hiérarchiques. Tes positions manuelles seront perdues (les liens et les cases sont conservés).', ok: 'Réorganiser' }))) return;
    await saveLay({ pos: {} }); cam().fit = true; AOS.render();
  };
  AOS.act.ocstyle = async () => {
    const links = (lay().links || []).map(l => l.id === ui.orgSel ? { ...l, style: l.style === 'dashed' ? 'solid' : 'dashed' } : l);
    await saveLay({ links }); AOS.render();
  };
  AOS.act.ocunlink = async () => {
    const id = ui.orgSel; if (!id) return;
    if (id.startsWith('h:')) {
      const m = S.team.find(x => x.id === id.slice(2)); if (!m) return;
      if (!canBoss()) { AOS.toast('Ton rôle ne permet pas de modifier les responsables.', 'bad'); return; }
      if (!(await AOS.confirm({ title: 'Retirer le responsable ?', body: `${esc(m.name)} n'aura plus de responsable direct (${esc(AOS.nm('team', m.reportsTo))}).`, ok: 'Retirer' }))) return;
      ui.orgSel = null; await AOS.save('team', { ...m, reportsTo: '' });
    } else { ui.orgSel = null; await saveLay({ links: (lay().links || []).filter(l => l.id !== id) }); AOS.render(); }
  };
  /* free box: create or edit (title, subtitle, colour), or delete */
  AOS.act.ocbox = el => {
    if (!canEdit()) return;
    const id = el && el.dataset.id, b = id ? (lay().boxes || []).find(x => x.id === id) : null;
    const layer = document.getElementById('layer');
    layer.insertAdjacentHTML('beforeend', `<div class="scrim"><div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="ocb-t">
      <div class="card-h"><h3 id="ocb-t">${b ? 'Case libre' : 'Nouvelle case libre'}</h3></div>
      <form class="ask" id="ocbf"><div class="fld full"><label for="ocb-title">Titre *</label><input id="ocb-title" required value="${esc(b ? b.title : '')}" placeholder="Ex. Pôle Chatting, Poste à pourvoir, Freelances" autocomplete="off"></div>
      <div class="fld full"><label for="ocb-sub">Sous-titre</label><input id="ocb-sub" value="${esc(b ? b.sub || '' : '')}" placeholder="Ex. 3 chatters de nuit" autocomplete="off"></div>
      <div class="fld full"><label>Couleur</label><div class="oc-colors">${COLORS.map(([k, l]) => `<label title="${l}"><input type="radio" name="c" value="${k}" ${(b ? b.color || 'accent' : 'accent') === k ? 'checked' : ''}><i style="background:${AOS.col(k)}"></i></label>`).join('')}</div></div>
      <div class="form-foot">${b ? `<button type="button" class="btn danger" id="ocb-del">${ic('trash', 14)}Supprimer</button>` : ''}<span style="flex:1"></span><button type="button" class="btn ghost" id="ocb-no">Annuler</button><button class="btn pri">${b ? 'Enregistrer' : 'Ajouter'}</button></div></form></div></div>`);
    const sc = layer.lastElementChild, f = sc.querySelector('#ocbf'), close = () => sc.remove();
    sc.querySelector('#ocb-no').onclick = close; sc.addEventListener('click', e => { if (e.target === sc) close(); });
    sc.querySelector('#ocb-title').focus();
    if (b) sc.querySelector('#ocb-del').onclick = async () => {
      close(); if (!(await AOS.confirm({ title: 'Supprimer cette case ?', body: `« ${esc(b.title)} » et ses liens libres seront retirés de l'organigramme. Les collaborateurs ne sont pas touchés.`, ok: 'Supprimer', danger: 1 }))) return;
      const L = lay(), pos = { ...(L.pos || {}) }; delete pos[b.id];
      await saveLay({ boxes: (L.boxes || []).filter(x => x.id !== b.id), links: (L.links || []).filter(l => l.a !== b.id && l.b !== b.id), pos }); AOS.render();
    };
    f.onsubmit = async e => {
      e.preventDefault(); const title = f.querySelector('#ocb-title').value.trim(); if (!title) return;
      const data = { title, sub: f.querySelector('#ocb-sub').value.trim(), color: (f.querySelector('input[name=c]:checked') || {}).value || 'accent' };
      const L = lay(), boxes = L.boxes || [];
      if (b) await saveLay({ boxes: boxes.map(x => x.id === b.id ? { ...x, ...data } : x) });
      else {
        /* drop the new box in the middle of what is on screen */
        const vp = document.getElementById('ocVp'), c = cam(), nid = 'box_' + AOS.uid().slice(0, 10);
        const x = vp ? Math.round(((vp.clientWidth / 2 - c.x) / c.k - 115) / 10) * 10 : 0, y = vp ? Math.round(((vp.clientHeight / 2 - c.y) / c.k - 40) / 10) * 10 : 0;
        const pos = { ...(geo ? geo.P : {}), ...(L.pos || {}) };
        let px = x; while (Object.values(pos).some(p => Math.abs(p.x - px) < AOS.ORG.W + 10 && Math.abs(p.y - y) < 110)) px += AOS.ORG.GX;
        pos[nid] = { x: px, y };
        await saveLay({ boxes: [...boxes, { id: nid, ...data }], pos });
      }
      close(); AOS.render();
    };
  };
  document.addEventListener('keydown', e => {
    if (!edOn() || !ui.orgSel || !document.getElementById('ocVp') || e.target.closest('input,textarea,select')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); AOS.act.ocunlink(); }
    if (e.key === 'Escape') { ui.orgSel = null; AOS.render(); }
  });

  AOS.afterRender.organigramme = () => {
    if (!document.getElementById('ocVp')) return;
    drawLinks(); wire();
    if (cam().fit) fit();
  };
})();
