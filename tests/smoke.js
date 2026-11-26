/* Smoke test: serves src/, drives the app in local mode and checks the main flows.
   Run: node tests/smoke.js   (needs Playwright with Chromium) */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'src'), SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let n = 0, failed = 0;
const ok = (cond, label) => { n++; if (!cond) failed++; console.log((cond ? 'ok   ' : 'FAIL ') + label); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, colorScheme: 'dark' });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  /* a stand-in for the portal's database: same routes and shapes as the real one, fictional rows */
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-hugo', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  const dAgo = n => new Date(Date.now() - n * 864e5).toISOString();
  const portal = { logins: [], role: 'manager',
    people: [{ id: 'u-hugo', full_name: 'Hugo', role: 'manager', status: 'active' }, { id: 'u-lucas', full_name: 'Lucas', role: 'manager', status: 'active' }, { id: 'c-jade', full_name: 'Jade', role: 'creator', status: 'active' }],
    requests: [
      { id: '11111111-1111-4111-8111-111111111111', title: 'Reel playback hook', status: 'submitted', platform: 'instagram', deadline: dAgo(-2), creator_id: 'c-jade', created_by: 'u-lucas', created_at: dAgo(4), updated_at: dAgo(0.2), submitted_at: dAgo(0.2), approved_at: null },
      { id: '22222222-2222-4222-8222-222222222222', title: 'Story coulisses', status: 'todo', platform: 'instagram', deadline: dAgo(1), creator_id: 'c-jade', created_by: 'u-hugo', created_at: dAgo(3), updated_at: dAgo(3), submitted_at: null, approved_at: null },
      { id: '33333333-3333-4333-8333-333333333333', title: 'TikTok trend', status: 'approved', platform: 'tiktok', deadline: null, creator_id: 'c-jade', created_by: 'u-hugo', created_at: dAgo(6), updated_at: dAgo(1), submitted_at: dAgo(2), approved_at: dAgo(1) },
      { id: '44444444-4444-4444-8444-444444444444', title: 'Brouillon caché', status: 'draft', platform: 'instagram', deadline: null, creator_id: 'c-jade', created_by: 'u-hugo', created_at: dAgo(1), updated_at: dAgo(1), submitted_at: null, approved_at: null }],
    media: [{ id: 'm1', request_id: '11111111-1111-4111-8111-111111111111', creator_id: 'c-jade', kind: 'video', review_state: 'pending', created_at: dAgo(0.2) }, { id: 'm2', request_id: '11111111-1111-4111-8111-111111111111', creator_id: 'c-jade', kind: 'video', review_state: 'pending', created_at: dAgo(0.2) }] };
  let tick = 0; portal.crm = [];
  const portalRoute = async route => {
    const req = route.request(), url = new URL(req.url()), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/token') { const b = req.postDataJSON() || {}; portal.logins.push(b.email);
      if (b.password !== 'bon-mot-de-passe') return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return json({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r1', user: { id: 'u-hugo', aud: 'authenticated', role: 'authenticated', email: b.email, app_metadata: {}, user_metadata: {}, created_at: dAgo(30) } }); }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (!/^Bearer ey/.test(req.headers().authorization || '')) return json({ message: 'no session' }, 401);
    if (url.pathname === '/rest/v1/profiles') return (req.headers().accept || '').includes('vnd.pgrst.object') ? json({ ...portal.people[0], role: portal.role }) : json(portal.people);
    if (url.pathname === '/rest/v1/content_requests') return json(portal.requests.filter(r => r.status !== 'archived'));
    if (url.pathname === '/rest/v1/media_assets') return json(portal.media);
    if (url.pathname === '/rest/v1/crm_records' && req.method() === 'POST') {   // upsert: the server stamps the time, like the real trigger
      for (const r of req.postDataJSON()) { const i = portal.crm.findIndex(x => x.user_id === r.user_id && x.col === r.col && x.id === r.id), row = { ...r, updated_at: new Date(Date.now() + (++tick)).toISOString() }; i >= 0 ? portal.crm[i] = row : portal.crm.push(row); }
      return route.fulfill({ status: 201, headers: cors, body: '' }); }
    if (url.pathname === '/rest/v1/crm_records') { const q = url.searchParams, since = (q.get('updated_at') || '').replace(/^gt\./, ''), me = (q.get('user_id') || '').replace(/^eq\./, '');
      return json(portal.crm.filter(r => r.user_id === me && (!since || r.updated_at > since)).sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, +(q.get('limit') || 500))); }
    return json([]);
  };
  await page.route('https://togzyxnopontjwjkxcod.supabase.co/**', portalRoute);
  await page.goto(base); await page.waitForSelector('.hero');
  ok(await page.title() === 'LVH Master', 'title is LVH Master');
  const man = await page.evaluate(async () => { const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json(); const sizes = []; for (const i of m.icons) { const r = await fetch(i.src); sizes.push(r.ok && r.headers.get('content-type') === 'image/png'); } return [m.display, m.icons.length, sizes.every(Boolean)]; });
  ok(man[0] === 'standalone' && man[1] === 3 && man[2], 'the app is installable: manifest and icons are served');
  ok(await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active)), 'the service worker is active (offline support)');
  ok(await page.locator('.side .brand b').innerText() === 'LVH Master', 'brand shows LVH Master');
  ok(await page.locator('.side [data-nav="portal"]').count() === 1, 'Creator Portal is in the menu');

  /* seed through the same API the forms use */
  await page.evaluate(async () => {
    const A = window.AOS, t = A.today(), L = A.lists(), st = k => (L.callStatus.find(x => x.kind === k) || {}).k;
    const sid = await A.save('students', { name: 'Camille Test', handle: '@camille', program: 'Coaching 1:1', stage: 'En cours', progress: 40, step: 'Module 2', start: A.addDays(t, -104), people: 3, price: 3000, paid: 1000, payNext: A.addDays(t, -2), payPlan: '3 × 1000 €', goal: 'Signer 2 créatrices' });
    await A.save('calls', { title: 'Camille Test', studentId: sid, type: 'Coaching élève', date: A.addDays(t, -14), time: '15:00', status: st('done'), result: 'On a revu son offre.\nElle doit poster 3 reels.', prep: 'Vérifier les 3 reels et parler du pricing', nextAction: 'Envoyer le modèle de contrat', nextDate: A.addDays(t, -10) });
    await A.save('calls', { title: 'Camille Test', studentId: sid, type: 'Coaching élève', date: A.addDays(t, -3), time: '15:00', status: st('done'), result: '' });
    await A.save('calls', { title: 'Camille Test', studentId: sid, type: 'Coaching élève', date: A.addDays(t, 1), time: '15:00', status: st('planned') });
    await A.save('goals', { title: 'Signer 3 créatrices', metric: 'manual', target: 3, current: 1, unit: 'contrats', start: t.slice(0, 8) + '01', end: A.addDays(t, 20), scope: 'Agence', pinned: true });
    await A.save('tasks', { title: 'Envoyer 20-30 DM', status: 'À faire', priority: 'Normale', due: t });
    const cid = await A.save('creators', { name: 'Jade', stage: 'Active', commission: 40 });
    const amounts = [5200, 6100, 5800, 7400, 9000, 10350];
    for (let i = 0; i < 6; i++) await A.save('finances', { label: 'Abonnements', type: 'Revenu', category: 'Abonnements', amount: amounts[i], date: A.shiftMonth(t.slice(0, 7), i - 5) + '-0' + (i === 5 ? 1 : 5), creatorId: cid });
    /* a second créatrice whose revenue fell: 4000 in the 30 days before, 1000 in the last 30 */
    const c2 = await A.save('creators', { name: 'Lou', stage: 'Active', commission: 40, managerId: 'x' });
    await A.save('finances', { label: 'Tips', type: 'Revenu', category: 'Tips', amount: 4000, date: A.addDays(t, -45), creatorId: c2 });
    await A.save('finances', { label: 'Tips', type: 'Revenu', category: 'Tips', amount: 1000, date: A.addDays(t, -10), creatorId: c2 });
    const boss = await A.save('team', { name: 'Hugo', role: 'CEO / Fondateur', dept: 'Direction', avail: 'Disponible' });
    await A.save('team', { name: 'Charles', role: 'Closer', dept: 'Recrutement', avail: 'Disponible', reportsTo: boss });
    window.__sid = sid;
  });
  await page.waitForTimeout(200);

  /* dashboard */
  ok(await page.locator('.goalbox .mg').count() === 1, 'dashboard shows the pinned goal');
  ok(/Envoyer 20-30 DM/.test(await page.locator('#view').innerText()), 'dashboard shows today\'s task');
  const dash = await page.locator('#view').innerText();
  ok(await page.locator('#view [data-a="callbrief"]').count() === 1 && /Dernier call/.test(dash), 'dashboard shows the next call with the last notes');
  ok(/Notes à écrire/i.test(dash), 'dashboard asks for the missing call notes');
  ok(/Creator Portal/.test(dash) && await page.locator('#view .pt-strip a[href="https://lvhcontentmanager.netlify.app/requests/new"]').count() === 1, 'dashboard links to the Creator Portal');
  ok(/Paiement de Camille Test attendu/.test(dash), 'dashboard flags the late payment');
  ok(/reste à encaisser/.test(dash), 'dashboard shows what is left to collect');
  ok(/Lou : CA en baisse de 75 % sur 30 jours/.test(dash) && !/Jade : CA en baisse/.test(dash), 'dashboard flags the créatrice whose revenue dropped');
  const monthRev = await page.evaluate(() => AOS.eur(AOS.fin.rev(AOS.S, AOS.today().slice(0, 7))));
  ok(await page.locator('#finN').innerText() === monthRev && /[▲▼] \d+ %/.test(await page.locator('#finD').innerText()), 'revenue headline shows this month and the change');
  await page.locator('#finPlot').scrollIntoViewIfNeeded();
  const box = await page.locator('#finPlot').boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + 40);
  ok(/7[\s  ]400/.test(await page.locator('#finN').innerText()), 'moving along the line shows that month');
  await page.mouse.move(box.x + box.width / 2, box.y - 60);
  ok(await page.locator('#finN').innerText() === monthRev, 'leaving the chart restores this month');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('1-dashboard');

  /* brief: the last call with notes is the one of 3 days ago (empty) -> falls back to showing it, older ones listed */
  await page.locator('#view [data-a="callbrief"]').first().click();
  await page.waitForSelector('.brief');
  let brief = await page.locator('.brief').innerText();
  ok(/Ensemble depuis/i.test(brief) && /3 mois/.test(brief), 'brief shows how long we have worked together');
  ok(/Reste à payer/i.test(brief) && /2[\s  ]000/.test(brief), 'brief shows the amount left to pay');
  ok(/Aucune note écrite pour ce call/.test(brief) && /On a revu son offre/.test(brief), 'brief shows the last call and the earlier notes');
  await page.locator('[data-a="briefclose"]').click();

  /* write the notes of the last call, then the brief shows them */
  await page.locator('#view [data-a="callwrite"]').first().click();
  await page.waitForSelector('#frm');
  await page.fill('#f-result', 'Elle a posté 2 reels sur 3.');
  await page.fill('#f-prep', 'Demander le 3e reel');
  await page.locator('#frm [type=submit]').click();
  await page.waitForSelector('#frm', { state: 'detached' });
  ok(!/Notes à écrire/i.test(await page.locator('#view').innerText()), 'no more notes to write once saved');
  ok(/Demander le 3e reel/.test(await page.locator('#view').innerText()), 'dashboard shows the point to raise next time');
  await page.locator('#view [data-a="callbrief"]').first().click();
  await page.waitForSelector('.brief'); brief = await page.locator('.brief').innerText();
  ok(/Elle a posté 2 reels sur 3/.test(brief) && /Demander le 3e reel/.test(brief), 'brief shows the new notes and the point to raise');
  await shot('2-brief');
  await page.locator('[data-a="briefclose"]').click();

  /* accompagnement */
  await page.locator('.side [data-nav="accompagnement"]').click(); await page.waitForSelector('.student');
  const acc = await page.locator('#view').innerText();
  ok(/3 pers\./.test(acc) && /3 mois/.test(acc) && /reste/.test(acc), 'card shows people, duration and amount left');
  ok(/personnes accompagnées/.test(acc) && /1 en retard/.test(acc), 'stats show people and late payments');
  await shot('3-accompagnement');
  await page.locator('.student').first().click(); await page.waitForSelector('.drawer #stPayForm');
  await page.fill('#stPayForm [name=a]', '500'); await page.locator('#stPayForm button').click();
  await page.waitForFunction(() => /1[\s  ]500/.test(document.querySelector('.drawer .pay-top').innerText));
  const paid = await page.evaluate(() => { const s = AOS.S.students.find(x => x.id === window.__sid); return [s.paid, (s.payments || []).length]; });
  ok(paid[0] === 1500 && paid[1] === 1, 'a payment is recorded and added to the total');
  ok(/Avant le call/.test(await page.locator('.drawer').innerText()), 'the fiche shows the notes before the next call');
  await shot('4-fiche');
  await page.locator('.drawer [data-a="stpaydel"]').click(); await page.locator('#layer .modal .btn.danger, #layer .modal .btn.pri').last().click();
  await page.waitForFunction(() => AOS.S.students.find(x => x.id === window.__sid).paid === 1000);
  ok(true, 'a payment can be cancelled');
  await page.locator('.drawer [data-a="closedrawer"]').click();

  /* creator portal */
  await page.locator('.side [data-nav="portal"]').click(); await page.waitForSelector('.pt-pages');
  ok(await page.locator('.pt-page').count() === 9 && await page.locator('.head a[href$="/requests/new"]').count() === 1, 'portal page lists the 9 pages and a create button');
  await page.locator('details.pt-set summary').click();
  ok(await page.locator('.pt-page[href$="/calendar"]').getAttribute('target') === '_blank', 'portal links open in a new tab');
  await page.fill('#portalUrlForm [name=u]', 'javascript:alert(1)'); await page.locator('#portalUrlForm button').click();
  ok(await page.evaluate(() => AOS.portalUrl()) === 'https://lvhcontentmanager.netlify.app', 'an unsafe portal address is refused');
  await page.fill('#portalUrlForm [name=u]', 'https://portal.example.com/'); await page.locator('#portalUrlForm button').click();
  await page.waitForFunction(() => AOS.portalUrl() === 'https://portal.example.com');
  ok(await page.locator('.pt-page[href="https://portal.example.com/media"]').count() === 1, 'the portal address can be changed');
  await page.evaluate(() => AOS.setDoc('settings/agency', { ...AOS.S.settings, portalUrl: '' }));
  await page.waitForTimeout(100); await shot('5-portal');

  /* org chart: a card moves straight away, a click still opens the fiche */
  await page.locator('.side [data-nav="organigramme"]').click(); await page.waitForSelector('.oc-n');
  ok(await page.locator('.oc.editing').count() === 1 && await page.locator('.oc-n .oc-h').count() >= 2, 'org chart is movable without an edit mode');
  const card = page.locator('.oc-n', { hasText: 'Charles' }), b0 = await card.boundingBox();
  await page.mouse.move(b0.x + 40, b0.y + 20); await page.mouse.down(); await page.mouse.move(b0.x + 140, b0.y + 90, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150); const b1 = await page.locator('.oc-n', { hasText: 'Charles' }).boundingBox();
  ok(Math.abs(b1.x - b0.x) > 50 && Math.abs(b1.y - b0.y) > 30 && await page.evaluate(() => !!(AOS.S.orgLayout && AOS.S.orgLayout.pos)), 'dragging a card moves it and saves its place');
  ok(await page.locator('.drawer').count() === 0, 'dragging does not open the fiche');
  await shot('7-organigramme');
  await page.locator('.oc-n', { hasText: 'Hugo' }).click(); await page.waitForSelector('.drawer');
  ok(true, 'a click opens the fiche'); await page.locator('.drawer [data-a="closedrawer"]').click();

  /* checklists: one click creates dated tasks */
  await page.locator('.side [data-nav="taches"]').click(); await page.locator('[data-a="tplopen"]').click();
  await page.locator('#tplModal [data-a="tplrun"]', { hasText: 'Onboarding créatrice' }).click(); await page.waitForSelector('#tplRun');
  await page.selectOption('#tpl-cr', { label: 'Jade' }); await page.fill('#tpl-lbl', 'Jade');
  await shot('8-checklist');
  const before = await page.evaluate(() => AOS.S.tasks.length);
  await page.locator('#tplRun .btn.pri').click(); await page.waitForSelector('#tplModal', { state: 'detached' });
  const made = await page.evaluate(n => { const A = AOS, ts = A.S.tasks.filter(x => x.fromTemplate === 'onb-creatrice'); return [A.S.tasks.length - n, ts.every(x => x.creatorId && / · Jade$/.test(x.title)), ts.some(x => x.due === A.addDays(A.today(), 30))]; }, before);
  ok(made[0] === 9 && made[1] && made[2], 'a checklist creates its 9 dated tasks, linked to the créatrice');
  await page.locator('[data-a="tplopen"]').click(); await page.locator('#tplModal [data-a="tpledit"][data-id=""]').click();
  await page.fill('#tpl-title', 'Lancement PPV'); await page.fill('#tpl-steps', 'Préparer le média\nEnvoyer le PPV +2'); await page.locator('#tplEdit .btn.pri').click();
  await page.waitForFunction(() => AOS.taskTemplates().some(x => x.title === 'Lancement PPV' && x.steps.length === 2 && x.steps[1][1] === 2));
  ok(await page.evaluate(() => AOS.taskTemplates().length === 6), 'a custom checklist can be added'); await page.locator('#tplModal [data-a="tplclose"]').click();

  /* short menu, one settings button with tabs, quick add */
  const side = await page.locator('.side .navs .nav').allInnerTexts();
  ok(side.length <= 15 && !side.some(t => /Ma journée|Notifications|Analytics|Apparence/.test(t)), 'the menu is short: ' + side.length + ' entries');
  await page.locator('.side-foot .nav').click(); await page.waitForSelector('.ptabs');
  ok(await page.locator('.ptabs .chip').count() === 8, 'settings open from one button, with 8 tabs');
  await page.locator('.ptabs .chip', { hasText: 'Personnalisation' }).click(); await page.waitForSelector('.modgrid');
  ok(/Ma journée/.test(await page.locator('#view').innerText()), 'hidden pages can be shown again in Personnalisation');
  await page.locator('.plusbtn').click(); await page.locator('.quick [data-col="calls"]').click(); await page.waitForSelector('#frm #f-title');
  ok(true, 'the + button opens a new call form'); await page.locator('#frm [data-a="closeform"]').click();
  const cols = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return [cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--bg').trim()]; });
  ok(cols[0] === '#ffffff' && cols[1] === '#000000', 'default look is black and white');

  /* portal link: sign in with the portal account, then see what was sent and what came back */
  await page.locator('.side [data-nav="portal"]').click(); await page.waitForSelector('#portalLogin');
  await page.fill('#pl-email', 'hugo@example.com'); await page.fill('#pl-pass', 'mauvais'); await page.locator('#portalLogin .btn.pri').click();
  await page.waitForSelector('#portalLogin + p.bad-t, #portalLogin ~ p.bad-t');
  ok(/E-mail ou mot de passe incorrect/.test(await page.locator('#view').innerText()), 'a wrong portal password is explained');
  await page.fill('#pl-email', 'hugo@example.com'); await page.fill('#pl-pass', 'bon-mot-de-passe'); await page.locator('#portalLogin .btn.pri').click();
  await page.waitForSelector('[data-a="portalwho"]');
  let pv = await page.locator('#view').innerText();
  ok(/Connecté au portal en tant que Hugo/.test(pv) && /1 modèle active/.test(pv), 'the portal account is linked');
  ok(/Reel playback hook/.test(pv) && /envoyé par Lucas/.test(pv) && /2 fichiers à regarder/.test(pv), 'what a model sent back is listed, with who asked for it');
  ok(/Story coulisses/.test(pv) && /envoyé par toi/.test(pv) && /En retard/.test(pv) && !/Brouillon caché/.test(pv), 'sent requests are listed, late ones flagged, drafts left out');
  ok(await page.locator('a.line[href="https://lvhcontentmanager.netlify.app/requests/11111111-1111-4111-8111-111111111111"]').count() >= 1, 'a request opens on its page in the portal');
  await page.locator('[data-a="portalwho"]', { hasText: 'Lucas' }).click();
  pv = await page.locator('.box', { hasText: 'Demandes envoyées' }).innerText();
  ok(/Reel playback hook/.test(pv) && !/Story coulisses/.test(pv), 'requests can be filtered by who sent them');
  await shot('9-portal-relie');
  await page.evaluate(() => { location.hash = 'dashboard'; }); await page.waitForSelector('.pt-mini');
  ok(/1\s*à valider/.test(await page.locator('.pt-mini').innerText()) && /Reel playback hook/.test(await page.locator('#view').innerText()), 'the dashboard shows what is waiting in the portal');
  await page.reload(); await page.waitForSelector('.pt-mini');
  ok(true, 'the link survives a reload');
  /* sync between the person's own devices: the computer sends everything, a phone signs in and finds it */
  await page.waitForFunction(() => AOS.sync.on() && !AOS.sync.busy && AOS.sync.pending() === 0 && AOS.sync.last > 0);
  ok(portal.crm.some(r => r.col === 'students' && r.data.name === 'Camille Test') && portal.crm.some(r => r.col === '_doc' && r.id === 'settings_agency') && portal.crm.every(r => r.user_id === 'u-hugo'), 'the computer sends its data to the account (' + portal.crm.length + ' records)');
  ok(/Synchronisé sur tes appareils/.test(await page.locator('#syncst').innerText()), 'the status line says the devices are in sync');
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const phone = await phoneCtx.newPage(); phone.on('pageerror', e => errors.push('phone: ' + e.message));
  await phone.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); await phone.route('https://togzyxnopontjwjkxcod.supabase.co/**', portalRoute);
  await phone.goto(base); await phone.waitForSelector('.hero');
  ok(await phone.evaluate(() => AOS.S.students.length === 0) && await phone.locator('.tabbar button').count() === 5, 'the phone starts empty and shows its tab bar');
  await phone.locator('.tabbar [data-a="menu"]').click(); await phone.locator('.syncbtn').click(); await phone.waitForSelector('#accountLogin');
  await phone.fill('#ac-email', 'hugo@example.com'); await phone.fill('#ac-pass', 'bon-mot-de-passe'); await phone.locator('#accountLogin .btn.pri').click();
  await phone.waitForFunction(() => AOS.S.students.length === 1 && AOS.sync.pending() === 0 && !AOS.sync.busy);
  ok(await phone.evaluate(() => AOS.S.students[0].name === 'Camille Test' && AOS.S.calls.length === 3 && AOS.S.goals.length === 1), 'after signing in, the phone has the data of the computer');
  await phone.locator('[data-a="accountclose"]').click();
  await phone.evaluate(() => AOS.save('tasks', { title: 'Noté depuis le téléphone', status: 'À faire', priority: 'Normale', due: AOS.today() }));
  await phone.waitForFunction(() => AOS.sync.pending() === 0 && !AOS.sync.busy);
  await page.evaluate(() => AOS.sync.now()); await page.waitForFunction(() => AOS.S.tasks.some(t => t.title === 'Noté depuis le téléphone'));
  ok(/Noté depuis le téléphone/.test(await page.locator('#view').innerText()), 'a task added on the phone appears on the computer');
  await page.evaluate(() => AOS.remove('tasks', AOS.S.tasks.find(t => t.title === 'Noté depuis le téléphone').id));
  await page.waitForFunction(() => AOS.sync.pending() === 0 && !AOS.sync.busy);
  await phone.evaluate(() => AOS.sync.now());
  ok(await phone.evaluate(() => !AOS.S.tasks.some(t => t.title === 'Noté depuis le téléphone')), 'a task deleted on the computer disappears from the phone');
  await phone.evaluate(() => { location.hash = 'dashboard'; window.scrollTo(0, 0); }); await phone.waitForTimeout(150);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on the phone dashboard');
  if (SHOTS) await phone.screenshot({ path: path.join(SHOTS, '10-telephone.png') });
  await phoneCtx.close();

  /* something new arrives in the portal: it shows up without touching anything */
  await page.waitForFunction(() => !AOS.portalLink.busy && AOS.portalLink.state === 'on');
  portal.requests.push({ id: '55555555-5555-4555-8555-555555555555', title: 'Nouvelle vidéo reçue', status: 'submitted', platform: 'tiktok', deadline: null, creator_id: 'c-jade', created_by: 'u-hugo', created_at: dAgo(1), updated_at: dAgo(0), submitted_at: dAgo(0), approved_at: null });
  await page.evaluate(() => { AOS.portalLink.at = 0; AOS.portalLink.tried = 0; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => /2\s*à valider/.test(document.querySelector('.pt-mini').innerText));
  ok(/Nouvelle vidéo reçue/.test(await page.locator('#view').innerText()), 'new returns from the models appear on their own');
  await page.waitForFunction(() => !AOS.portalLink.busy && AOS.portalLink.state === 'on');
  portal.role = 'creator'; await page.evaluate(() => AOS.portalRefresh()); await page.evaluate(() => { location.hash = 'portal'; }); await page.waitForSelector('#portalLogin');
  ok(/n'est pas un compte manager/.test(await page.locator('#view').innerText()) && await page.evaluate(() => localStorage.getItem('lvh.portal.cache') === null), 'a model account is refused and nothing stays on the device');
  portal.role = 'manager';

  /* every page of the menu renders without error */
  const keys = await page.evaluate(() => AOS.NAV_FLAT.filter(p => p.view).map(p => p.k));
  for (const k of keys) { await page.evaluate(h => { location.hash = h; }, k); await page.waitForTimeout(60); if (/Cette page a rencontré une erreur/.test(await page.locator('#view').innerText())) errors.push('view ' + k); }
  ok(errors.length === 0, 'no JavaScript error on any of the ' + keys.length + ' pages' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

  /* data survives a reload, and an older backup still imports */
  await page.evaluate(() => { location.hash = 'dashboard'; }); await page.reload(); await page.waitForSelector('.hero');
  ok(await page.evaluate(() => AOS.S.students.length === 1 && AOS.S.calls.length === 3), 'data is kept after a reload');
  ok(await page.evaluate(() => AOS.validateBackup({ app: 'agency-os', format: 1, schema: 5, data: {}, docs: {} }).errors.length === 0), 'a backup from the previous tool is accepted');

  /* phone width */
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { location.hash = 'portal'; }); await page.waitForSelector('.pt-pages');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on a phone');
  await shot('6-portal-mobile');

  await browser.close(); server.close();
  console.log(`\n${n - failed}/${n} checks passed`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
