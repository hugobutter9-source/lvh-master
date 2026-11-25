/* Smoke test: serves src/, drives the app in local mode and checks the main flows.
   Run: node tests/smoke.js   (needs Playwright with Chromium) */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'src'), SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
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
  await page.goto(base); await page.waitForSelector('.hero');
  ok(await page.title() === 'LVH Master', 'title is LVH Master');
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
  ok(/10[\s  ]350/.test(await page.locator('#finN').innerText()) && /▲ 15 %/.test(await page.locator('#finD').innerText()), 'revenue headline shows this month and the change');
  await page.locator('#finPlot').scrollIntoViewIfNeeded();
  const box = await page.locator('#finPlot').boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + 40);
  ok(/7[\s  ]400/.test(await page.locator('#finN').innerText()), 'moving along the line shows that month');
  await page.mouse.move(box.x + box.width / 2, box.y - 60);
  ok(/10[\s  ]350/.test(await page.locator('#finN').innerText()), 'leaving the chart restores this month');
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
