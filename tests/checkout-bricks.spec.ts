import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://db0i745ypndsx.cloudfront.net';
const DIR  = 'tests/bricks';

// Use any non-MP-account email as payer
const BUYER_EMAIL = 'buyer@example.com';

test('Checkout Bricks - pago con tarjeta', async ({ page }) => {
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
    if (url.includes('/purchase') || url.includes('execute-api')) {
      try {
        const body = await res.text();
        console.log(`📡 ${res.status()} ${url.substring(0, 60)}`);
        if (body.length < 500) console.log(`   ${body}`);
      } catch {}
    }
  });

  page.on('console', (msg) => {
    const txt = msg.text();
    if (txt.includes('Brick') || txt.includes('CHECKOUT') || txt.includes('Respuesta') ||
        txt.includes('Método') || msg.type() === 'error') {
      console.log(`🌐 [${msg.type()}] ${txt.substring(0, 200)}`);
    }
  });

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  console.log('\n1️⃣  Login...');
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'test@mercadopago.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|maestro\/dashboard)$/, { timeout: 10000 });
  console.log(`✅ Login OK → ${page.url()}`);

  // ── CHECKOUT ───────────────────────────────────────────────────────────────
  console.log('\n2️⃣  Abriendo checkout con Bricks...');
  await page.goto(`${BASE}/checkout?plan=grado`);
  await page.waitForLoadState('networkidle');

  // Payment Brick tarda ~5-8 s en renderizar
  console.log('Esperando que el Payment Brick renderice...');
  await page.waitForTimeout(8000);
  await shot('01-brick-cargado');

  const brickContainer = page.locator('#payment-brick-container');
  const brickVisible = await brickContainer.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`Payment Brick container visible: ${brickVisible ? '✅' : '❌'}`);
  expect(brickVisible, 'Payment Brick container should be visible').toBe(true);

  // Log frames para diagnóstico
  const frames = page.frames();
  console.log(`\nFrames (${frames.length}):`);
  for (const f of frames) {
    if (f.url() && !f.url().startsWith('about:')) {
      console.log(`  ${f.url().substring(0, 90)}`);
    }
  }

  await shot('02-brick-opciones');

  // ── SELECCIONAR TARJETA DE CRÉDITO ─────────────────────────────────────────
  console.log('\n3️⃣  Seleccionando "Tarjeta de crédito"...');

  // The Brick renders a method picker; click the credit card option
  const creditCardSelectors = [
    'text=Tarjeta de crédito',
    'label:has-text("Tarjeta de crédito")',
    '[data-testid="credit_card"]',
    'input[value="credit_card"]',
  ];
  let methodSelected = false;
  for (const sel of creditCardSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      methodSelected = true;
      console.log(`✅ Seleccionado via: ${sel}`);
      break;
    }
    // Also try inside all frames
    for (const frame of page.frames()) {
      const fel = frame.locator(sel).first();
      if (await fel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fel.click();
        methodSelected = true;
        console.log(`✅ Seleccionado (frame) via: ${sel}`);
        break;
      }
    }
    if (methodSelected) break;
  }
  console.log(`Método seleccionado: ${methodSelected ? '✅' : '⚠️ (puede ser auto-seleccionado)'}`);

  // Wait for card input iframes to appear after method selection
  await page.waitForTimeout(3000);
  await shot('03-metodo-seleccionado');

  // Log frames now (should have card input iframes)
  const framesAfter = page.frames();
  console.log(`\nFrames después de seleccionar (${framesAfter.length}):`);
  for (const f of framesAfter) {
    if (f.url() && !f.url().startsWith('about:')) {
      console.log(`  ${f.url().substring(0, 90)}`);
    }
  }

  // ── LLENAR TARJETA ─────────────────────────────────────────────────────────
  // The Brick renders 3 secure-fields.mercadopago.com iframes (card, expiry, CVV).
  // Target them by URL pattern in order — they have no meaningful placeholders.
  console.log('\n4️⃣  Llenando datos de tarjeta...');

  const secureFrames = page.frames().filter((f) => f.url().includes('secure-fields.mercadopago.com'));
  console.log(`secure-fields iframes: ${secureFrames.length}`);

  // iframe 0 = card number, 1 = expiry, 2 = CVV
  let cardFilled = false;
  let expFilled  = false;
  let cvvFilled  = false;

  // Use page.frameLocator() with nth-of-type to target each secure-fields iframe
  // by DOM position inside the brick container. This avoids cross-origin isVisible()
  // issues since frameLocator re-queries on every access.
  const brickIframes = page.locator('#payment-brick-container iframe[src*="secure-fields"]');
  const iframeCount  = await brickIframes.count().catch(() => 0);
  console.log(`secure-fields iframes via locator: ${iframeCount}`);

  // Helper: fill an input inside the nth secure-fields iframe
  async function fillSecureField(index: number, value: string, label: string): Promise<boolean> {
    try {
      const frameLocator = page.frameLocator(`#payment-brick-container iframe[src*="secure-fields"]:nth-of-type(${index + 1})`);
      const inp = frameLocator.locator('input').first();
      await inp.click({ timeout: 5000 });
      await inp.pressSequentially(value, { delay: 80 });
      await page.waitForTimeout(500);
      const val = await inp.inputValue().catch(() => '?');
      console.log(`✅ ${label}: "${val.substring(0, 12)}"`);
      return true;
    } catch (err: any) {
      // Fallback: try via page.frames() without isVisible check
      const frames = page.frames().filter((f) => f.url().includes('secure-fields.mercadopago.com'));
      if (frames.length > index) {
        try {
          const inp = frames[index].locator('input').first();
          await inp.click({ timeout: 3000, force: true });
          await inp.pressSequentially(value, { delay: 80 });
          await page.waitForTimeout(500);
          const val = await inp.inputValue().catch(() => '?');
          console.log(`✅ ${label} (fallback): "${val.substring(0, 12)}"`);
          return true;
        } catch (e2: any) {
          console.log(`⚠️  ${label} fallback failed: ${e2.message?.substring(0, 80)}`);
        }
      }
      console.log(`⚠️  ${label} not filled: ${err.message?.substring(0, 80)}`);
      return false;
    }
  }

  cardFilled = await fillSecureField(0, '5474925432670366', 'Número tarjeta');
  await page.waitForTimeout(2000); // wait for card brand detection + potential iframe refresh

  // After typing card number the focus auto-advances to expiry.
  // Use Tab + type to reach expiry and CVV without needing to click their iframes.
  // pressSequentially works on whichever element currently has focus.
  try {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await page.keyboard.type('1130', { delay: 100 });
    await page.waitForTimeout(500);
    console.log('✅ Vencimiento (Tab+type)');
    expFilled = true;
  } catch (e: any) {
    console.log(`⚠️  Vencimiento Tab failed: ${e.message?.substring(0, 60)}`);
    expFilled = await fillSecureField(1, '1130', 'Vencimiento');
  }

  try {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await page.keyboard.type('123', { delay: 100 });
    await page.waitForTimeout(500);
    console.log('✅ CVV (Tab+type)');
    cvvFilled = true;
  } catch (e: any) {
    console.log(`⚠️  CVV Tab failed: ${e.message?.substring(0, 60)}`);
    cvvFilled = await fillSecureField(2, '123', 'CVV');
  }

  // Cardholder name — in main DOM (not iframe), placeholder is a sample name
  let nameFilled = false;
  const nameInputs = await page.locator('input:not([type="email"]):not([type="radio"]):not([type="checkbox"])').all();
  for (const inp of nameInputs) {
    const ph  = await inp.getAttribute('placeholder').catch(() => '');
    const val = await inp.inputValue().catch(() => '');
    // Brick uses a realistic example name as placeholder, e.g. "María Clara López Roldán"
    if (ph && ph.includes(' ') && !val && !ph.match(/MM|CVV|@|\d{4}/)) {
      await inp.fill('APRO');
      console.log(`✅ Nombre: APRO`);
      nameFilled = true;
      break;
    }
  }
  if (!nameFilled) console.log('⚠️  Campo nombre no encontrado en DOM principal');

  // Email del pagador — required by Brick
  const emailInputs = await page.locator('input[type="email"]').all();
  for (const inp of emailInputs) {
    const val = await inp.inputValue().catch(() => '');
    if (!val) {
      await inp.fill(BUYER_EMAIL);
      console.log(`✅ Email pagador: ${BUYER_EMAIL}`);
      break;
    }
  }

  await page.waitForTimeout(2000);
  await shot('04-formulario-lleno');

  // ── PAGAR ──────────────────────────────────────────────────────────────────
  console.log('\n5️⃣  Pagando...');

  const paySelectors = [
    'button:has-text("Pagar")',
    'button:has-text("Continuar")',
    '[data-testid="main-action-button"]',
    'button[type="submit"]:not([disabled])',
  ];

  let paid = false;

  // Buscar en la página principal
  for (const sel of paySelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const disabled = await btn.isDisabled().catch(() => false);
      const txt      = await btn.textContent().catch(() => '');
      console.log(`Botón encontrado: "${txt?.trim()}" disabled:${disabled}`);
      if (!disabled) {
        await btn.click();
        paid = true;
        console.log('✅ Click en pagar');
        break;
      }
    }
  }

  // Buscar en iframes si no encontró
  if (!paid) {
    for (const frame of page.frames()) {
      for (const sel of paySelectors) {
        const btn = frame.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          const disabled = await btn.isDisabled().catch(() => false);
          if (!disabled) {
            await btn.click();
            paid = true;
            console.log('✅ Click en pagar (iframe)');
            break;
          }
        }
      }
      if (paid) break;
    }
  }

  if (!paid) {
    console.log('⚠️  No se encontró botón de pago activo');
  }

  await page.waitForTimeout(10000);
  await shot('05-post-pago');

  // ── RESULTADO ──────────────────────────────────────────────────────────────
  console.log('\n6️⃣  Verificando resultado...');
  const finalUrl  = page.url();
  const finalText = await page.innerText('body').catch(() => '');

  const exitoso = finalUrl.includes('success')
    || finalText.toLowerCase().includes('aprobado')
    || finalText.toLowerCase().includes('exitoso');

  console.log(`URL final: ${finalUrl}`);
  console.log(`Pago exitoso: ${exitoso ? '✅' : '❌'}`);
  if (!exitoso) {
    console.log(`Texto (primeros 300 chars): ${finalText.substring(0, 300)}`);
    await shot('04b-error-pago');
  }

  // ── VERIFICAR DASHBOARD ────────────────────────────────────────────────────
  console.log('\n7️⃣  Verificando plan en maestro dashboard...');
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/maestro/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot('05-maestro-dashboard');

  const dashText = await page.innerText('body').catch(() => '');
  const planFinal = dashText.toLowerCase().includes('grado') ? 'grado'
    : dashText.toLowerCase().includes('pro') ? 'pro'
    : 'gratuito';
  const hayErrores = dashText.toLowerCase().includes('error al cargar');

  console.log(`Plan: ${planFinal}`);
  console.log(`Errores dashboard: ${hayErrores ? '❌ SÍ' : '✅ no'}`);

  expect(hayErrores, 'No debe haber errores en maestro dashboard').toBe(false);

  // ── RESUMEN ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('  RESUMEN CHECKOUT BRICKS');
  console.log('════════════════════════════════════════');
  console.log(`  Brick visible:     ${brickVisible ? '✅' : '❌'}`);
  console.log(`  Número tarjeta:    ${cardFilled   ? '✅' : '❌'}`);
  console.log(`  Vencimiento:       ${expFilled    ? '✅' : '❌'}`);
  console.log(`  CVV:               ${cvvFilled    ? '✅' : '❌'}`);
  console.log(`  Pago exitoso:      ${exitoso      ? '✅' : '❌'}`);
  console.log(`  Plan dashboard:    ${planFinal}`);
  console.log(`  Errores:           ${hayErrores   ? '❌' : '✅'}`);
  console.log('════════════════════════════════════════');
  console.log('\nScreenshots:');
  fs.readdirSync(DIR).sort().forEach((f) => console.log(`  📸 ${f}`));
});
