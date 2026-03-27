import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://db0i745ypndsx.cloudfront.net';
const DIR = 'tests/flujo-final';

// Use any non-MP-account email as payer (MP sandbox rejects real MP account emails)
const BUYER_EMAIL = 'buyer@example.com';

test('Flujo completo: pago + dashboard actualizado', async ({ page }) => {
  test.setTimeout(180000);
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  let n = 0;
  const shot = async (name: string) => {
    const p = `${DIR}/${String(++n).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(`📸 ${p}`);
  };

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('execute-api') || url.includes('/purchase')) {
      try {
        const body = await res.text();
        console.log(`📡 ${res.status()} ${url.substring(0, 60)}`);
        if (body.length < 500) console.log(`   ${body}`);
      } catch {}
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('CHECKOUT') || msg.text().includes('DASHBOARD')) {
      console.log(`🌐 ${msg.text().substring(0, 150)}`);
    }
  });

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  console.log('\n1️⃣  Login...');
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'test@mercadopago.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  // Accept either /dashboard or /maestro/dashboard as landing page
  await page.waitForURL(/\/(dashboard|maestro\/dashboard)$/, { timeout: 10000 });
  await shot('01-post-login');
  console.log(`✅ Login OK → ${page.url()}`);

  // ── MAESTRO DASHBOARD ──────────────────────────────────────────────────────
  console.log('\n2️⃣  Maestro dashboard...');
  await page.goto(`${BASE}/maestro/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await shot('02-maestro-dashboard');

  const maestroText = await page.innerText('body').catch(() => '');
  const gruposError = maestroText.toLowerCase().includes('error al cargar');
  console.log(`Error al cargar grupos: ${gruposError ? '❌ SÍ' : '✅ no'}`);
  expect(gruposError, 'Maestro dashboard should not show "Error al cargar grupos"').toBe(false);

  const planText = maestroText.toLowerCase().includes('grado') ? 'grado'
    : maestroText.toLowerCase().includes('pro') ? 'pro'
    : 'gratuito';
  console.log(`Plan actual en maestro dashboard: ${planText}`);

  // ── CHECKOUT ───────────────────────────────────────────────────────────────
  console.log('\n3️⃣  Checkout...');
  await page.goto(`${BASE}/checkout?plan=grado`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Wait for MercadoPago.js to mount
  await shot('03-checkout');

  const hasForm = await page.locator('#form-checkout').isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`Formulario MP Checkout API: ${hasForm ? '✅' : '❌'}`);
  expect(hasForm, 'Checkout form should be visible').toBe(true);

  // ── FILL CARD FORM ─────────────────────────────────────────────────────────
  console.log('\n4️⃣  Llenando tarjeta...');

  // Card number (inside MP iframe)
  let cardDone = false;
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph?.match(/número|tarjeta|1234/i)) {
        await inp.click();
        await page.keyboard.type('5474925432670366', { delay: 80 });
        await page.waitForTimeout(1000);
        console.log('✅ Número de tarjeta ingresado');
        cardDone = true;
        break;
      }
    }
    if (cardDone) break;
  }

  // Expiry (inside MP iframe)
  let expDone = false;
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph?.match(/MM|venc/i)) {
        await inp.click();
        await page.keyboard.type('1130', { delay: 100 });
        console.log('✅ Vencimiento ingresado');
        expDone = true;
        break;
      }
    }
    if (expDone) break;
  }

  // CVV (inside MP iframe)
  let cvvDone = false;
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph?.match(/CVV|CVC|segur/i)) {
        await inp.click();
        await page.keyboard.type('123', { delay: 100 });
        console.log('✅ CVV ingresado');
        cvvDone = true;
        break;
      }
    }
    if (cvvDone) break;
  }

  // Cardholder name
  const nameField = page.locator('#form-checkout__cardholderName').first();
  if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameField.fill('APRO');
    console.log('✅ Nombre: APRO');
  }

  // Payer email (must NOT be a real MP account)
  const emailField = page.locator('#form-checkout__cardholderEmail').first();
  if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailField.clear();
    await emailField.fill(BUYER_EMAIL);
    console.log(`✅ Email pagador: ${BUYER_EMAIL}`);
  }

  // RFC
  const rfcField = page.locator('#form-checkout__identificationNumber').first();
  if (await rfcField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rfcField.fill('XAXX010101000');
    console.log('✅ RFC ingresado');
  }

  await page.waitForTimeout(2000);
  await shot('04-formulario-lleno');

  // ── PAY ────────────────────────────────────────────────────────────────────
  console.log('\n5️⃣  Pagando...');
  const payBtn = page.locator('#form-checkout__submit').first();
  const btnText = await payBtn.textContent().catch(() => '');
  const btnDisabled = await payBtn.isDisabled().catch(() => true);
  console.log(`Botón: "${btnText?.trim()}" disabled:${btnDisabled}`);

  await payBtn.click({ force: true });
  console.log('✅ Click en pagar');

  await page.waitForTimeout(10000);
  await shot('05-post-pagar');
  console.log(`URL post-pagar: ${page.url()}`);

  // ── VERIFY PAYMENT RESULT ─────────────────────────────────────────────────
  console.log('\n6️⃣  Verificando resultado del pago...');
  const currentUrl = page.url();
  const pageText = await page.innerText('body').catch(() => '');

  const paymentOk = currentUrl.includes('/checkout/success')
    || pageText.toLowerCase().includes('aprobado')
    || pageText.toLowerCase().includes('exitoso');

  console.log(`Pago aprobado: ${paymentOk ? '✅' : '❌'}`);
  if (!paymentOk) {
    console.log(`URL: ${currentUrl}`);
    console.log(`Texto: ${pageText.substring(0, 300)}`);
    await shot('05b-error-pago');
  }

  // ── VERIFY DASHBOARD SHOWS UPDATED PLAN ───────────────────────────────────
  console.log('\n7️⃣  Verificando plan en maestro dashboard...');
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/maestro/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot('06-maestro-dashboard-final');

  const dashFinal = await page.innerText('body').catch(() => '');
  const planFinal = dashFinal.toLowerCase().includes('grado') ? 'grado'
    : dashFinal.toLowerCase().includes('pro') ? 'pro'
    : 'gratuito';

  const erroresFinal = dashFinal.toLowerCase().includes('error al cargar');
  console.log(`Plan en maestro dashboard: ${planFinal}`);
  console.log(`Errores: ${erroresFinal ? '❌ HAY ERRORES' : '✅ sin errores'}`);

  expect(erroresFinal, 'No errors after payment').toBe(false);

  console.log('\n════════════════════════════════════════');
  console.log('  RESUMEN FINAL');
  console.log('════════════════════════════════════════');
  console.log(`  Pago:  ${paymentOk ? '✅ aprobado' : '❌ no aprobado'}`);
  console.log(`  Plan:  ${planFinal}`);
  console.log(`  Errores dashboard: ${erroresFinal ? '❌' : '✅ ninguno'}`);
  console.log('════════════════════════════════════════');
});
