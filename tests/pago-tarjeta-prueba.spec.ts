import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://db0i745ypndsx.cloudfront.net';
const DIR  = 'tests/evidencia-tarjeta';

// Tarjetas de prueba oficiales MP sandbox (MLM Mexico)
// Mastercard APRO (aprobada): 5474 9254 3267 0366
const CARD_NUMBER = '5474925432670366';
const CARD_EXP    = '1130';   // MMYY sin barra
const CARD_CVV    = '123';
const CARD_NAME   = 'APRO';   // nombre especial para aprobar pago

test('Pago con tarjeta de prueba MP sandbox', async ({ page }) => {
  test.setTimeout(240000);
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  let n = 0;
  const shot = async (name: string) => {
    const p = `${DIR}/${String(++n).padStart(2,'0')}-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(`📸 ${p}`);
  };

  const navLog: string[] = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navLog.push(frame.url());
      console.log(`🔗 ${frame.url().substring(0, 100)}`);
    }
  });

  page.on('response', async res => {
    const u = res.url();
    if (u.includes('execute-api') || u.includes('/purchase')) {
      try {
        const body = await res.text();
        console.log(`📡 ${res.status()} ${u.substring(0, 80)}`);
        if (body.length < 400) console.log(`   ${body}`);
      } catch {}
    }
  });

  // ── 1. LOGIN ──────────────────────────────────────
  console.log('\n══ 1. LOGIN ══');
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await shot('login');

  await page.fill('input[type="email"]', 'test@mercadopago.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');

  await page.waitForURL(/maestro\/dashboard|\/dashboard/, { timeout: 15000 });
  await shot('dashboard');
  console.log('✅ Login OK →', page.url());

  // ── 2. CHECKOUT ───────────────────────────────────
  console.log('\n══ 2. CHECKOUT ══');
  await page.goto(`${BASE}/checkout?plan=grado`);
  await page.waitForLoadState('networkidle');
  await shot('checkout');

  await page.locator('button:has-text("Proceder al Pago")').first().click();
  console.log('✅ Click Proceder al Pago');

  // ── 3. ESPERAR SANDBOX MP ─────────────────────────
  console.log('\n══ 3. SANDBOX MP ══');
  await page.waitForURL(/mercadopago/, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await shot('mp-cargado');
  console.log('URL MP:', page.url().substring(0, 80));

  // ── 4. SELECCIONAR NUEVA TARJETA ──────────────────
  console.log('\n══ 4. SELECCIONAR NUEVA TARJETA ══');

  // El MP sandbox muestra un payment-option-form con opciones
  const newCardBtn = page.locator('button:has-text("Nueva Tarjeta"), button:has-text("Nueva tarjeta")').first();
  if (await newCardBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    console.log('✅ Click Nueva Tarjeta');
    await newCardBtn.click();
    await page.waitForTimeout(2000);
    await shot('nueva-tarjeta-click');
  } else {
    console.log('ℹ️  No hay selector de opciones — directo al formulario');
    // Mostrar qué hay en la página
    const btns = await page.locator('button').allTextContents();
    console.log('Botones:', btns.filter(t => t.trim()).slice(0, 10));
    await shot('mp-sin-opciones');
  }

  // ── 5. LLENAR FORMULARIO DE TARJETA ───────────────
  console.log('\n══ 5. FORMULARIO TARJETA ══');
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot('card-form-inicial');

  // Nombre del titular (campo normal, fuera de iframe)
  const nameField = page.locator('#cardholderName, input[name="cardholderName"], input[placeholder*="NOMBRE"], input[placeholder*="nombre"], input[placeholder*="titular"]').first();
  if (await nameField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameField.fill(CARD_NAME);
    console.log('✅ Nombre:', CARD_NAME);
  } else {
    console.log('⚠️  Campo nombre no encontrado');
  }

  // MP usa SecureFields (iframes) para número, vencimiento y CVV
  const secureFrames = page.frames().filter(f => f.url().includes('secure-fields.mercadopago'));
  console.log(`SecureFrames: ${secureFrames.length}`);

  if (secureFrames.length >= 3) {
    // Frame 0 = número, Frame 1 = vencimiento, Frame 2 = CVV
    const sfData: [number, string, string][] = [
      [0, CARD_NUMBER, 'número'],
      [1, CARD_EXP,    'vencimiento'],
      [2, CARD_CVV,    'CVV'],
    ];

    for (const [idx, val, label] of sfData) {
      const frame = secureFrames[idx];
      if (!frame) { console.log(`⚠️  Frame ${idx} no existe`); continue; }

      try {
        // Usar JS nativo para bypassar restricciones cross-origin
        await frame.evaluate((v: string) => {
          const el = document.querySelector('input') as HTMLInputElement | null;
          if (!el) return;
          el.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) {
            setter.call(el, v);
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          el.blur();
        }, val);
        console.log(`✅ ${label} ingresado`);
      } catch {
        // Fallback: pressSequentially
        try {
          const inp = frame.locator('input').first();
          await inp.click({ force: true, timeout: 5000 });
          await inp.pressSequentially(val, { delay: 80 });
          console.log(`✅ ${label} ingresado (fallback)`);
        } catch (e2) {
          console.log(`⚠️  ${label} falló:`, (e2 as Error).message.substring(0, 60));
        }
      }

      // Después del número de tarjeta, esperar que MP.js lo procese
      if (idx === 0) {
        await page.waitForTimeout(3000);
        // Re-capturar frames (pueden actualizarse)
        const updatedFrames = page.frames().filter(f => f.url().includes('secure-fields.mercadopago'));
        if (updatedFrames.length !== secureFrames.length) {
          console.log(`Frames actualizados: ${updatedFrames.length}`);
          secureFrames.splice(0, secureFrames.length, ...updatedFrames);
        }
      }
    }
  } else if (secureFrames.length === 0) {
    // Formulario sin SecureFields — campos directos
    console.log('Usando campos directos (sin SecureFields)...');

    const directFields: [string, string, string][] = [
      ['input[name="cardNumber"], input[data-checkout="cardNumber"], #cardNumber', CARD_NUMBER, 'número'],
      ['input[name="cardExpirationDate"], input[data-checkout="cardExpirationDate"], input[placeholder*="MM"]', '11/30', 'vencimiento'],
      ['input[name="securityCode"], input[data-checkout="securityCode"], input[placeholder*="CVV"]', CARD_CVV, 'CVV'],
    ];

    for (const [sel, val, label] of directFields) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await el.fill(val);
        console.log(`✅ ${label} ingresado (campo directo)`);
      }
    }
  }

  await page.waitForTimeout(2000);
  await shot('formulario-lleno');

  // Esperar que el botón Continuar/Pagar se habilite
  console.log('⏳ Esperando botón habilitado...');
  await page.waitForFunction(() => {
    const selectors = [
      'button.continue_button',
      'button:not([disabled]).andes-button--loud',
      'button[type="submit"]:not([disabled])',
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel) as HTMLButtonElement | null;
      if (btn && !btn.disabled && !btn.classList.contains('andes-button--disabled')) {
        return true;
      }
    }
    return false;
  }, { timeout: 20000 }).catch(() => console.log('⚠️  Botón no se habilitó en 20s'));

  await shot('formulario-listo');

  // ── 6. CONFIRMAR PAGO ──────────────────────────────
  console.log('\n══ 6. CONFIRMAR PAGO ══');

  const paySelectors = [
    'button:has-text("Pagar")',
    'button:has-text("Confirmar pago")',
    'button:has-text("Continuar")',
    'button:has-text("Realizar pago")',
    '[data-testid="action-pay"]',
  ];

  let clicked = false;
  for (const sel of paySelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = await btn.textContent().catch(() => '');
      const disabled = await btn.getAttribute('disabled').catch(() => null);
      if (disabled === null) {
        console.log(`💳 Click en: "${txt?.trim()}"`);
        await btn.click();
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    console.log('⚠️  Intentando cualquier botón submit...');
    await page.locator('button[type="submit"]').first().click().catch(() => {});
  }

  await page.waitForTimeout(6000);
  await shot('post-pago-click');
  console.log('URL post-pago:', page.url().substring(0, 100));

  // ── 7. ESPERAR RETORNO AL SITIO ────────────────────
  console.log('\n══ 7. ESPERAR RETORNO ══');
  try {
    await page.waitForURL(/db0i745ypndsx/, { timeout: 60000 });
    const finalUrl = page.url();
    await shot('retorno-final');
    console.log('URL final:', finalUrl);

    if (finalUrl.includes('/checkout/success')) {
      console.log('🎉 PAGO EXITOSO!');
    } else if (finalUrl.includes('/checkout/failure')) {
      console.log('❌ Pago rechazado/fallido');
    } else if (finalUrl.includes('/checkout/pending')) {
      console.log('⏳ Pago pendiente');
    } else {
      console.log('⚠️  URL inesperada');
    }
  } catch {
    const curUrl = page.url();
    console.log('⏱️  No retornó en 60s. URL:', curUrl.substring(0, 100));
    await shot('timeout-retorno');

    // Si sigue en MP, buscar botón "Volver al sitio"
    const backBtn = page.locator('a:has-text("Volver"), a:has-text("volver"), a[href*="db0i745ypndsx"]').first();
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await backBtn.getAttribute('href');
      console.log('🔗 Click "Volver al sitio":', href?.substring(0, 80));
      await backBtn.click();
      await page.waitForTimeout(3000);
      await shot('despues-volver');
      console.log('URL final:', page.url());
    }
  }

  // ── GUARDAR LOGS ───────────────────────────────────
  fs.writeFileSync(`${DIR}/navegaciones.txt`, navLog.join('\n'));
  console.log('\n══ RESUMEN ══');
  console.log(`URLs visitadas: ${navLog.length}`);
  if (fs.existsSync(DIR)) {
    fs.readdirSync(DIR).sort().forEach(f => console.log(`  📸 ${f}`));
  }
});
