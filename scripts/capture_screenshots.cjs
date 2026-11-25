/*
 * Automated walkthrough: drives the prototype through the storyboard scenarios,
 * checks the logged outcomes, and saves screenshots to docs/screens/.
 *
 *   npm install playwright        (once)
 *   npx playwright install chromium   (or set CHROME_PATH to an installed Chrome)
 *   node scripts/capture_screenshots.cjs
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
  const el = (sel, name) => page.locator(sel).first().screenshot({ path: path.join(OUT, 'el-' + name + '.png') });
  const open = async subject => { await page.getByRole('button', { name: new RegExp(subject) }).first().click(); };

  // ---------- Condition B: AI explanation ----------
  await page.goto(URL + '?pid=DEMO-B&condition=explained');
  await shot('00-start');
  await page.getByRole('button', { name: 'Start' }).click();
  await shot('01-inbox');

  // Storyboard 1: correct flag (P1)
  await open('Account suspension notice');
  await page.hover('#mail-link');
  await page.waitForTimeout(700);
  await shot('10-p1-email');
  await el('.message', 'p1-email');
  await page.click('#mail-link');
  await shot('11-p1-warning');
  await el('.modal', 'p1-warning');
  await page.click('#w-why summary');
  await shot('12-p1-warning-why');
  await page.click('#w-portal');
  await shot('13-portal');
  await el('.portal-grid', 'portal');
  await page.click('#back-mail');
  await page.click('[data-decision="report"]');
  await shot('14-p1-reported');
  await el('.mail-item[data-id="P1"]', 'p1-listitem');

  // Storyboard 2: false alarm (G2)
  await open('Set up multi-factor');
  await page.click('#mail-link');
  await shot('20-g2-warning');
  await el('.modal', 'g2-warning');
  await page.click('#w-portal');
  await shot('21-g2-portal');
  await el('.portal-grid .wide', 'g2-portal-actions');
  await page.click('#back-mail');
  await page.click('#mail-link');
  await page.click('#w-continue');
  await shot('22-g2-followed');
  await el('.modal', 'g2-followed');
  await page.click('#ext-back');
  await page.click('[data-decision="keep"]');
  await shot('23-g2-kept');
  await el('.mail-item[data-id="G2"]', 'g2-listitem');

  // Missed phishing (P3): no warning, but the status bar shows the real address
  await open('Unusual sign-in');
  await page.hover('#mail-link');
  await page.waitForTimeout(700);
  await shot('30-p3-hover');
  await el('.message', 'p3-email');
  await el('#status-bar', 'p3-statusbar');
  await page.click('[data-decision="report"]');

  // P2: look-alike address
  await open('Mailbox storage full');
  await page.click('#mail-link');
  await shot('40-p2-warning');
  await el('.modal', 'p2-warning');
  await page.click('#w-back');
  await page.click('[data-decision="delete"]');

  const m = await page.evaluate(() => window.VerifyFirst.metrics());
  const row = id => m.perEmail.find(r => r.emailId === id);
  assert.equal(row('P1').correct, true);
  assert.equal(row('P1').verifiedInPortal, true);
  assert.equal(row('G2').correct, true);
  assert.equal(row('G2').rejectedGenuine, false);
  assert.equal(row('P3').hoveredLink, true);
  assert.equal(row('P3').correct, true);
  assert.equal(m.summary.unsafeLinkChoices, 0);

  await page.click('#finish');
  await shot('50-finish-confirm');
  await page.click('#f-ok');
  await shot('51-debrief');
  await page.locator('.researcher').scrollIntoViewIfNeeded();
  await shot('52-researcher');

  // ---------- Condition A: generic warning ----------
  await page.goto(URL + '?pid=DEMO-A&condition=generic');
  await page.getByRole('button', { name: 'Start' }).click();
  await open('Account suspension notice');
  await page.click('#mail-link');
  await shot('60-p1-generic-warning');
  await el('.modal', 'p1-generic-warning');
  await page.click('#w-continue');
  await shot('61-p1-generic-followed');
  await el('.modal', 'p1-generic-followed');
  const mA = await page.evaluate(() => window.VerifyFirst.metrics());
  assert.equal(mA.summary.unsafeLinkChoices, 1);
  await page.click('#ext-back');
  await page.click('[data-decision="keep"]');
  await page.click('#finish');
  await page.click('#f-ok');
  await page.locator('.researcher').scrollIntoViewIfNeeded();
  await el('.researcher .metrics', 'a-metrics');

  await browser.close();
  console.log('Walkthrough passed. Screenshots in', path.relative(ROOT, OUT));
})().catch(err => { console.error(err); process.exit(1); });
