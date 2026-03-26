import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://db0i745ypndsx.cloudfront.net';
const DIR  = 'tests/evidencia';

// MP test buyer (created 2026-03-26 via /users/test_user API — MLM site)
// IMPORTANT: must be different from seller account (ID 145149588)
const BUYER_EMAIL    = 'test_user_1311229101767037243@testuser.com';
const BUYER_NICKNAME = 'TESTUSER1311229101767037243';
const BUYER_PASSWORD = 'zJpE3r5l6H';

test('Pago con cuenta MP - resolver challenge', async ({ page }) => {
  test.setTimeout(300000);
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  // Capturar TODAS las URLs visitadas para ver el loop
  const urlsVisitadas: string[] = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      const url = frame.url();
      urlsVisitadas.push(url);
      console.log(`🔗 Nav: ${url.substring(0, 120)}`);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('challenge') || url.includes('execute-api') ||
        url.includes('/purchase') || res.status() >= 300) {
      console.log(`📡 ${res.status()} ${url.substring(0, 100)}`);
    }
  });

  page.on('console', msg => {
    if (msg.type() !== 'log') return;
    console.log(`🌐 ${msg.text().substring(0, 150)}`);
  });

  // ── LOGIN EN CONSEJOTECNICO ────────────────────────
  console.log('\n1️⃣  LOGIN EN LA APP...');
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]',    'test@mercadopago.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(/maestro\/dashboard|dashboard/, { timeout: 10000 });
    console.log('✅ Login OK → ' + page.url());
  } catch {
    await page.screenshot({ path: `${DIR}/00-login-error.png` });
    console.log('❌ Login falló. URL: ' + page.url());
  }

  // ── IR A CHECKOUT ──────────────────────────────────
  console.log('\n2️⃣  CHECKOUT...');
  await page.goto(`${BASE}/checkout?plan=grado`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DIR}/01-checkout.png` });

  await page.click('button:has-text("Proceder al Pago")');
  console.log('✅ Click en Proceder al Pago');

  // ── ESPERAR MERCADO PAGO ───────────────────────────
  console.log('\n3️⃣  ESPERANDO MERCADO PAGO...');
  await page.waitForURL(/mercadopago/, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  const sandboxCheckoutUrl = page.url(); // Guardar para recovery post-auth
  await page.screenshot({ path: `${DIR}/02-mp-inicial.png` });
  console.log(`✅ En MP: ${sandboxCheckoutUrl.substring(0, 80)}`);

  // ── BUSCAR OPCIÓN "PAGAR CON CUENTA MP" ───────────
  console.log('\n4️⃣  BUSCANDO OPCIÓN PAGAR CON CUENTA MP...');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${DIR}/03-mp-opciones.png` });

  const opcionesCuenta = [
    'button:has-text("Cuenta de Mercado Pago")',
    'button:has-text("Dinero en cuenta")',
    'button:has-text("Saldo")',
    '[data-testid="account_money"]',
    'button:has-text("Ingresar")',
    'a:has-text("Iniciar sesión")',
    'button:has-text("Iniciar")',
  ];

  let encontroOpcion = false;
  for (const selector of opcionesCuenta) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`✅ Encontró opción: ${selector}`);
      await el.click();
      encontroOpcion = true;
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${DIR}/04-click-cuenta.png` });
      break;
    }
  }

  if (!encontroOpcion) {
    console.log('⚠️  No encontró botón de cuenta, la página tiene:');
    const allButtons = await page.locator('button, a').allTextContents();
    console.log('Botones/links:', allButtons.slice(0, 20));
    await page.screenshot({ path: `${DIR}/04-sin-opcion-cuenta.png` });
  }

  // ── LOGIN CON CUENTA DE PRUEBA ─────────────────────
  console.log('\n5️⃣  LOGIN CON USUARIO DE PRUEBA MP...');

  // INTENTO 1: llenar email en la página actual
  const foundStep1 = await (async () => {
    const userSelectors = [
      'input[name="user_id"]',
      'input[id="user_id"]',
      'input[type="email"]',
      'input[placeholder*="mail"]',
      'input[placeholder*="usuario"]',
      'input[placeholder*="celular"]',
    ];
    for (const sel of userSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`✅ Campo usuario encontrado: ${sel}`);
        await el.fill(BUYER_EMAIL);
        await page.screenshot({ path: `${DIR}/05-usuario-ingresado.png` });
        console.log(`URL antes de continuar: ${page.url().substring(0, 80)}`);
        // Pre-fill password if visible on same page
        const passFieldSamePage = page.locator('input[type="password"]').first();
        if (await passFieldSamePage.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passFieldSamePage.fill(BUYER_PASSWORD);
        }
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${DIR}/06-despues-usuario.png` });
        console.log(`URL después de continuar: ${page.url().substring(0, 80)}`);
        return true;
      }
    }
    return false;
  })();

  if (!foundStep1) {
    console.log('❌ No encontró campo de usuario');
    const allInputs = await page.locator('input').all();
    for (const input of allInputs) {
      const attrs = await input.evaluate(el => ({
        type:        el.getAttribute('type'),
        name:        el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        maxlength:   el.getAttribute('maxlength'),
      }));
      console.log('  Input:', JSON.stringify(attrs));
    }
  }

  // INTENTO 2: si aterrizamos en user-legal-id-social con campo vacío, rellenar de nuevo
  const urlAfterStep1 = page.url();
  console.log(`URL tras step1: ${urlAfterStep1.substring(0, 100)}`);
  if (urlAfterStep1.includes('user-legal-id-social') || urlAfterStep1.includes('lgz/login')) {
    console.log('🔄 Detectado redirect a user-legal-id-social — rellenando email de nuevo...');
    const emailRetry = [
      'input[name="user_id"]',
      'input[id="user_id"]',
      'input[type="email"]',
    ];
    for (const sel of emailRetry) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 4000 }).catch(() => false)) {
        // Limpiar y volver a llenar
        await el.click({ clickCount: 3 });
        await el.fill('');
        await page.waitForTimeout(300);
        await el.fill(BUYER_EMAIL);
        console.log(`✅ Email re-ingresado (${sel})`);
        await page.screenshot({ path: `${DIR}/06b-email-retry.png` });
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${DIR}/06c-despues-retry.png` });
        console.log(`URL tras retry: ${page.url().substring(0, 100)}`);
        break;
      }
    }
  }

  // ── ESPERAR CAMPO DE CONTRASEÑA (con manejo de challenge) ─────
  console.log('⏳ Esperando campo de contraseña o challenge...');
  let passwordEntered = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const curUrl = page.url();
    console.log(`  Attempt ${attempt + 1}: URL=${curUrl.substring(0, 80)}`);

    // CASO A: ya hay campo de contraseña → ingresar directamente
    const passField = page.locator('input[type="password"]').first();
    if (await passField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passField.fill(BUYER_PASSWORD);
      await page.screenshot({ path: `${DIR}/07-password-ingresado.png` });
      await page.click('button[type="submit"]');
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${DIR}/08-despues-password.png` });
      console.log('✅ Password ingresado');
      passwordEntered = true;
      break;
    }

    // CASO B: estamos en la página de challenge picker
    if (curUrl.includes('login/challenges') || curUrl.includes('challenges?schema_id')) {
      console.log('🔑 Detectada página challenge — buscando opción Contraseña...');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      // Intentar con selector Playwright directo en los botones de la lista
      const challengeBtn = page.locator('.andes-ui-list__item-actionable').filter({ hasText: /Contraseña/i }).first();
      if (await challengeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('✅ Botón challenge Contraseña encontrado vía Playwright');
        await challengeBtn.click();
      } else {
        // Fallback JS: click the button INSIDE the LI that contains "Contraseña"
        const clicked = await page.evaluate(() => {
          const items = document.querySelectorAll('.andes-ui-list__item-actionable, li');
          for (const el of Array.from(items)) {
            if (el.textContent?.toLowerCase().includes('contraseña')) {
              // Click the button inside if present, else click el itself
              const btn = el.querySelector('button') || (el as HTMLElement);
              (btn as HTMLElement).click();
              return (btn as HTMLElement).tagName + ':' + el.textContent?.trim().substring(0, 30);
            }
          }
          return null;
        });
        console.log(`JS challenge click: ${clicked}`);
      }
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${DIR}/06-challenge-clicked.png` });
      console.log(`URL tras challenge click: ${page.url().substring(0, 80)}`);
      continue;
    }

    // CASO C: sigue en formulario de email → re-llenar
    const emailAgain = page.locator('input[name="user_id"], input[id="user_id"], input[type="email"]').first();
    if (await emailAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Re-llenando email...');
      await emailAgain.click({ clickCount: 3 });
      await emailAgain.fill(BUYER_EMAIL);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      continue;
    }

    // Ningún campo conocido — esperar un poco más
    await page.waitForTimeout(3000);
  }

  if (!passwordEntered) {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('⚠️  ACCIÓN MANUAL REQUERIDA EN EL NAVEGADOR ABIERTO:');
    console.log(`   Usuario: ${BUYER_EMAIL}`);
    console.log(`   Contraseña: ${BUYER_PASSWORD}`);
    console.log('   1. Completa el reCAPTCHA si aparece');
    console.log('   2. Ingresa el email/contraseña y continúa');
    console.log('   3. Si aparece challenge, elige "Contraseña" e ingrésala');
    console.log('   4. El test esperará 180 segundos');
    console.log('══════════════════════════════════════════════════════\n');
    await page.waitForTimeout(180000);
    await page.screenshot({ path: `${DIR}/08-post-manual.png` });
    console.log(`URL post-manual: ${page.url().substring(0, 100)}`);
  }

  // ── RECOVERY: si redirigió a chrome-error por too-many-redirects ──
  const urlPostLogin = page.url();
  if (urlPostLogin.includes('chrome-error') || urlPostLogin.includes('chromewebdata') || urlPostLogin.includes('ERR_')) {
    console.log('🔄 Redirect loop detectado — navegando de vuelta al checkout sandbox...');
    await page.goto(sandboxCheckoutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}/08b-recovery.png` });
    console.log(`URL tras recovery: ${page.url().substring(0, 100)}`);
  }

  // ── MANEJAR CHALLENGE (ELEGIR CONTRASEÑA) ─────────
  console.log('\n6️⃣  MANEJANDO CHALLENGE...');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/09-pre-challenge.png` });

  const currentUrl = page.url();
  console.log(`URL actual: ${currentUrl.substring(0, 120)}`);
  console.log(`¿Es challenge URL?: ${currentUrl.includes('challenge') || currentUrl.includes('verification')}`);

  // PASO 6a: elegir "Contraseña" como método de verificación
  // Dumping page structure to find the right selector
  console.log('🔍 Inspeccionando estructura del challenge...');
  try {
    const challengeHtml = await page.evaluate(() => {
      const body = document.body;
      // Get all <a> and <button> elements with their text + href
      const interactives = Array.from(body.querySelectorAll('a, button, li[role="button"], li[onclick], [tabindex]'));
      return interactives.map(el => ({
        tag:  el.tagName,
        text: el.textContent?.trim().substring(0, 60),
        href: (el as HTMLAnchorElement).href || '',
        cls:  el.className.substring(0, 50),
      }));
    });
    challengeHtml.forEach(el => console.log(`  ${el.tag}: "${el.text}" cls="${el.cls}" href="${el.href.substring(0,60)}"`));
  } catch (e) { console.log('Error inspecting:', e); }

  // Intentar múltiples estrategias para clickear la opción de Contraseña
  const esChallengePicker = currentUrl.includes('challenge');
  if (esChallengePicker) {
    console.log('🔑 Intentando seleccionar opción Contraseña...');
    // Usar JS para encontrar y clickear el elemento correcto
    const clicked = await page.evaluate(() => {
      // Buscar cualquier elemento con texto "Contraseña" que sea clickeable
      const all = document.querySelectorAll('li, a, button, [role="button"], [onclick]');
      for (const el of Array.from(all)) {
        if (el.textContent?.includes('Contraseña') || el.textContent?.includes('contrase')) {
          (el as HTMLElement).click();
          return el.tagName + ':' + el.textContent?.trim().substring(0, 30);
        }
      }
      return null;
    });
    console.log(`JS click result: ${clicked}`);
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: `${DIR}/10-challenge-password-clicked.png` });
  console.log(`URL después de click: ${page.url().substring(0, 80)}`);

  // PASO 6b: ingresar la contraseña del comprador en el campo que aparece
  const passChallenge = page.locator('input[type="password"]').first();
  if (await passChallenge.isVisible({ timeout: 8000 }).catch(() => false)) {
    console.log('✅ Campo contraseña en challenge encontrado');
    await passChallenge.fill(BUYER_PASSWORD);
    await page.screenshot({ path: `${DIR}/10-challenge-pass-filled.png` });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${DIR}/11-despues-challenge.png` });
    console.log(`URL post-challenge: ${page.url().substring(0, 120)}`);
  } else {
    // PASO 6c: buscar campo de código de 6 dígitos
    const codeSelectors = [
      'input[name="code"]', 'input[maxlength="6"]',
      'input[type="tel"]',  'input[autocomplete="one-time-code"]',
    ];
    let codeField = null;
    for (const sel of codeSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        codeField = el;
        console.log(`✅ Campo código: ${sel}`);
        break;
      }
    }
    if (codeField) {
      console.log('⚠️  ACCIÓN MANUAL REQUERIDA: ingresar código en el navegador (60s)');
      await page.waitForTimeout(60000);
    } else {
      console.log('⚠️  Sin campo contraseña ni código');
      const allInputs = await page.locator('input').all();
      for (const inp of allInputs) {
        const a = await inp.evaluate(e => ({
          type: e.getAttribute('type'), name: e.getAttribute('name'),
          placeholder: e.getAttribute('placeholder'), maxlength: e.getAttribute('maxlength'),
        }));
        console.log('  Input:', JSON.stringify(a));
      }
    }
    await page.screenshot({ path: `${DIR}/11-despues-challenge.png` });
  }

  // ── VERIFICAR SI SIGUE EN CHALLENGE LOOP ──────────
  console.log('\n7️⃣  VERIFICANDO ESTADO POST-CHALLENGE...');
  await page.waitForTimeout(3000);

  const urlPostChallenge = page.url();
  console.log(`URL: ${urlPostChallenge.substring(0, 150)}`);

  const challengeCount = urlsVisitadas.filter(u => u.includes('challenge')).length;
  console.log(`Veces en URL challenge: ${challengeCount}`);

  if (challengeCount > 2) {
    console.log('❌ DETECTADO LOOP DE CHALLENGE');
    console.log('URLs visitadas:');
    urlsVisitadas.forEach((u, i) => console.log(`  ${i}: ${u.substring(0, 100)}`));

    const html = await page.content();
    fs.writeFileSync(`${DIR}/challenge-loop-html.txt`, html);
    console.log('📄 HTML guardado: challenge-loop-html.txt');

    throw new Error(`LOOP DETECTADO: challenge apareció ${challengeCount} veces`);
  }

  // ── PANTALLA DE PAGO ───────────────────────────────
  console.log('\n8️⃣  PANTALLA DE PAGO CON SALDO...');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.screenshot({ path: `${DIR}/12-pantalla-pago.png` });

  // Si estamos en el selector de métodos de pago, elegir la mejor opción disponible
  const curUrlStep8 = page.url();
  console.log(`URL step8: ${curUrlStep8.substring(0, 100)}`);

  if (curUrlStep8.includes('payment-option-form')) {
    console.log('📋 Selector de métodos de pago detectado');
    const opciones = await page.locator('.andes-list__item-action').allTextContents();
    console.log('Opciones:', opciones.map(t => t.substring(0, 50)));

    // Preferir: cuenta/saldo → nueva tarjeta (más predecible) → tarjetas guardadas
    const prioridad = [
      'button:has-text("Dinero en cuenta")',
      'button:has-text("Saldo")',
      'button:has-text("Cuenta")',
      'button:has-text("Nueva Tarjeta")',
      'button:has-text("tarjetas de crédito")',
      'button:has-text("tarjeta de crédito")',
    ];

    for (const sel of prioridad) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`✅ Seleccionando método: ${sel}`);
        await btn.click();
        await page.waitForTimeout(4000);
        await page.screenshot({ path: `${DIR}/12b-metodo-seleccionado.png` });
        console.log(`URL tras selección: ${page.url().substring(0, 100)}`);
        break;
      }
    }
  }

  // Dump elementos si todavía en MP para entender qué se necesita
  if (page.url().includes('sandbox.mercadopago') || page.url().includes('combined-payment')) {
    console.log('🔍 Dump de interactivos en página actual...');
    const interactivos = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, input, a[href]'))
        .slice(0, 20)
        .map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 50) || '',
          type: (el as HTMLInputElement).type || '',
          disabled: (el as HTMLButtonElement).disabled,
          id: el.id || '',
          cls: el.className.substring(0, 40) || '',
        }))
    );
    interactivos.forEach(e => console.log(`  ${e.tag}[${e.type}] "${e.text}" id="${e.id}" disabled=${e.disabled}`));
  }

  // Manejar página combined-payment-amount-form si aplica
  if (page.url().includes('combined-payment-amount')) {
    console.log('📊 Página combined-payment-amount-form — buscando tarjeta y monto...');
    // Primero, ingresar el monto total si hay campo de monto
    const amountInput = page.locator('input[type="number"], input[placeholder*="monto"], input[placeholder*="pesos"]').first();
    if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const val = await amountInput.inputValue().catch(() => '');
      console.log(`  Campo monto: valor actual="${val}"`);
      if (!val) await amountInput.fill('499');
    }
    await page.screenshot({ path: `${DIR}/12c-combined-form.png` });
  }

  // Nueva tarjeta via SecureFields: si hay iframes de secure-fields, llenar la tarjeta de prueba
  // (solo cuando estamos en el card-form, no en payment-option-form)
  const curUrlForCard = page.url();
  const secureFrames = page.frames().filter(f => f.url().includes('secure-fields.mercadopago'));
  console.log(`SecureFrames: ${secureFrames.length} (URL: ${curUrlForCard.includes('card-form') ? 'card-form' : 'otro'})`);

  if (secureFrames.length > 0 && curUrlForCard.includes('card-form')) {
    console.log('🔑 Llenando tarjeta de prueba...');

    // Nombre titular (campo regular fuera del iframe)
    const nameF = page.locator('#cardholderName, input[id*="cardholderName"]').first();
    if (await nameF.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameF.fill('APRO');
      console.log('  ✅ Nombre ingresado');
    }

    // Llenar cada SecureField usando el frame directo (más confiable que frameLocator)
    const sfData: [number, string, string][] = [
      [0, '4013540682746260', 'Número'],
      [1, '1130', 'Vencimiento'],
      [2, '123', 'CVV'],
    ];

    for (const [idx, val, label] of sfData) {
      const frame = secureFrames[idx];
      if (!frame) { console.log(`  ⚠️  Frame ${idx} no existe`); continue; }

      try {
        const inp = frame.locator('input').first();
        // Esperar a que el input esté en el DOM
        await inp.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
        // Usar evaluate para interactuar con el input (bypassa cross-origin restrictions)
        await frame.evaluate((v: string) => {
          const el = document.querySelector('input') as HTMLInputElement | null;
          if (!el) return;
          el.focus();
          // Dispatch nativo
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) {
            setter.call(el, v);
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.value = v;
            el.dispatchEvent(new Event('input',  { bubbles: true }));
          }
          el.blur();
        }, val);
        console.log(`  ✅ ${label} ingresado (eval)`);
      } catch (e) {
        // Fallback: pressSequentially via frameLocator
        try {
          const SF_URL = 'iframe[src^="https://secure-fields.mercadopago.com"]';
          const fl = page.frameLocator(SF_URL).nth(idx);
          const inp = fl.locator('input').first();
          await inp.click({ force: true, timeout: 5000 });
          await inp.pressSequentially(val, { delay: 80 });
          await inp.press('Tab');
          console.log(`  ✅ ${label} ingresado (pressSeq)`);
        } catch (e2) {
          console.log(`  ⚠️  ${label} todos los intentos fallaron: ${(e2 as Error).message.substring(0, 60)}`);
        }
      }

      // Después del número de tarjeta, esperar a que MP.js procese e inicialice expiry/CVV
      if (idx === 0) {
        console.log('  ⏳ Esperando que MP.js procese el número...');
        await page.waitForTimeout(3000);
        // Recolectar frames de nuevo (pueden haber cambiado)
        const updatedFrames = page.frames().filter(f => f.url().includes('secure-fields.mercadopago'));
        if (updatedFrames.length !== secureFrames.length) {
          console.log(`  Frames actualizados: ${updatedFrames.length}`);
          secureFrames.splice(0, secureFrames.length, ...updatedFrames);
        }
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DIR}/12e-securefields-filled.png` });
  }

  // Llenar CVV directo si se requiere (para tarjeta guardada)
  const cvvField = page.locator('input[id*="cvv"], input[id*="security"], input[placeholder*="CVV"]').first();
  if (await cvvField.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('🔑 Llenando CVV directo...');
    await cvvField.fill('123');
    await page.waitForTimeout(500);
  }

  // Esperar a que el botón Continuar se habilite (hasta 15s)
  console.log('⏳ Esperando que botón Continuar se habilite...');
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.continue_button, button.andes-button--loud:not(.andes-button--disabled)') as HTMLButtonElement | null;
      return btn && !btn.disabled && !btn.classList.contains('andes-button--disabled');
    },
    { timeout: 15000 }
  ).catch(() => console.log('⚠️  Botón no se habilitó en 15s'));

  await page.screenshot({ path: `${DIR}/12-pantalla-pago.png` });

  // Buscar y hacer click en botón de pagar/confirmar
  const paySelectors = [
    'button:has-text("Pagar")',
    'button:has-text("Confirmar pago")',
    'button:has-text("Confirmar")',
    'button:has-text("Continuar")',
    '[data-testid="action-pay"]',
    'button.pay-button',
  ];

  for (const sel of paySelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = await btn.textContent().catch(() => '');
      const disabledAttr = await btn.getAttribute('disabled').catch(() => null);
      // null → no tiene atributo disabled → habilitado; cualquier string → deshabilitado
      const isDisabled = disabledAttr !== null;
      console.log(`  Botón: "${txt?.trim()}" disabled=${isDisabled}`);
      if (!isDisabled) {
        await btn.click();
        console.log('💳 Click en PAGAR');
        await page.waitForTimeout(3000);
        const curUrlAfterPay = page.url();
        console.log(`URL post-click: ${curUrlAfterPay.substring(0, 100)}`);
        break;
      } else {
        // Intentar click forzado como último recurso
        console.log('  ⚠️  Botón deshabilitado, intentando JS click...');
        await page.evaluate((s) => {
          const b = document.querySelector(s) as HTMLButtonElement | null;
          if (b) b.click();
        }, sel).catch(() => {});
        await page.waitForTimeout(2000);
        if (!page.url().includes(curUrlForCard)) break; // Navegó
      }
    }
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${DIR}/13-post-pago.png` });

  // ── VERIFICAR REGRESO AL SITIO ─────────────────────
  console.log('\n9️⃣  ESPERANDO REGRESO...');
  try {
    await page.waitForURL(/db0i745ypndsx/, { timeout: 60000 });
    const finalUrl = page.url();
    console.log(`✅ URL final: ${finalUrl}`);
    await page.screenshot({ path: `${DIR}/14-final.png` });

    if (finalUrl.includes('/checkout/success')) {
      console.log('🎉 PAGO EXITOSO!');
    } else {
      console.log(`⚠️  URL inesperada: ${finalUrl}`);
    }
  } catch {
    console.log('❌ No regresó al sitio en 60s');
    console.log(`URL actual: ${page.url()}`);
    await page.screenshot({ path: `${DIR}/14-timeout.png` });
  }

  // ── GUARDAR LOG COMPLETO ───────────────────────────
  fs.writeFileSync(`${DIR}/urls-visitadas.txt`, urlsVisitadas.join('\n'));

  console.log('\n════ RESUMEN ════');
  console.log(`Total URLs visitadas: ${urlsVisitadas.length}`);
  console.log(`URLs con challenge: ${challengeCount}`);
  console.log('Screenshots en: tests/evidencia/');
  fs.readdirSync(DIR).sort().forEach(f => console.log(`  📸 ${f}`));
});
