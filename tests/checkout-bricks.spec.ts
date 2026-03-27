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

  // ── LLENAR TARJETA ─────────────────────────────────────────────────────────
  console.log('\n3️⃣  Llenando datos de tarjeta...');

  let cardFilled = false;
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph    = await inp.getAttribute('placeholder').catch(() => '');
      const label = await inp.getAttribute('aria-label').catch(() => '');
      if (ph?.match(/número|tarjeta|1234/i) || label?.match(/card.?number/i)) {
        await inp.click();
        await page.keyboard.type('5474925432670366', { delay: 80 });
        await page.waitForTimeout(1500);
        const val = await inp.inputValue().catch(() => '');
        console.log(`✅ Número tarjeta: "${val.substring(0, 8)}..."`);
        cardFilled = true;
        break;
      }
    }
    if (cardFilled) break;
  }

  let expFilled = false;
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph?.match(/MM|venc|fecha/i)) {
        await inp.click();
        await page.keyboard.type('1130', { delay: 100 });
        console.log('✅ Vencimiento ingresado');
        expFilled = true;
        break;
      }
    }
    if (expFilled) break;
  }

  let cvvFilled = false;
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph?.match(/CVV|CVC|segur/i)) {
        await inp.click();
        await page.keyboard.type('123', { delay: 100 });
        console.log('✅ CVV ingresado');
        cvvFilled = true;
        break;
      }
    }
    if (cvvFilled) break;
  }

  // Nombre del titular
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input').all();
    for (const inp of inputs) {
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (ph?.match(/nombre|titular/i)) {
        await inp.fill('APRO');
        console.log('✅ Nombre: APRO');
        break;
      }
    }
  }

  // Email del pagador (requerido por el Brick)
  for (const frame of page.frames()) {
    const inputs = await frame.locator('input[type="email"]').all();
    for (const inp of inputs) {
      const val = await inp.inputValue().catch(() => '');
      if (!val || val === '') {
        await inp.fill(BUYER_EMAIL);
        console.log(`✅ Email pagador: ${BUYER_EMAIL}`);
        break;
      }
    }
  }

  await page.waitForTimeout(2000);
  await shot('03-formulario-lleno');

  // ── PAGAR ──────────────────────────────────────────────────────────────────
  console.log('\n4️⃣  Pagando...');

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
  await shot('04-post-pago');

  // ── RESULTADO ──────────────────────────────────────────────────────────────
  console.log('\n5️⃣  Verificando resultado...');
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
  console.log('\n6️⃣  Verificando plan en maestro dashboard...');
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
