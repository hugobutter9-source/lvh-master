/* Agency OS — static configuration: default lists, navigation map, entity schemas, built-in roles. */
(function (g) {
  const AOS = g.AOS = g.AOS || {};

  /* Colour keys map to CSS tokens (var(--key)). */
  AOS.COLORS = ['accent', 'ok', 'warn', 'bad', 'info', 'violet', 'pink', 'muted', 'faint'];

  /* Every list is editable in Paramètres > Personnalisation.
     Coloured lists hold {k, c, kind}; `kind` carries the meaning the app computes with. */
  AOS.DEFAULT_LISTS = {
    postes: ['CEO / Fondateur', 'Directeur des opérations', 'Manager', 'Responsable du recrutement', 'Recruteur', 'Closer', 'Responsable marketing', 'Social Media Manager', 'Monteur vidéo', 'Content Manager', 'Responsable chatting', 'Chatter', 'Assistant virtuel', 'Responsable financier', 'Administrateur'],
    departments: ['Direction', 'Management', 'Chatting', 'Marketing', 'Production', 'Recrutement', 'Admin & Finance'],
    availability: [
      { k: 'Disponible', c: 'ok', kind: 'available' }, { k: 'Occupé', c: 'warn', kind: 'busy' }, { k: 'En réunion', c: 'info', kind: 'busy' },
      { k: 'Absent', c: 'bad', kind: 'away' }, { k: 'En congé', c: 'violet', kind: 'away' }, { k: 'Hors horaires', c: 'muted', kind: 'off' }, { k: 'Inactif', c: 'faint', kind: 'off' }],
    stages: [
      { k: 'Prospect', c: 'faint', kind: 'recruiting' }, { k: 'Call prévu', c: 'info', kind: 'recruiting' }, { k: 'Contrat envoyé', c: 'warn', kind: 'recruiting' },
      { k: 'Onboarding', c: 'violet', kind: 'recruiting' }, { k: 'Active', c: 'ok', kind: 'active' }, { k: 'En pause', c: 'muted', kind: 'inactive' }, { k: 'Partie', c: 'bad', kind: 'inactive' }],
    taskStatus: [{ k: 'À faire', c: 'faint', kind: 'open' }, { k: 'En cours', c: 'info', kind: 'open' }, { k: 'Fait', c: 'ok', kind: 'done' }],
    priorities: [{ k: 'Haute', c: 'bad', kind: 'high' }, { k: 'Normale', c: 'info', kind: 'normal' }, { k: 'Basse', c: 'faint', kind: 'low' }],
    eventTypes: [{ k: 'Call', c: 'info' }, { k: 'Shooting', c: 'pink' }, { k: 'Réunion', c: 'violet' }, { k: 'Onboarding', c: 'ok' }, { k: 'Deadline', c: 'bad' }, { k: 'Autre', c: 'faint' }],
    revenueCats: ['Abonnements', 'PPV / Messages', 'Tips', 'Autre revenu'],
    expenseCats: ['Salaires équipe', 'Commissions chatteurs', 'Publicité / Traffic', 'Outils & logiciels', 'Shooting / Matériel', 'Autre dépense'],
    noteTags: ['Procédure (SOP)', 'Idée', 'Script', 'Compte-rendu', 'Stratégie', 'Perso'],
    scriptCats: [{ k: 'PPV', c: 'pink' }, { k: 'Bienvenue', c: 'accent' }, { k: 'Relance', c: 'warn' }, { k: 'Sexting', c: 'violet' }, { k: 'Custom', c: 'info' }, { k: 'Upsell', c: 'ok' }],
    callTypes: [{ k: 'Recrutement créatrice', c: 'pink' }, { k: 'Onboarding', c: 'ok' }, { k: 'Point mensuel', c: 'info' }, { k: 'Candidat interne', c: 'violet' }, { k: 'Autre', c: 'faint' }],
    callStatus: [{ k: 'Prévu', c: 'info', kind: 'planned' }, { k: 'Fait', c: 'ok', kind: 'done' }, { k: 'Annulé', c: 'faint', kind: 'cancelled' }, { k: 'Pas venu', c: 'bad', kind: 'noshow' }],
    leaveTypes: [{ k: 'Congés', c: 'violet' }, { k: 'Maladie', c: 'bad' }, { k: 'Absence', c: 'warn' }, { k: 'Formation', c: 'info' }],
    paymentMethods: ['Carte bancaire', 'Virement', 'Prélèvement', 'PayPal', 'Crypto', 'Espèces'],
    programs: [{ k: 'Formation OFM', c: 'accent' }, { k: 'Coaching 1:1', c: 'violet' }, { k: 'Mastermind', c: 'pink' }],
    studentStages: [{ k: 'Inscrit', c: 'info', kind: 'lead' }, { k: 'En cours', c: 'ok', kind: 'active' }, { k: 'En pause', c: 'warn', kind: 'paused' }, { k: 'Terminé', c: 'faint', kind: 'done' }],
    studentNoteTags: [{ k: 'Note', c: 'faint' }, { k: 'Call', c: 'pink' }, { k: 'Progrès', c: 'ok' }, { k: 'Blocage', c: 'bad' }, { k: 'À faire', c: 'warn' }]
  };

  /* Where each list's values are used, so renames propagate and deletions are checked. */
  AOS.LIST_META = {
    postes: { label: 'Postes', hint: "Intitulés de poste de l'organigramme. Distincts des rôles de sécurité.", uses: [['team', 'role']] },
    departments: { label: 'Départements', hint: 'Pôles affichés sur les cartes de l\'organigramme.', uses: [['team', 'dept'], ['depts', 'name'], ['goals', 'dept']] },
    availability: { label: 'Statuts de disponibilité', hint: 'Statut déclaré par le collaborateur ou son responsable.', colored: 1, kinds: { available: 'Compte comme disponible', busy: 'Occupé', away: 'Absent / congé', off: 'Hors service' }, uses: [['team', 'avail']] },
    stages: { label: 'Statuts des créatrices', hint: 'Colonnes du pipeline, dans cet ordre.', colored: 1, kinds: { recruiting: 'En recrutement', active: 'Active', inactive: 'Inactive' }, uses: [['creators', 'stage']] },
    taskStatus: { label: 'Statuts de tâche', colored: 1, kinds: { open: 'Ouverte', done: 'Terminée' }, uses: [['tasks', 'status']] },
    priorities: { label: 'Priorités', colored: 1, kinds: { high: 'Haute (urgente)', normal: 'Normale', low: 'Basse' }, uses: [['tasks', 'priority']] },
    eventTypes: { label: "Types d'événement", colored: 1, uses: [['events', 'type']] },
    revenueCats: { label: 'Catégories de revenus', uses: [['finances', 'category']] },
    expenseCats: { label: 'Catégories de dépenses', uses: [['finances', 'category']] },
    noteTags: { label: 'Catégories SOP & notes', uses: [['notes', 'tag']] },
    scriptCats: { label: 'Catégories de scripts', colored: 1, uses: [['scripts', 'category']] },
    callTypes: { label: 'Types de call', colored: 1, uses: [['calls', 'type']] },
    callStatus: { label: 'Statuts de call', colored: 1, kinds: { planned: 'Prévu', done: 'Fait', cancelled: 'Annulé', noshow: 'Absent' }, uses: [['calls', 'status']] },
    leaveTypes: { label: "Types d'absence", colored: 1, uses: [['leaves', 'type']] },
    paymentMethods: { label: 'Moyens de paiement', uses: [['finances', 'payMethod']] },
    programs: { label: "Programmes d'accompagnement", colored: 1, uses: [['students', 'program']] },
    studentStages: { label: 'Statuts des élèves', colored: 1, kinds: { lead: 'Inscrit', active: 'En cours', paused: 'En pause', done: 'Terminé' }, uses: [['students', 'stage']] },
    studentNoteTags: { label: "Types de note d'élève", colored: 1, uses: [['snotes', 'tag']] }
  };

  /* Navigation. `phase` > 1 and no view = not built yet: shown as unavailable, never simulated.
     `hid` = hidden by default to keep the menu short; shown again from Paramètres > Personnalisation. */
  AOS.NAV = [
    { sec: 'Accueil', items: [
      { k: 'dashboard', l: 'Dashboard', i: 'home', view: 1 },
      { k: 'ma-journee', l: 'Ma journée', i: 'sun', view: 1, hid: 1 },
      { k: 'planning', l: 'Agenda', i: 'cal', view: 1 },
      { k: 'taches', l: 'Tâches', i: 'task', view: 1 },
      { k: 'objectifs', l: 'Objectifs', i: 'target', view: 1 },
      { k: 'notifications', l: 'Notifications', i: 'bell', view: 1, hid: 1 }] },
    { sec: 'Organisation', items: [
      { k: 'organigramme', l: 'Organigramme', i: 'org', view: 1 },
      { k: 'equipe', l: 'Équipe', i: 'users', view: 1 },
      { k: 'departements', l: 'Départements', i: 'layers', view: 1 },
      { k: 'presences', l: 'Présences et congés', i: 'clock', view: 1 },
      { k: 'projets', l: 'Projets', i: 'folder', phase: 3, hid: 1, about: 'Projets avec sous-tâches, dépendances, checklists, commentaires, vues kanban et timeline, modèles réutilisables.' }] },
    { sec: 'Agence', items: [
      { k: 'creatrices', l: 'Créatrices', i: 'star', view: 1 },
      { k: 'portal', l: 'Creator Portal', i: 'film', view: 1 },
      { k: 'accompagnement', l: 'Accompagnement', i: 'grad', view: 1 },
      { k: 'calls', l: 'Calls', i: 'phone', view: 1 },
      { k: 'scripts', l: 'Scripts', i: 'script', view: 1 },
      { k: 'drive', l: 'Drive', i: 'drive', view: 1, hid: 1 },
      { k: 'recrutement', l: 'Recrutement', i: 'kanban', view: 1, hid: 1 },
      { k: 'marketing', l: 'Marketing', i: 'megaphone', phase: 5, hid: 1, about: 'Comptes sociaux par créatrice, statistiques saisies ou importées, campagnes et comparaisons de périodes.' },
      { k: 'contenu', l: 'Contenu', i: 'film', phase: 5, hid: 1, about: 'Calendrier éditorial, idées, briefs, scripts et suivi de production.' }] },
    { sec: 'Business', items: [
      { k: 'finances', l: 'Finances', i: 'euro', view: 1 },
      { k: 'depenses', l: 'Dépenses', i: 'receipt', view: 1, hid: 1 },
      { k: 'analytics', l: 'Analytics', i: 'chart', view: 1, hid: 1 }] },
    { sec: 'Productivité', items: [
      { k: 'sop', l: 'SOP & notes', i: 'book', view: 1, hid: 1 },
      { k: 'documents', l: 'Documents', i: 'file', phase: 5, hid: 1, about: 'Stockage de documents avec accès limité. Le module Drive couvre déjà le dépôt de fichiers.' },
      { k: 'automatisations', l: 'Automatisations', i: 'zap', phase: 7, hid: 1, about: 'Constructeur Déclencheur → Condition → Action, journaux, tests, protection contre les boucles et validation des actions sensibles.' },
      { k: 'assistant', l: 'Assistant IA', i: 'sparkles', phase: 8, hid: 1, about: 'Agency Copilot : questions sur tes données, plannings et rapports proposés, toujours soumis à validation.' }] },
    { sec: 'Paramètres', items: [
      { k: 'param-apparence', l: 'Apparence', i: 'palette', view: 1, perm: 'self' },
      { k: 'param-perso', l: 'Personnalisation', i: 'sliders', view: 1, perm: 'parametres' },
      { k: 'param-utilisateurs', l: 'Utilisateurs', i: 'users', view: 1, perm: 'users_manage' },
      { k: 'param-permissions', l: 'Permissions', i: 'shield', view: 1, perm: 'users_manage' },
      { k: 'param-import', l: 'Import / export', i: 'swap', view: 1, perm: 'parametres' },
      { k: 'param-sauvegardes', l: 'Sauvegardes', i: 'db', view: 1, perm: 'parametres' },
      { k: 'param-journal', l: "Journal d'audit", i: 'history', view: 1, perm: 'users_manage' },
      { k: 'param-integrations', l: 'Intégrations', i: 'plug', view: 1, perm: 'parametres' }] }
  ];
  AOS.NAV_FLAT = AOS.NAV.flatMap(s => s.items.map(i => ({ ...i, sec: s.sec })));

  /* Permission modules = every non-settings page, plus one "parametres" module. */
  AOS.PERM_MODULES = [...AOS.NAV_FLAT.filter(n => !n.k.startsWith('param-')).map(n => ({ k: n.k, l: n.l, sec: n.sec })), { k: 'parametres', l: 'Paramètres agence', sec: 'Paramètres' }];
  AOS.PERM_ACTIONS = [['r', 'Lire'], ['c', 'Créer'], ['u', 'Modifier'], ['d', 'Supprimer'], ['x', 'Exporter']];
  AOS.PERM_FLAGS = [
    ['finance_view', 'Voir les finances', 'Nécessite le niveau Éditeur dans le menu Partager : le serveur masque les finances aux autres.'],
    ['salary_view', 'Voir les rémunérations', 'Nécessite le niveau Éditeur dans le menu Partager.'],
    ['contract_view', 'Voir les contrats et commissions', ''],
    ['users_manage', 'Gérer utilisateurs, rôles et journal', 'Nécessite le niveau Éditeur pour enregistrer.'],
    ['automations_manage', 'Gérer les automatisations', 'Module prévu en phase 7.']];

  /* Built-in security roles. perms: module -> subset of "rcudx". minLevel = sharing level the
     server needs for the role's data to be readable/writable (Contributeur = interact, Éditeur = admin). */
  const all = 'rcudx';
  const ops = ['dashboard', 'planning', 'organigramme', 'equipe', 'taches', 'creatrices', 'recrutement', 'sop'];
  const map = (keys, v) => Object.fromEntries(keys.map(k => [k, v]));
  AOS.BUILTIN_ROLES = {
    owner: { name: 'Propriétaire', locked: true, minLevel: 'owner', desc: 'Accès total, non modifiable.' },
    admin: { name: 'Administrateur', minLevel: 'admin', desc: 'Gère tout, y compris utilisateurs et finances.',
      perms: Object.fromEntries(AOS.PERM_MODULES.map(m => [m.k, all])), flags: { finance_view: 1, salary_view: 1, contract_view: 1, users_manage: 1, automations_manage: 1 } },
    manager: { name: 'Manager', minLevel: 'interact', desc: 'Pilote l\'équipe et les créatrices, sans finances ni salaires.',
      perms: { ...map(ops, 'rcu'), taches: 'rcud', planning: 'rcud', sop: 'rcud', dashboard: 'r', objectifs: 'rcu', drive: 'rcu', scripts: 'rcud', calls: 'rcud', accompagnement: 'rcud', portal: 'r', departements: 'rcu', presences: 'rcu', 'ma-journee': 'r', notifications: 'r', analytics: 'r' }, flags: { contract_view: 1 } },
    employee: { name: 'Employé', minLevel: 'interact', desc: 'Voit l\'organisation, gère ses tâches et le planning.',
      perms: { dashboard: 'r', planning: 'rcu', organigramme: 'r', equipe: 'r', taches: 'rcu', creatrices: 'r', sop: 'r', objectifs: 'r', drive: 'rc', scripts: 'rc', calls: 'rcu', accompagnement: 'r', departements: 'r', presences: 'rc', 'ma-journee': 'r', notifications: 'r' }, flags: {} },
    accountant: { name: 'Comptable', minLevel: 'admin', desc: 'Finances et rémunérations uniquement.',
      perms: { dashboard: 'r', finances: all, equipe: 'r', organigramme: 'r', objectifs: 'rcu', drive: 'rc', depenses: all, analytics: 'rx', 'ma-journee': 'r', notifications: 'r', presences: 'r' }, flags: { finance_view: 1, salary_view: 1 } },
    guest: { name: 'Invité', minLevel: 'interact', desc: 'Lecture limitée. Rôle par défaut d\'un compte non configuré.',
      perms: { dashboard: 'r', planning: 'r', sop: 'r', objectifs: 'r', 'ma-journee': 'r', notifications: 'r' }, flags: {} }
  };

  /* modules created after v2: migrations give built-in roles their default rights on them */
  AOS.MODULES_ADDED = ['objectifs', 'drive', 'scripts', 'calls', 'departements', 'presences', 'ma-journee', 'notifications', 'depenses', 'analytics', 'accompagnement', 'portal'];

  /* Goal metrics: each has a written definition and a data source (shown on every goal). */
  AOS.GOAL_METRICS = {
    manual: { l: 'Saisie manuelle', unit: '', def: 'Valeur mise à jour à la main sur l\'objectif.', src: 'Saisie' },
    revenue: { l: 'CA créatrices', unit: '€', fin: 1, cumul: 1, def: 'Somme des revenus saisis entre le début et la fin de la période.', src: 'Finances' },
    commission: { l: 'Commission agence', unit: '€', fin: 1, cumul: 1, def: 'Revenus de la période × % de commission du contrat de chaque créatrice.', src: 'Finances + fiches créatrices' },
    net: { l: 'Résultat net', unit: '€', fin: 1, cumul: 1, def: 'Commission agence − dépenses saisies sur la période.', src: 'Finances' },
    expenses_max: { l: 'Plafond de dépenses', unit: '€', fin: 1, cumul: 1, inverse: 1, def: 'Dépenses de la période. Objectif tenu si elles restent sous le plafond.', src: 'Finances' },
    active_creators: { l: 'Créatrices actives', unit: '', def: 'Nombre actuel de créatrices dont le statut compte comme « Active ».', src: 'Créatrices' },
    tasks_done: { l: 'Tâches terminées', unit: '', cumul: 1, def: 'Tâches passées au statut terminé pendant la période (filtrable par personne).', src: 'Tâches' }
  };
  AOS.GOAL_SCOPES = ['Agence', 'Département', 'Collaborateur'];

  /* Entity schemas. Option lists are read from the live (customisable) lists at form time. */
  AOS.COLLECTIONS = ['creators', 'team', 'tasks', 'events', 'finances', 'notes', 'payroll', 'goals', 'calls', 'leaves', 'scripts', 'depts', 'students', 'snotes'];
  AOS.COL_MODULE = { students: 'accompagnement', snotes: 'accompagnement', creators: 'creatrices', team: 'equipe', tasks: 'taches', events: 'planning', finances: 'finances', notes: 'sop', payroll: 'equipe', goals: 'objectifs', calls: 'calls', leaves: 'presences', scripts: 'scripts', depts: 'departements' };
  AOS.schema = function (col) {
    const L = AOS.lists(), keys = l => l.map(x => typeof x === 'string' ? x : x.k);
    const S = {
      creators: { one: 'Créatrice', fem: 1, fields: [
        { k: 'name', l: 'Nom / pseudo', req: 1 }, { k: 'handle', l: 'Handle', ph: '@pseudo' },
        { k: 'stage', l: 'Statut', t: 'select', o: keys(L.stages), d: keys(L.stages)[0] }, { k: 'managerId', l: 'Account manager', t: 'ref', ref: 'team' },
        { k: 'staff', l: 'Équipe assignée (chatters, monteurs…)', t: 'multi', ref: 'team', full: 1 },
        { k: 'commission', l: 'Commission agence (%)', t: 'number', d: 40, flag: 'contract_view' }, { k: 'platforms', l: 'Plateformes', ph: 'OnlyFans, Instagram, TikTok' },
        { k: 'country', l: 'Pays' }, { k: 'language', l: 'Langue' },
        { k: 'phone', l: 'Téléphone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' },
        { k: 'contractStart', l: 'Début de collaboration', t: 'date', flag: 'contract_view' }, { k: 'contractEnd', l: 'Fin de contrat', t: 'date', flag: 'contract_view' },
        { k: 'nextAction', l: 'Prochaine action', full: 1, ph: 'Ex. envoyer le planning de shooting' },
        { k: 'notes', l: 'Notes', t: 'textarea', full: 1 }] },
      team: { one: 'Collaborateur', fields: [
        { k: 'name', l: 'Prénom et nom', req: 1 }, { k: 'role', l: 'Poste', t: 'list', o: L.postes },
        { k: 'dept', l: 'Département', t: 'select', o: L.departments, d: L.departments[0] }, { k: 'reportsTo', l: 'Responsable direct', t: 'ref', ref: 'team', self: 1 },
        { k: 'avail', l: 'Statut déclaré', t: 'select', o: keys(L.availability), d: keys(L.availability)[0] }, { k: 'shift', l: 'Horaires planifiés', ph: '09:00 – 17:00' },
        { k: 'missions', l: 'Missions principales', full: 1, ph: 'Ex. chatting Agathe & Jade, reporting hebdo' },
        { k: 'phone', l: 'Téléphone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' },
        { k: 'telegram', l: 'Telegram / Discord', ph: '@pseudo' }, { k: 'startDate', l: 'Arrivée', t: 'date' },
        { k: 'location', l: 'Ville / fuseau', ph: 'Paris (UTC+1)', full: 1 },
        { k: 'notes', l: 'Notes', t: 'textarea', full: 1 }] },
      tasks: { one: 'Tâche', fem: 1, fields: [
        { k: 'title', l: 'Tâche', req: 1, full: 1 }, { k: 'status', l: 'Statut', t: 'select', o: keys(L.taskStatus), d: keys(L.taskStatus)[0] },
        { k: 'priority', l: 'Priorité', t: 'select', o: keys(L.priorities), d: (L.priorities.find(p => p.kind === 'normal') || L.priorities[0] || {}).k }, { k: 'due', l: 'Échéance', t: 'date' },
        { k: 'repeat', l: 'Répéter', t: 'select', o: AOS.REPEATS || ['Jamais'], d: 'Jamais' },
        { k: 'assigneeId', l: 'Assignée à', t: 'ref', ref: 'team' }, { k: 'creatorId', l: 'Créatrice liée', t: 'ref', ref: 'creators' },
        { k: 'notes', l: 'Détails', t: 'textarea', full: 1 }] },
      events: { one: 'Événement', fields: [
        { k: 'title', l: 'Titre', req: 1, full: 1 }, { k: 'type', l: 'Type', t: 'select', o: keys(L.eventTypes), d: keys(L.eventTypes)[0] },
        { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'time', l: 'Heure (vide = toute la journée)', t: 'time' },
        { k: 'dur', l: 'Durée', t: 'select', o: ['15', '30', '45', '60', '90', '120', '180', '240'], labels: { 15: '15 min', 30: '30 min', 45: '45 min', 60: '1 h', 90: '1 h 30', 120: '2 h', 180: '3 h', 240: '4 h' }, d: '60' }, { k: 'place', l: 'Lieu / lien' },
        { k: 'creatorId', l: 'Créatrice liée', t: 'ref', ref: 'creators' }, { k: 'attendees', l: 'Participants', t: 'multi', ref: 'team', full: 1 },
        { k: 'notes', l: 'Notes', t: 'textarea', full: 1 }] },
      finances: { one: 'Transaction', fem: 1, fields: [
        { k: 'label', l: 'Libellé', req: 1, full: 1 }, { k: 'type', l: 'Type', t: 'select', o: ['Revenu', 'Dépense'], d: 'Revenu' },
        { k: 'category', l: 'Catégorie', t: 'select', o: [...L.revenueCats, ...L.expenseCats], d: L.revenueCats[0] },
        { k: 'amount', l: 'Montant (€)', t: 'number', req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1 },
        { k: 'creatorId', l: 'Créatrice', t: 'ref', ref: 'creators', full: 1 },
        { k: 'supplier', l: 'Fournisseur / bénéficiaire', showIf: ['type', ['Dépense']] }, { k: 'payMethod', l: 'Moyen de paiement', t: 'select', o: ['', ...L.paymentMethods], showIf: ['type', ['Dépense']] },
        { k: 'recurrence', l: 'Récurrence', t: 'select', o: ['Aucune', 'Mensuelle', 'Annuelle'], d: 'Aucune', showIf: ['type', ['Dépense']] }, { k: 'payStatus', l: 'Statut', t: 'select', o: ['Payée', 'À payer'], d: 'Payée', showIf: ['type', ['Dépense']] },
        { k: 'receipt', l: 'Justificatif (lien Drive ou URL)', full: 1, ph: 'https://drive.google.com/…', showIf: ['type', ['Dépense']] }] },
      notes: { one: 'Note', fem: 1, fields: [
        { k: 'title', l: 'Titre', req: 1 }, { k: 'tag', l: 'Catégorie', t: 'select', o: L.noteTags, d: L.noteTags[0] },
        { k: 'creatorId', l: 'Créatrice liée', t: 'ref', ref: 'creators' }, { k: 'pinned', l: 'Épinglée', t: 'bool' },
        { k: 'body', l: 'Contenu', t: 'textarea', tall: 1, full: 1 }] },
      goals: { one: 'Objectif', fields: [
        { k: 'title', l: 'Objectif', req: 1, full: 1, ph: 'Ex. 80 k€ de CA en novembre' },
        { k: 'metric', l: 'Mesure', t: 'select', o: Object.keys(AOS.GOAL_METRICS), labels: Object.fromEntries(Object.entries(AOS.GOAL_METRICS).map(([k, m]) => [k, m.l])), d: 'revenue' },
        { k: 'target', l: 'Cible', t: 'number', req: 1 },
        { k: 'current', l: 'Valeur actuelle', t: 'number', showIf: ['metric', ['manual']] },
        { k: 'unit', l: 'Unité', ph: '€, contrats, vidéos…', showIf: ['metric', ['manual']] },
        { k: 'start', l: 'Début', t: 'date', req: 1 }, { k: 'end', l: 'Fin', t: 'date', req: 1 },
        { k: 'scope', l: 'Portée', t: 'select', o: AOS.GOAL_SCOPES, d: 'Agence' },
        { k: 'dept', l: 'Département', t: 'select', o: ['', ...L.departments], showIf: ['scope', ['Département']] },
        { k: 'memberId', l: 'Collaborateur', t: 'ref', ref: 'team', showIf: ['scope', ['Collaborateur']] },
        { k: 'ownerId', l: 'Responsable du suivi', t: 'ref', ref: 'team' },
        { k: 'pinned', l: 'Afficher sur le dashboard', t: 'bool', d: true, txt: 'Visible dans le bloc Objectifs du dashboard' },
        { k: 'notes', l: 'Notes', t: 'textarea', full: 1 }] },
      calls: { one: 'Call', fields: [
        { k: 'title', l: 'Avec qui ?', req: 1, ph: 'Ex. @lou.snaps ou Julie (candidate chatteuse)' }, { k: 'type', l: 'Type', t: 'select', o: keys(L.callTypes), d: keys(L.callTypes)[0] },
        { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'time', l: 'Heure', t: 'time' },
        { k: 'ownerId', l: 'Responsable', t: 'ref', ref: 'team' }, { k: 'status', l: 'Statut', t: 'select', o: keys(L.callStatus), d: keys(L.callStatus)[0] },
        { k: 'creatorId', l: 'Créatrice liée', t: 'ref', ref: 'creators' }, { k: 'place', l: 'Lien / numéro', ph: 'Meet, Zoom, appel Instagram…' },
        { k: 'result', l: 'Notes du call (ce qui s\'est dit, décisions)', t: 'textarea', full: 1 },
        { k: 'prep', l: 'À aborder au prochain call', t: 'textarea', full: 1, ph: 'Ce que tu veux retrouver sous les yeux avant le prochain appel' },
        { k: 'nextAction', l: 'Prochaine action', ph: 'Ex. envoyer le contrat' }, { k: 'nextDate', l: 'Pour le', t: 'date' },
        { k: 'studentId', l: 'Élève (accompagnement)', t: 'ref', ref: 'students', full: 1 }] },
      students: { one: 'Élève', fields: [
        { k: 'name', l: 'Prénom et nom', req: 1 }, { k: 'handle', l: 'Instagram / pseudo', ph: '@pseudo' },
        { k: 'program', l: 'Programme', t: 'select', o: keys(L.programs), d: keys(L.programs)[0] }, { k: 'stage', l: 'Statut', t: 'select', o: keys(L.studentStages), d: (L.studentStages.find(x => x.kind === 'active') || L.studentStages[0] || {}).k },
        { k: 'coachId', l: 'Coach', t: 'ref', ref: 'team' }, { k: 'progress', l: 'Progression (%)', t: 'number', d: 0 },
        { k: 'step', l: 'Étape / module actuel', ph: 'Ex. Module 3 : recrutement de créatrices', full: 1 },
        { k: 'start', l: 'Début de la collaboration', t: 'date' }, { k: 'end', l: 'Fin prévue', t: 'date' },
        { k: 'people', l: 'Nombre de personnes', t: 'number', d: 1 }, { k: 'callEvery', l: 'Rythme des calls', ph: 'Ex. 1 call par semaine' },
        { k: 'price', l: 'Prix total (€)', t: 'number', flag: 'finance_view' }, { k: 'paid', l: 'Déjà payé (€)', t: 'number', flag: 'finance_view' },
        { k: 'payNext', l: 'Prochaine échéance de paiement', t: 'date', flag: 'finance_view' }, { k: 'payPlan', l: 'Modalités de paiement', ph: 'Ex. 3 × 500 €, le 5 du mois', flag: 'finance_view' },
        { k: 'phone', l: 'Téléphone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' },
        { k: 'telegram', l: 'Telegram / Discord', full: 1 },
        { k: 'goal', l: 'Son objectif', t: 'textarea', full: 1, ph: 'Ex. signer sa première créatrice avant mars' }] },
      leaves: { one: 'Absence', fem: 1, fields: [
        { k: 'memberId', l: 'Collaborateur', t: 'ref', ref: 'team', req: 1 }, { k: 'type', l: 'Type', t: 'select', o: keys(L.leaveTypes), d: keys(L.leaveTypes)[0] },
        { k: 'start', l: 'Du', t: 'date', req: 1 }, { k: 'end', l: 'Au (inclus)', t: 'date', req: 1 },
        { k: 'status', l: 'Statut', t: 'select', o: ['En attente', 'Validée', 'Refusée'], d: 'En attente', approve: 1 },
        { k: 'note', l: 'Motif / note', t: 'textarea', full: 1 }] },
      depts: { one: 'Département', fields: [
        { k: 'name', l: 'Nom', req: 1 }, { k: 'leadId', l: 'Responsable', t: 'ref', ref: 'team' },
        { k: 'mission', l: 'Mission', t: 'textarea', full: 1, ph: 'Ce que fait ce département' }] },
      payroll: { one: 'Rémunération', fem: 1, fields: [
        { k: 'pay', l: 'Rémunération (texte libre)', full: 1, ph: 'Ex. fixe 1 800 € + 3 % du CA chat' },
        { k: 'notes', l: 'Notes confidentielles', t: 'textarea', full: 1 }] }
    };
    return S[col];
  };
})(typeof window !== 'undefined' ? window : globalThis);
