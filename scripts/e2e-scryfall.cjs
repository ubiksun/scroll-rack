// End-to-end check of the scryfall.com overlay with the REAL extension.
// Branded Chrome 136+ dropped --load-extension, but Playwright's Chrome for Testing still honours it, so this
// launches that binary with dist/ loaded, rates FRA #1 in the app page, then opens a scryfall card page and the
// set grid and counts the injected panel / badges. Screenshots land in $OUT (default .playwright-mcp/).
//   npm run build && npm run e2e          (launches a real browser window — run outside the Claude Code sandbox)
// PLAYWRIGHT / CHROME below are this machine's paths; override with env vars if they move.
const PLAYWRIGHT = process.env.PLAYWRIGHT || '/Users/ubik/.npm/_npx/9833c18b2d85bc59/node_modules/playwright';
const CHROME = process.env.CHROME || '/Users/ubik/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const { chromium } = require(PLAYWRIGHT);
const path = require('path'), fs = require('fs'), os = require('os');
(async () => {
  const dist = path.resolve('dist');
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-ext-'));
  const ctx = await chromium.launchPersistentContext(udd, {
    headless: false, viewport: { width: 1500, height: 950 },
    executablePath: CHROME,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-first-run', '--window-position=3000,3000'],
  });
  const out = {}, errors = [];
  try {
    let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = new URL(sw.url()).host; out.extId = id;
    const app = await ctx.newPage();
    app.on('pageerror', e => errors.push('app: ' + e.message));
    await app.goto(`chrome-extension://${id}/index.html`); await app.waitForTimeout(1500);
    out.version = await app.locator('.statusbar span').first().textContent();
    if (await app.locator('.modal.guide').count()) { await app.locator('.guide-nav button').first().click(); await app.waitForTimeout(200); }
    await app.locator('.topbar').getByRole('button').first().click(); await app.waitForTimeout(300);
    await app.locator('input[placeholder="filter sets…"]').fill('fra'); await app.waitForTimeout(400);
    await app.locator('.setrow').filter({ hasText: /Reality Fracture/ }).first().locator('button').last().click();
    for (let i = 0; i < 90; i++) { const st = await app.locator('.statusbar span').first().textContent(); if (/FRA: \d+ cards cached/.test(st)) break; await app.waitForTimeout(1000); }
    await app.mouse.click(700, 500); await app.waitForTimeout(500);
    await app.getByRole('button', { name: '⟲ layout' }).click(); await app.waitForTimeout(600);
    // rate FRA #1 (first card in collector order) as S in Limited
    await app.locator('.grid .card').first().click(); await app.waitForTimeout(400);
    out.rated = await app.locator('.panel h2').first().textContent();
    await app.locator('.panel .block .tiers button').first().click(); await app.waitForTimeout(500);
    out.tier = await app.locator('.panel .block .block-head .badge-inline').first().textContent().catch(() => null);
    // scryfall: single card page + set page
    const sf = await ctx.newPage();
    sf.on('pageerror', e => errors.push('sf: ' + e.message));
    await sf.goto('https://scryfall.com/card/fra/1', { waitUntil: 'domcontentloaded' }); await sf.waitForTimeout(4000);
    out.cardPage = { panel: await sf.locator('.lg-panel').count(), title: await sf.locator('.lg-panel .lg-title').textContent().catch(() => null), body: (await sf.locator('.lg-panel .lg-body').innerText().catch(() => '')).slice(0, 300) };
    await sf.screenshot({ path: (process.env.OUT || '.playwright-mcp') + '/ext-card.png' });
    await sf.goto('https://scryfall.com/sets/fra', { waitUntil: 'domcontentloaded' }); await sf.waitForTimeout(5000);
    out.setPage = { badges: await sf.locator('.lg-badge, .lg-badges .lg-badge, [class*="lg-badge"]').count(), sample: await sf.locator('[class*="lg-badge"]').first().textContent().catch(() => null) };
    await sf.screenshot({ path: (process.env.OUT || '.playwright-mcp') + '/ext-set.png' });
  } catch (e) { out.error = String(e).slice(0, 500); }
  console.log(JSON.stringify({ out, errors }, null, 1));
  await ctx.close();
})();
