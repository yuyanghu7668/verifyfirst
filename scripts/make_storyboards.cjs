/*
 * Builds the three storyboard figures from the walkthrough screenshots.
 * Run scripts/capture_screenshots.cjs first, then: node scripts/make_storyboards.cjs
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'screens');
const OUT = path.join(ROOT, 'docs', 'storyboards');
fs.mkdirSync(OUT, { recursive: true });

const BOARDS = [
  {
    file: 'storyboard-1-correct-flag.png',
    title: 'Storyboard 1 · The AI flag is right (condition B: AI explanation)',
    panels: [
      ['el-p1-email', 'Goal and action: the student wants to keep access and clicks “Verify my account”.', ['Person acts', 'Gulf of execution', 'Signifier: the email’s button']],
      ['el-p1-warning', 'System inference and action: at the click, the warning shows where the link really goes.', ['System acts', 'Narrows gulf of evaluation', 'Hit']],
      ['el-portal', 'Recovery: the student checks a trusted source. The account is active and no suspension is listed.', ['Person acts', 'Independent check', 'Signifier: top-bar portal']],
      ['el-p1-listitem', 'Result: the student reports the email. The choice, the portal check and the timing are logged.', ['Person decides', 'Outcome logged']]
    ]
  },
  {
    file: 'storyboard-2-ai-errors.png',
    title: 'Storyboard 2 · When the AI is wrong (condition B)',
    panels: [
      ['el-g2-warning', 'A genuine MFA email is flagged. The warning shows medium confidence and that the link is a university address.', ['System acts', 'False alarm', 'Confidence shown']],
      ['el-g2-portal-actions', 'The portal lists the MFA request, so the student overrules the warning, follows the link and keeps the email.', ['Person overrules', 'Recovery']],
      ['el-p3-email', 'The “unusual sign-in” phishing email is not flagged, so no warning appears.', ['System silent', 'Miss']],
      ['el-p3-statusbar', 'Hovering the button shows the real address in the status bar. The student reports the email.', ['Person acts', 'Knowledge in the world', 'Signifier: status bar']]
    ]
  },
  {
    file: 'storyboard-3-generic-condition.png',
    title: 'Storyboard 3 · Comparison condition A: generic warning',
    panels: [
      ['el-p1-generic-warning', 'Same email, generic warning: no checkable detail and no portal suggestion.', ['System acts', 'Gulf of evaluation stays wide']],
      ['el-p1-generic-followed', 'The student opens the link anyway. Nothing loads and nothing is collected.', ['Person acts', 'Unsafe choice']],
      ['el-a-metrics', 'The researcher panel records one unsafe link choice (values from the automated walkthrough, not a participant).', ['Outcome logged'], 'wide']
    ]
  }
];

function img(name) {
  return 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, name + '.png')).toString('base64');
}

function html(board) {
  const panels = board.panels.map(([shot, caption, tags, wide], i) => `
    <figure class="${wide || ''}">
      <figcaption><span class="n">${i + 1}</span><span>${caption}<span class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</span></span></figcaption>
      <div class="frame"><img src="${img(shot)}"></div>
    </figure>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2328; background: #fff; }
    .board { width: 1600px; padding: 32px; box-sizing: border-box; }
    h1 { font-size: 30px; margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    figure { margin: 0; border: 2px solid #d9dde3; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    figure.wide { grid-column: 1 / -1; }
    figcaption { display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; font-size: 24px; line-height: 1.3; border-bottom: 2px solid #eef0f3; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .tag { font-size: 18px; font-weight: 600; padding: 3px 12px; border-radius: 999px; background: #e8eefb; color: #1d3f8f; }
    .n { flex: none; width: 40px; height: 40px; border-radius: 50%; background: #2451b8; color: #fff; font-weight: 700; display: grid; place-items: center; font-size: 22px; }
    .frame { background: #f4f5f7; padding: 18px; display: grid; place-items: center; flex: 1; }
    .frame img { max-width: 100%; max-height: 560px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
  </style></head><body><div class="board"><h1>${board.title}</h1><div class="grid">${panels}</div></div></body></html>`;
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  for (const board of BOARDS) {
    await page.setContent(html(board));
    await page.locator('.board').screenshot({ path: path.join(OUT, board.file) });
    console.log('wrote', board.file);
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
