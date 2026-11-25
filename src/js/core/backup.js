/* Agency OS — backups, restore, exports, audit maintenance. */
(function (g) {
  const AOS = g.AOS = g.AOS || {};
  const S = AOS.S, me = AOS.me;
  const CHUNK = 50000;           // chars per stored part: stays under the 256 KiB document limit even for 3-byte characters
  const KEEP = 10;               // cloud snapshots kept
  const AUDIT_DAYS = 180;        // audit retention
  const LS_SNAP = 'agencyos.snapshots';

  async function downloads() { try { return g.claude && g.claude.use ? await g.claude.use('downloads') : null; } catch (e) { return null; } }

  /* Offer a file. Resolves 'saved' | 'declined' | 'unavailable'. */
  async function offer(filename, text) {
    const dl = await downloads();
    if (!dl && !g.claude) {   // standalone deployment (e.g. Netlify): a normal browser download works
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: filename.endsWith('.csv') ? 'text/csv' : 'application/json' })); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return 'saved'; } catch (e) { return 'unavailable'; }
    }
    if (!dl) return 'unavailable';
    try { await dl.save({ filename, data: text }); return 'saved'; }
    catch (e) { return e && e.code === 'declined' ? 'declined' : 'unavailable'; }
  }
  const stamp = () => AOS.today();
  const build = () => AOS.buildBackup(S, { now: Date.now(), partial: !(me.role && me.role.locked) && !(AOS.flag(me.role, 'finance_view') && AOS.flag(me.role, 'salary_view')) });

  const CSV_COLS = {
    creators: [['name', 'Nom'], ['handle', 'Handle'], ['stage', 'Statut'], [r => nm('team', r.managerId), 'Account manager'], ['commission', 'Commission %'], ['platforms', 'Plateformes'], ['country', 'Pays'], ['language', 'Langue'], ['phone', 'Téléphone'], ['email', 'Email'], ['contractStart', 'Début'], ['contractEnd', 'Fin de contrat'], ['nextAction', 'Prochaine action']],
    team: [['name', 'Nom'], ['role', 'Poste'], ['dept', 'Département'], [r => nm('team', r.reportsTo), 'Responsable'], ['avail', 'Statut déclaré'], ['shift', 'Horaires'], ['phone', 'Téléphone'], ['email', 'Email'], ['telegram', 'Telegram'], ['startDate', 'Arrivée'], ['location', 'Ville']],
    tasks: [['title', 'Tâche'], ['status', 'Statut'], ['priority', 'Priorité'], ['due', 'Échéance'], [r => nm('team', r.assigneeId), 'Assignée à'], [r => nm('creators', r.creatorId), 'Créatrice']],
    events: [['date', 'Date'], ['time', 'Heure'], ['title', 'Titre'], ['type', 'Type'], ['place', 'Lieu'], [r => nm('creators', r.creatorId), 'Créatrice'], [r => (r.attendees || []).map(i => nm('team', i)).join(', '), 'Participants']],
    finances: [['date', 'Date'], ['type', 'Type'], ['label', 'Libellé'], ['category', 'Catégorie'], ['amount', 'Montant'], [r => nm('creators', r.creatorId), 'Créatrice']],
    notes: [['title', 'Titre'], ['tag', 'Catégorie'], ['body', 'Contenu'], [r => nm('creators', r.creatorId), 'Créatrice']]
  };
  const nm = (c, id) => { const r = (S[c] || []).find(x => x.id === id); return r ? (r.name || r.title) : ''; };

  const backup = {
    build,
    offer,
    async exportJSON() {
      const obj = build(), res = await offer(`lvh-master-sauvegarde-${stamp()}.json`, JSON.stringify(obj, null, 2));
      if (res === 'saved') AOS.audit({ act: 'export', label: 'Sauvegarde JSON téléchargée' + (obj.partial ? ' (partielle)' : '') });
      return { res, text: JSON.stringify(obj, null, 2) };
    },
    csvText(col) { return AOS.csv(S[col] || [], CSV_COLS[col].map(([k, label]) => ({ label, get: typeof k === 'function' ? k : r => r[k] }))); },
    async exportCSV(col) {
      const text = backup.csvText(col), res = await offer(`lvh-master-${col}-${stamp()}.csv`, text);
      if (res === 'saved') AOS.audit({ act: 'export', col, label: 'Export CSV ' + col });
      return { res, text };
    },
    CSV_COLS,
    parse(text) { try { return JSON.parse(text); } catch (e) { return null; } },
    /* Restores after taking an automatic snapshot of the current state (synced mode). */
    async restore(obj, mode, onProgress) {
      if (AOS.db()) { try { await backup.createSnapshot('avant restauration'); } catch (e) { return { ok: 0, failed: 1, error: e, msg: 'Impossible de créer la sauvegarde de sécurité : restauration annulée.' }; } }
      const ops = AOS.restorePlan(obj, S, mode);
      const res = await AOS.applyOps(ops, { onProgress });
      AOS.audit({ act: 'restore', label: `Restauration (${mode === 'replace' ? 'remplacement' : 'fusion'}) : ${res.ok} écritures, ${res.failed} échecs` });
      return res;
    },

    /* ----- snapshots ----- */
    async listSnapshots() {
      const db = AOS.db();
      if (!db) return (readLocalSnaps()).map(s => s.meta);
      const q = await db.collection('backups').orderBy('at', 'desc').limit(30).get();
      return q.docs.map(d => ({ ...d.data(), id: d.id }));
    },
    async createSnapshot(reason) {
      const obj = build(), text = JSON.stringify(obj), id = 'b' + Date.now().toString(36);
      const meta = { at: Date.now(), by: me.uid || 'local', reason: reason || 'manuelle', schema: obj.schema, size: text.length, counts: Object.fromEntries(Object.entries(obj.data).map(([k, v]) => [k, v.length])), partial: obj.partial };
      const db = AOS.db();
      if (!db) {
        const snaps = readLocalSnaps(); snaps.unshift({ meta: { ...meta, id }, text });
        try { localStorage.setItem(LS_SNAP, JSON.stringify(snaps.slice(0, 3))); } catch (e) { throw { code: 'quota_exceeded' }; }
        return id;
      }
      const parts = Math.max(1, Math.ceil(text.length / CHUNK));
      for (let i = 0; i < parts; i++) await db.doc(`backups/${id}/parts/${i}`).set({ i, chunk: text.slice(i * CHUNK, (i + 1) * CHUNK) });
      await db.doc('backups/' + id).set({ ...meta, parts });       // meta last: a snapshot only lists once complete
      AOS.audit({ act: 'backup', label: 'Sauvegarde ' + (reason || 'manuelle') });
      const all = await backup.listSnapshots();
      for (const old of all.slice(KEEP)) await backup.deleteSnapshot(old.id, true);
      return id;
    },
    async loadSnapshot(id) {
      const db = AOS.db();
      if (!db) { const s = readLocalSnaps().find(x => x.meta.id === id); return s ? JSON.parse(s.text) : null; }
      const m = await db.doc('backups/' + id).get(); if (!m.exists) return null;
      let text = '';
      for (let i = 0; i < m.data().parts; i++) { const p = await db.doc(`backups/${id}/parts/${i}`).get(); if (!p.exists) return null; text += p.data().chunk; }
      return JSON.parse(text);
    },
    async deleteSnapshot(id, quiet) {
      const db = AOS.db();
      if (!db) { localStorage.setItem(LS_SNAP, JSON.stringify(readLocalSnaps().filter(x => x.meta.id !== id))); return; }
      const m = await db.doc('backups/' + id).get();
      await db.doc('backups/' + id).delete();
      for (let i = 0; i < ((m.exists && m.data().parts) || 0); i++) await db.doc(`backups/${id}/parts/${i}`).delete();
      if (!quiet) AOS.audit({ act: 'delete', col: 'backups', docId: id, label: 'Sauvegarde supprimée' });
    },
    async autoSnapshot() {
      if (!AOS.db() || !(me.isOwner || me.canEdit)) return;
      const last = (await backup.listSnapshots())[0];
      if (!last || Date.now() - last.at > 24 * 3600e3) await backup.createSnapshot('automatique quotidienne');
    },

    /* ----- audit ----- */
    /* people whose audit trail we know: the owner, every configured user, and the viewer */
    auditPeople() { return [...new Set([S.settings.ownerUid, me.uid, ...S.users.map(u => u.id)].filter(Boolean))]; },
    async auditList(limit = 200) {
      const db = AOS.db();
      if (!db) return S.audit.slice(0, limit);
      const all = [];
      for (const uid of backup.auditPeople()) {
        const q = await db.collection('audit/' + uid + '/entries').orderBy('at', 'desc').limit(limit).get();
        all.push(...q.docs.map(d => ({ ...d.data(), id: d.id })));
      }
      return all.sort((a, b) => b.at - a.at).slice(0, limit);
    },
    async pruneAudit() {
      const db = AOS.db(); if (!db) return;
      for (const uid of backup.auditPeople()) {
        const q = await db.collection('audit/' + uid + '/entries').where('at', '<', Date.now() - AUDIT_DAYS * 864e5).limit(200).get();
        for (const d of q.docs) await db.doc('audit/' + uid + '/entries/' + d.id).delete();
      }
    }
  };
  function readLocalSnaps() { try { return JSON.parse(localStorage.getItem(LS_SNAP) || '[]'); } catch (e) { return []; } }

  /* Demo records are flagged demo:true; removing them is the only bulk delete the app offers. */
  AOS.demoOps = () => AOS.BACKUP_COLS.flatMap(c => (S[c] || []).filter(r => r.demo).map(r => ({ op: 'delete', col: c, id: r.id })));
  AOS.backup = backup;
})(typeof window !== 'undefined' ? window : globalThis);
