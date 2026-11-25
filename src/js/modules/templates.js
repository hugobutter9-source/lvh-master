/* Checklists: a model is an ordered list of tasks with a delay in days. One click creates every task,
   dated from a start day, optionally linked to a créatrice and assigned to someone.
   Models are stored with the agency settings; the built-in ones are the starting point. */
(function () {
  const AOS = window.AOS;
  const { esc, ic, today, addDays, dShort, sortBy, toast } = AOS;
  const S = AOS.S;

  const BUILTIN = [
    { id: 'onb-creatrice', title: 'Onboarding créatrice', steps: [['Signer le contrat', 0], ['Récupérer les accès et vérifier les comptes', 1], ['Compléter sa fiche et créer son dossier', 1], ['Lui ouvrir son accès au Creator Portal', 1], ['Premier lot de contenu (shooting)', 3], ['Écrire les scripts de bienvenue et de PPV', 4], ['Assigner les chatters et le planning', 5], ['Point de lancement', 7], ['Bilan du premier mois', 30]] },
    { id: 'cloture-mois', title: 'Clôture du mois', steps: [['Saisir les revenus de chaque créatrice', 0], ['Vérifier les dépenses et les abonnements', 0], ['Calculer et payer l\'équipe', 2], ['Envoyer le récap du mois à chaque créatrice', 3], ['Fixer les objectifs du mois suivant', 3]] },
    { id: 'accompagnement', title: 'Nouvel accompagnement', steps: [['Encaisser le premier paiement', 0], ['Envoyer les accès et le programme', 0], ['Planifier le call de démarrage', 1], ['Point à mi-parcours', 30], ['Bilan de fin et témoignage', 60]] },
    { id: 'arrivee-collab', title: "Arrivée d'un collaborateur", steps: [['Créer sa fiche et le placer dans l\'organigramme', 0], ['Donner les accès (outils, Drive, portal)', 0], ['Expliquer les process et les scripts', 1], ['Point après la première semaine', 7]] },
    { id: 'revue-semaine', title: 'Revue de la semaine', steps: [['Relire les objectifs en cours', 0], ['Faire le point CA par créatrice', 0], ['Valider les contenus de la semaine dans le portal', 0], ['Planifier les calls de la semaine', 0]] }
  ];
  const all = () => Array.isArray(S.settings.taskTemplates) ? S.settings.taskTemplates : BUILTIN;
  AOS.taskTemplates = all;
  const canRun = () => AOS.modOn('taches') && AOS.allowed('tasks', 'c');
  const canSet = () => AOS.can(AOS.me.role, 'parametres', 'u');
  const toText = steps => steps.map(([t, d]) => `${t}${d ? ' +' + d : ''}`).join('\n');
  const parse = text => String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)(?:\s*\+\s*(\d{1,3}))?$/); return [m[1].trim(), +(m[2] || 0)]; }).filter(x => x[0]);

  let st = null;   // { mode: 'list' | 'run' | 'edit', id }
  const close = () => { document.querySelector('#layer [data-scrim="tpl"]')?.remove(); st = null; };
  const opt = (rows, sel) => `<option value="">—</option>${sortBy(rows, x => x.name).map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`;
  function body() {
    const t = all().find(x => x.id === st.id);
    if (st.mode === 'run' && t) {
      const start = st.start || today();
      return `<div class="card-h"><h3>${esc(t.title)}</h3><button class="btn sm ghost" data-a="tplclose" aria-label="Fermer">${ic('x')}</button></div>
        <form id="tplRun"><div class="fld"><label for="tpl-start">À partir du</label><input id="tpl-start" name="start" type="date" value="${start}"></div>
          <div class="fld"><label for="tpl-who">Assigner à</label><select id="tpl-who" name="who">${opt(S.team.filter(m => !m.archived), st.who || (AOS.me.role && AOS.me.role.memberId) || '')}</select></div>
          <div class="fld"><label for="tpl-cr">Créatrice liée</label><select id="tpl-cr" name="cr">${opt(S.creators, st.cr || '')}</select></div>
          <div class="fld"><label for="tpl-lbl">Précision (facultatif)</label><input id="tpl-lbl" name="lbl" value="${esc(st.lbl || '')}" placeholder="Ex. le prénom, le mois"></div>
          <div class="full tpl-prev">${t.steps.map(([x, d]) => `<div class="row-between"><span>${esc(x)}</span><span class="mono faint">${dShort(addDays(start, d))}</span></div>`).join('')}</div>
          <div class="form-foot"><button type="button" class="btn ghost" data-a="tplback">Retour</button><button class="btn pri">Créer ${t.steps.length} tâche${t.steps.length > 1 ? 's' : ''}</button></div></form>`;
    }
    if (st.mode === 'edit') {
      return `<div class="card-h"><h3>${t ? 'Modifier le modèle' : 'Nouveau modèle'}</h3><button class="btn sm ghost" data-a="tplclose" aria-label="Fermer">${ic('x')}</button></div>
        <form id="tplEdit"><div class="fld full"><label for="tpl-title">Nom</label><input id="tpl-title" name="title" value="${esc(t ? t.title : '')}" placeholder="Ex. Lancement d'un PPV" required></div>
          <div class="fld full"><label for="tpl-steps">Une tâche par ligne. Ajoute « +3 » à la fin pour une échéance 3 jours après le départ.</label><textarea id="tpl-steps" name="steps" class="tall" placeholder="Préparer le média\nÉcrire le script +1\nEnvoyer le PPV +2">${esc(t ? toText(t.steps) : '')}</textarea></div>
          <div class="form-foot">${t ? '<button type="button" class="btn danger" data-a="tpldel">Supprimer</button>' : ''}<button type="button" class="btn ghost" data-a="tplback">Retour</button><button class="btn pri">Enregistrer</button></div></form>`;
    }
    return `<div class="card-h"><h3>Checklists</h3><button class="btn sm ghost" data-a="tplclose" aria-label="Fermer">${ic('x')}</button></div>
      <div class="quick">${all().map(x => `<div class="li click" data-a="tplrun" data-id="${esc(x.id)}" tabindex="0">${ic('task', 17)}<div class="grow"><div class="title">${esc(x.title)}</div><div class="sub">${x.steps.length} tâche${x.steps.length > 1 ? 's' : ''} · ${esc(x.steps.slice(0, 2).map(s => s[0]).join(', '))}…</div></div>
        ${canSet() ? `<button class="iconbtn" data-a="tpledit" data-id="${esc(x.id)}" aria-label="Modifier le modèle">${ic('pen', 14)}</button>` : ''}${ic('chev', 14)}</div>`).join('') || '<p class="pad-x muted">Aucun modèle.</p>'}</div>
      ${canSet() ? `<div class="form-foot pad"><button class="btn" data-a="tpledit" data-id="">${ic('plus', 14)}Nouveau modèle</button></div>` : ''}`;
  }
  function draw() { const m = document.getElementById('tplModal'); if (m) m.innerHTML = body(); }
  AOS.openTemplates = function () {
    if (!canRun()) { toast("Ton rôle ne permet pas de créer des tâches.", 'bad'); return; }
    st = { mode: 'list' };
    document.getElementById('layer').insertAdjacentHTML('beforeend', `<div class="scrim" data-scrim="tpl"><div class="modal" role="dialog" aria-modal="true" id="tplModal">${body()}</div></div>`);
  };
  const saveAll = list => AOS.setDoc('settings/agency', { ...S.settings, taskTemplates: list }, 'settings');
  Object.assign(AOS.act, {
    tplopen: () => AOS.openTemplates(),
    tplclose: close,
    tplback: () => { st = { mode: 'list' }; draw(); },
    tplrun: el => { st = { mode: 'run', id: el.dataset.id }; draw(); },
    tpledit: el => { st = { mode: 'edit', id: el.dataset.id }; draw(); },
    tpldel: async () => {
      const t = all().find(x => x.id === st.id); if (!t) return;
      if (!(await AOS.confirm({ title: 'Supprimer ce modèle ?', body: `« ${esc(t.title)} » sera supprimé. Les tâches déjà créées restent.`, ok: 'Supprimer', danger: 1 }))) return;
      if (await saveAll(all().filter(x => x.id !== t.id))) { st = { mode: 'list' }; draw(); toast('Modèle supprimé'); }
    }
  });
  document.addEventListener('change', e => { if (st && st.mode === 'run' && e.target.closest('#tplRun')) { const f = e.target.form; Object.assign(st, { start: f.start.value || today(), who: f.who.value, cr: f.cr.value, lbl: f.lbl.value }); if (e.target.name === 'start') draw(); } });
  document.addEventListener('submit', async e => {
    const f = e.target;
    if (f.id === 'tplRun') {
      e.preventDefault(); const t = all().find(x => x.id === st.id); if (!t) return;
      const L = AOS.lists(), open = (L.taskStatus.find(x => x.kind === 'open') || {}).k, normal = (L.priorities.find(p => p.kind === 'normal') || {}).k;
      const start = f.start.value || today(), lbl = f.lbl.value.trim(), btn = f.querySelector('.btn.pri'); btn.disabled = true;
      let n = 0;
      for (const [title, d] of t.steps) if (await AOS.save('tasks', { title: lbl ? `${title} · ${lbl}` : title, status: open, priority: normal, due: addDays(start, d), assigneeId: f.who.value, creatorId: f.cr.value, fromTemplate: t.id }, { silentAudit: true })) n++;
      AOS.audit({ act: 'create', col: 'tasks', label: `Checklist « ${t.title} » : ${n} tâches` });
      close(); toast(`${n} tâche${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''} : ${t.title}`);
    } else if (f.id === 'tplEdit') {
      e.preventDefault(); const title = f.title.value.trim(), steps = parse(f.steps.value);
      if (!title) { toast('Donne un nom au modèle.'); f.title.focus(); return; }
      if (!steps.length) { toast('Ajoute au moins une tâche.'); f.steps.focus(); return; }
      const list = all().map(x => ({ ...x })), i = list.findIndex(x => x.id === st.id);
      if (i >= 0) list[i] = { ...list[i], title, steps }; else list.push({ id: 't' + AOS.uid().slice(0, 8), title, steps });
      if (await saveAll(list)) { st = { mode: 'list' }; draw(); toast('Modèle enregistré'); }
    }
  });
})();
