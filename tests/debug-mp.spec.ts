import { test } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://db0i745ypndsx.cloudfront.net';

test('DEBUG COMPLETO - Capturar todo el flujo MP', async ({ page }) => {
  test.setTimeout(120000);

  const dir = 'tests/evidencia';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const networkLog: object[] = [];

  page.on('request', req => {
    networkLog.push({ type: 'REQUEST', method: req.method(), url: req.url() });
    if (req.url().includes('execute-api') || req.url().includes('purchase')) {
      console.log(`➡️  ${req.method()} ${req.url().substring(0, 100)}`);
    }
  });

  const purchaseResponses: object[] = [];
  page.on('response', async res => {
    const url = res.url();
    let body = '';
    try {
      if (url.includes('execute-api') || url.includes('purchase')) {
        body = await res.text();
      }
    } catch {}
    networkLog.push({ type: 'RESPONSE', status: res.status(), url, body: body.substring(0, 500) });
    if (url.includes('execute-api') || url.includes('purchase') || res.status() >= 400) {
      console.log(`⬅️  ${res.status()} ${url.substring(0, 100)}`);
      if (body) console.log(`    BODY: ${body.substring(0, 400)}`);
      if (url.includes('purchase')) {
        purchaseResponses.push({ url, status: res.status(), body });
        fs.writeFileSync(`${dir}/backend-response.json`, JSON.stringify({ url, status: res.status(), body }, null, 2));
      }
    }
  });

  page.on('console', msg => console.log(`🌐 BROWSER [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`💥 PAGE ERROR: ${err.message}`));

  // ── PASO 1: LOGIN ────────────────────────────────────────────────────────
  console.log('\n════ PASO 1: LOGIN ════');
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${dir}/01-login-page.png` });

  await page.fill('input[type="email"]', 'test@mercadopago.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL(/maestro\/dashboard|dashboard/, { timeout: 10000 });
    console.log('✅ Login exitoso → ' + page.url());
  } catch {
    await page.screenshot({ path: `${dir}/01-login-error.png` });
    console.log('❌ Login falló. URL actual: ' + page.url());
  }
  await page.screenshot({ path: `${dir}/02-after-login.png` });

  // ── PASO 2: CHECKOUT ─────────────────────────────────────────────────────
  console.log('\n════ PASO 2: CHECKOUT ════');
  await page.goto(`${BASE}/checkout?plan=grado`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${dir}/03-checkout.png` });

  const storage = await page.evaluate(() => ({
    token:     localStorage.getItem('token') ? 'PRESENTE' : 'AUSENTE',
    plan_type: localStorage.getItem('plan_type'),
    email:     (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').email; } catch { return 'ERR'; } })(),
  }));
  console.log('💾 localStorage:', JSON.stringify(storage));

  // ── PASO 3: CLICK PAGAR ──────────────────────────────────────────────────
  console.log('\n════ PASO 3: CLICK PAGAR ════');
  const payButton = page.locator([
    'button:has-text("Proceder al Pago")',
    'button:has-text("Pagar")',
    'button:has-text("Proceder")',
    'button[type="submit"]',
  ].join(', ')).first();

  const buttonVisible = await payButton.isVisible({ timeout: 5000 }).catch(() => false);
  if (!buttonVisible) {
    const buttons = await page.locator('button').allTextContents();
    console.log('⚠️ Botón de pago no encontrado. Botones en página:', buttons);
    await page.screenshot({ path: `${dir}/03-no-button.png` });
  } else {
    await payButton.click();
    console.log('✅ Click en botón de pago');
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${dir}/04-after-click.png` });
  console.log('📍 URL después del click: ' + page.url());

  // ── PASO 4: SEGUIR A MERCADO PAGO ────────────────────────────────────────
  console.log('\n════ PASO 4: SEGUIR A MERCADO PAGO ════');
  try {
    await page.waitForURL(/mercadopago/, { timeout: 15000 });
    const mpUrl = page.url();
    console.log('\n🔗 URL COMPLETA DE MERCADO PAGO:');
    console.log(mpUrl);
    fs.writeFileSync(`${dir}/mp-url.txt`, mpUrl);

    // Decodificar JWT (rtk param) para diagnóstico
    const rtkMatch = mpUrl.match(/rtk=([^&]+)/);
    if (rtkMatch) {
      const parts = rtkMatch[1].split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          console.log('\n🔍 JWT DECODIFICADO:');
          console.log(JSON.stringify(payload, null, 2));
          console.log(`\n⚠️  sandbox en JWT: ${payload.sandbox}`);
          fs.writeFileSync(`${dir}/jwt-payload.json`, JSON.stringify(payload, null, 2));
        } catch (e) {
          console.log('JWT no decodificable:', e);
        }
      }
    } else {
      console.log('ℹ️  No hay rtk param en la URL de MP');
      fs.writeFileSync(`${dir}/jwt-payload.json`, JSON.stringify({ note: 'No rtk param found', url: mpUrl.substring(0, 200) }));
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: `${dir}/05-mp-page.png` });
    console.log('📸 Screenshot de MP guardado: 05-mp-page.png');

  } catch (e) {
    console.log('❌ No redirigió a MP:', (e as Error).message);
    await page.screenshot({ path: `${dir}/04-no-mp-redirect.png` });
    fs.writeFileSync(`${dir}/mp-url.txt`, 'NO_REDIRECT - URL: ' + page.url());
    fs.writeFileSync(`${dir}/jwt-payload.json`, JSON.stringify({ error: 'No MP redirect' }));
  }

  fs.writeFileSync(`${dir}/network-log.json`, JSON.stringify(networkLog, null, 2));
  console.log('\n════ EVIDENCIA GUARDADA EN tests/evidencia/ ════');
});
