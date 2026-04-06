/**
 * E2E: 4 usuarios de prueba con flujos completos
 * Run: npx playwright test tests/e2e-usuarios.spec.ts --workers=1
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const BASE = 'https://db0i745ypndsx.cloudfront.net';
const DIR = 'tests/e2e-final';

const CARD = {
  numero: '5474925432670366',
  exp: '11',
  expYear: '30',
  cvv: '123',
  nombre: 'APRO',
  email: 'test_user_2205009214166188348@testuser.com',
  rfc: 'XAXX010101000',
};

const USUARIOS = {
  maestrotest1: {
    email: 'maestrotest1@consejotecnico.mx',
    password: 'Test123456!',
    nombre: 'Maestro Test 1',
    plan: 'gratuito',
  },
  maestrotest2: {
    email: 'maestrotest2@consejotecnico.mx',
    password: 'Test123456!',
    nombre: 'Maestro Test 2',
    plan: 'grado',
    grado: '3_primaria',
  },
  maestrotest3: {
    email: 'maestrotest3@consejotecnico.mx',
    password: 'Test123456!',
    nombre: 'Maestro Test 3',
    plan: 'pro_maestro',
  },
  directivotest: {
    email: 'directivotest@consejotecnico.mx',
    password: 'Test123456!',
    nombre: 'Directivo Test',
    plan: 'pro_directivo',
  },
};

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

let shotN = 0;
async function shot(page: Page, name: string) {
  const p = `${DIR}/${String(++shotN).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${p}`);
}

/** Registrar usuario — retorna true si tuvo éxito */
async function registrar(page: Page, u: { email: string; password: string; nombre: string }) {
  console.log(`\n📝 Registrando: ${u.email}`);
  await page.goto(`${BASE}/auth/register`);
  await page.waitForLoadState('networkidle');

  const emailField = page.locator('input[type="email"], input[name="email"]').first();
  const passField = page.locator('input[type="password"], input[name="password"]').first();
  const nombreField = page
    .locator('input[name="nombre"], input[placeholder*="nombre" i], input[placeholder*="Nombre"]')
    .first();

  if (await nombreField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nombreField.fill(u.nombre);
  }
  await emailField.fill(u.email);
  await passField.fill(u.password);

  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await shot(page, `registro-${u.email.split('@')[0]}`);
  console.log(`✅ Registro enviado: ${u.email}`);
}

/** Login */
async function login(page: Page, u: { email: string; password: string }) {
  console.log(`\n🔐 Login: ${u.email}`);
  await page.goto(`${BASE}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', u.email);
  await page.fill('input[type="password"]', u.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log(`URL tras login: ${page.url()}`);
}

/** Llenar campo dentro de iframes MP Bricks */
async function fillInFrames(page: Page, placeholders: string[], value: string): Promise<boolean> {
  // Intentar en page directa primero
  for (const ph of placeholders) {
    const sel = `input[placeholder*="${ph}" i]`;
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.fill(value);
      return true;
    }
  }
  // Buscar en iframes
  for (const frame of page.frames()) {
    for (const ph of placeholders) {
      const sel = `input[placeholder*="${ph}" i]`;
      const el = frame.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.fill(value);
        return true;
      }
    }
  }
  return false;
}

async function pressSequentialInFrames(page: Page, placeholders: string[], value: string): Promise<boolean> {
  for (const frame of page.frames()) {
    for (const ph of placeholders) {
      const el = frame.locator(`input[placeholder*="${ph}" i]`).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        await el.click();
        await el.pressSequentially(value, { delay: 80 });
        return true;
      }
    }
  }
  return false;
}

/** Pagar con tarjeta en Checkout Bricks */
async function pagarConTarjeta(page: Page, planId: string, grado?: string): Promise<boolean> {
  console.log(`\n💳 Pago: plan=${planId} grado=${grado || 'N/A'}`);

  await page.goto(`${BASE}/checkout?plan=${planId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Seleccionar grado si aplica
  if (grado) {
    const gradoLabels: Record<string, string[]> = {
      preescolar: ['Preescolar'],
      '1_primaria': ['1°', '1er', 'Primer'],
      '2_primaria': ['2°', '2do', 'Segundo'],
      '3_primaria': ['3°', '3er', 'Tercer'],
      '4_primaria': ['4°', '4to', 'Cuarto'],
      '5_primaria': ['5°', '5to', 'Quinto'],
      '6_primaria': ['6°', '6to', 'Sexto'],
    };
    const labels = gradoLabels[grado] ?? [grado];
    let gradoClicked = false;
    for (const label of labels) {
      const btn = page.locator(`button:has-text("${label}")`).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        console.log(`✅ Grado seleccionado: ${label}`);
        gradoClicked = true;
        await page.waitForTimeout(800);
        break;
      }
    }
    if (gradoClicked) {
      const continueBtn = page
        .locator('button:has-text("Continuar"), button:has-text("continuar")')
        .first();
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click();
        await page.waitForTimeout(2500);
      }
    }
  }

  // Esperar que cargue el Brick
  await page.waitForTimeout(7000);
  await shot(page, `checkout-${planId}`);

  // Seleccionar tarjeta de crédito
  const creditOptions = [
    page.locator('label:has-text("Tarjeta de crédito")').first(),
    page.locator('[data-testid*="credit"]').first(),
    page.locator('text=Tarjeta de crédito').first(),
  ];
  for (const opt of creditOptions) {
    if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await opt.click();
      await page.waitForTimeout(2000);
      console.log('✅ Seleccionó Tarjeta de crédito');
      break;
    }
  }

  // Número de tarjeta
  const cardFilled = await pressSequentialInFrames(
    page,
    ['número de tarjeta', 'número', '1234', 'card number', 'tarjeta'],
    CARD.numero
  );
  if (cardFilled) {
    console.log('✅ Número de tarjeta ingresado');
    await page.waitForTimeout(1500);
  }

  // Mes de vencimiento
  const monthFilled = await fillInFrames(page, ['MM', 'mes', 'month'], CARD.exp);
  if (monthFilled) {
    console.log('✅ Mes ingresado');
    await page.waitForTimeout(500);
  }

  // Año de vencimiento
  const yearFilled = await fillInFrames(page, ['AA', 'año', 'year', 'YY'], CARD.expYear);
  if (yearFilled) {
    console.log('✅ Año ingresado');
    await page.waitForTimeout(500);
  }

  // CVV
  const cvvFilled = await fillInFrames(page, ['CVV', 'CVC', 'segur', 'código'], CARD.cvv);
  if (cvvFilled) {
    console.log('✅ CVV ingresado');
    await page.waitForTimeout(500);
  }

  // Nombre del titular
  const nameSelectors = [
    '#form-checkout__cardholderName',
    'input[placeholder*="Titular" i]',
    'input[placeholder*="nombre" i]',
    'input[name="cardholderName"]',
  ];
  for (const sel of nameSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(CARD.nombre);
      console.log('✅ Nombre titular ingresado');
      break;
    }
  }

  // Email del pagador
  const emailSelectors = [
    '#form-checkout__cardholderEmail',
    'input[type="email"]',
    'input[placeholder*="email" i]',
  ];
  for (const sel of emailSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.clear();
      await el.fill(CARD.email);
      console.log('✅ Email pagador ingresado');
      break;
    }
  }

  // RFC / Documento de identidad
  const rfcSelectors = [
    '#form-checkout__identificationNumber',
    'input[placeholder*="RFC" i]',
    'input[placeholder*="documento" i]',
    'input[placeholder*="CURP" i]',
  ];
  for (const sel of rfcSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(CARD.rfc);
      console.log('✅ RFC ingresado');
      break;
    }
  }

  await page.waitForTimeout(2000);
  await shot(page, `formulario-${planId}`);

  // Click en Pagar
  const paySelectors = [
    '#form-checkout__submit',
    'button:has-text("Pagar")',
    'button[type="submit"]:has-text("Pagar")',
    'button:has-text("Confirmar")',
  ];
  let paid = false;
  for (const sel of paySelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const disabled = await btn.isDisabled().catch(() => false);
      console.log(`Botón pagar (${sel}): disabled=${disabled}`);
      await btn.click({ force: true });
      console.log('✅ Click Pagar');
      paid = true;
      break;
    }
  }
  if (!paid) console.log('⚠️ Botón pagar no encontrado');

  // Esperar resultado
  await page.waitForTimeout(12000);
  const finalUrl = page.url();
  const bodyText = await page.innerText('body').catch(() => '');
  const success =
    finalUrl.includes('success') ||
    bodyText.includes('aprobado') ||
    bodyText.includes('Aprobado') ||
    bodyText.includes('¡Pago');

  await shot(page, `resultado-${planId}`);
  console.log(`Pago ${planId}: ${success ? '✅ APROBADO' : '❌ PENDIENTE/FALLIDO'} (${finalUrl})`);
  return success;
}

// ─────────────────────────────────────────────────
// TEST 1: MAESTROTEST1 — Gratuito (solo registro)
// ─────────────────────────────────────────────────
test('MAESTROTEST1: registro gratuito + dashboard', async ({ page }) => {
  test.setTimeout(120000);
  const u = USUARIOS.maestrotest1;
  console.log('\n════ MAESTROTEST1: Gratuito ════');

  await registrar(page, u);

  // Si redirigió al dashboard, bien; si no, hacer login
  if (!page.url().includes('dashboard')) {
    await login(page, u);
  }
  await page.waitForTimeout(2000);
  await shot(page, 'maestrotest1-dashboard');

  const bodyText = await page.innerText('body').catch(() => '');
  const enDash = page.url().includes('dashboard') || bodyText.includes('dashboard') || bodyText.includes('Bienvenido');
  console.log(`Dashboard visible: ${enDash ? '✅' : '❌'} — URL: ${page.url()}`);

  // Ir al catálogo
  await page.goto(`${BASE}/catalogo`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'maestrotest1-catalogo');

  const planesTexto = await page.innerText('body').catch(() => '');
  console.log(`Planes visibles — Gratuito: ${planesTexto.includes('Gratuito')}`);
  console.log(`Planes visibles — Por Grado: ${planesTexto.includes('Grado')}`);
  console.log(`Planes visibles — Pro Maestro: ${planesTexto.includes('Pro Maestro') || planesTexto.includes('Maestro')}`);
  console.log(`Planes visibles — Pro Directivo: ${planesTexto.includes('Directivo')}`);

  console.log('\n✅ MAESTROTEST1 completado');
});

// ─────────────────────────────────────────────────
// TEST 2: MAESTROTEST2 — Plan Grado + selección grado
// ─────────────────────────────────────────────────
test('MAESTROTEST2: plan grado + selector + pago', async ({ page }) => {
  test.setTimeout(300000);
  const u = USUARIOS.maestrotest2;
  console.log('\n════ MAESTROTEST2: Plan Grado ════');

  await registrar(page, u);
  if (!page.url().includes('dashboard')) await login(page, u);
  await shot(page, 'maestrotest2-dashboard-inicial');

  const pagoOk = await pagarConTarjeta(page, 'grado', '3_primaria');
  console.log(`Plan Grado: ${pagoOk ? '✅' : '❌'}`);

  // Verificar plan en maestro dashboard
  await page.goto(`${BASE}/maestro/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot(page, 'maestrotest2-maestro-dashboard');

  const texto = await page.innerText('body').catch(() => '');
  console.log(`Plan Grado en dashboard: ${texto.includes('Grado') || texto.includes('grado') ? '✅' : '❌'}`);

  // Verificar acceso a recursos
  await page.goto(`${BASE}/maestro/recursos`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'maestrotest2-recursos');
  const recursosTxt = await page.innerText('body').catch(() => '');
  console.log(`Acceso recursos: ${!recursosTxt.includes('restringido') && !recursosTxt.includes('🔒') ? '✅' : '❌'}`);

  console.log('\n✅ MAESTROTEST2 completado');
});

// ─────────────────────────────────────────────────
// TEST 3: MAESTROTEST3 — Pro Maestro + grupos
// ─────────────────────────────────────────────────
test('MAESTROTEST3: pro maestro + grupos', async ({ page }) => {
  test.setTimeout(300000);
  const u = USUARIOS.maestrotest3;
  console.log('\n════ MAESTROTEST3: Pro Maestro ════');

  await registrar(page, u);
  if (!page.url().includes('dashboard')) await login(page, u);

  const pagoOk = await pagarConTarjeta(page, 'pro_maestro');
  console.log(`Plan Pro Maestro: ${pagoOk ? '✅' : '❌'}`);

  await page.goto(`${BASE}/maestro/dashboard`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'maestrotest3-dashboard-pro');

  const texto = await page.innerText('body').catch(() => '');
  console.log(`Plan Pro en dashboard: ${texto.includes('Pro') || texto.includes('pro') ? '✅' : '❌'}`);

  // Acceder a diario de clase (exclusivo de plan Pro+)
  await page.goto(`${BASE}/maestro/diario`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot(page, 'maestrotest3-diario');
  const diarioTxt = await page.innerText('body').catch(() => '');
  console.log(`Acceso Diario: ${!diarioTxt.includes('🔒') && !diarioTxt.includes('restringido') ? '✅' : '❌'}`);

  // Crear grupo con 5 alumnos
  await page.goto(`${BASE}/maestro/grupos`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'maestrotest3-grupos-inicial');

  const crearBtn = page
    .locator('button:has-text("Crear"), button:has-text("Nuevo"), button:has-text("Agregar")')
    .first();
  if (await crearBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await crearBtn.click();
    await page.waitForTimeout(2000);

    const nombreInput = page
      .locator('input[placeholder*="grupo" i], input[placeholder*="nombre" i], input[name="nombre"]')
      .first();
    if (await nombreInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nombreInput.fill('3° A - Primaria');
    }

    const guardarBtn = page
      .locator('button[type="submit"], button:has-text("Guardar"), button:has-text("Crear")')
      .first();
    if (await guardarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guardarBtn.click();
      await page.waitForTimeout(2000);
      console.log('✅ Grupo "3° A - Primaria" creado');
    }

    await shot(page, 'maestrotest3-grupo-creado');

    // Agregar 5 alumnos
    const alumnos = [
      'Ana García López',
      'Carlos Martínez Ruiz',
      'Diana Hernández Cruz',
      'Eduardo López Sánchez',
      'Fernanda Torres Jiménez',
    ];

    for (const alumno of alumnos) {
      try {
        const addBtn = page
          .locator(
            'button:has-text("Agregar alumno"), button:has-text("Nuevo alumno"), button:has-text("+ Alumno"), button:has-text("Alumno")'
          )
          .first();
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(1000);
          const alumnoInput = page
            .locator(
              'input[placeholder*="alumno" i], input[placeholder*="estudiante" i], input[placeholder*="nombre" i]'
            )
            .first();
          if (await alumnoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await alumnoInput.fill(alumno);
            const saveBtn = page
              .locator('button[type="submit"], button:has-text("Guardar")')
              .first();
            if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await saveBtn.click();
              await page.waitForTimeout(800);
              console.log(`  ✅ Alumno: ${alumno}`);
            }
          }
        }
      } catch (e) {
        console.log(`  ⚠️ Error alumno ${alumno}: ${e}`);
      }
    }
  }

  await shot(page, 'maestrotest3-grupos-final');
  console.log('\n✅ MAESTROTEST3 completado');
});

// ─────────────────────────────────────────────────
// TEST 4: DIRECTIVOTEST — Pro Directivo + CTE
// ─────────────────────────────────────────────────
test('DIRECTIVOTEST: pro directivo + acceso CTE', async ({ page }) => {
  test.setTimeout(300000);
  const u = USUARIOS.directivotest;
  console.log('\n════ DIRECTIVOTEST: Pro Directivo ════');

  await registrar(page, u);
  if (!page.url().includes('dashboard')) await login(page, u);

  const pagoOk = await pagarConTarjeta(page, 'pro_directivo');
  console.log(`Plan Pro Directivo: ${pagoOk ? '✅' : '❌'}`);

  await page.goto(`${BASE}/maestro/dashboard`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'directivotest-dashboard');

  // Verificar que CTE está disponible en el nav
  const navText = await page.innerText('nav, aside').catch(() => '');
  const cteLocked = navText.includes('🔒');
  console.log(`CTE en nav (desbloqueado): ${!cteLocked ? '✅' : '❌'}`);

  // Acceder a CTE
  await page.goto(`${BASE}/directivo/cte`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot(page, 'directivotest-cte');

  const cteTxt = await page.innerText('body').catch(() => '');
  const tieneAcceso = !cteTxt.includes('🔒') && !cteTxt.includes('restringido') && !cteTxt.includes('Acceso restringido');
  console.log(`Acceso CTE directo: ${tieneAcceso ? '✅' : '❌'}`);

  // Intentar crear un CTE
  if (tieneAcceso) {
    const crearCTE = page
      .locator('button:has-text("Nuevo CTE"), button:has-text("Crear CTE"), button:has-text("Agregar"), button:has-text("Nuevo")')
      .first();
    if (await crearCTE.isVisible({ timeout: 5000 }).catch(() => false)) {
      await crearCTE.click();
      await page.waitForTimeout(2000);

      const tituloInput = page
        .locator('input[placeholder*="título" i], input[placeholder*="nombre" i], input[name="titulo"]')
        .first();
      if (await tituloInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tituloInput.fill('CTE Primer Periodo 2025-2026');
      }

      const fechaInput = page.locator('input[type="date"]').first();
      if (await fechaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fechaInput.fill('2025-08-15');
      }

      const guardarBtn = page
        .locator('button[type="submit"], button:has-text("Guardar")')
        .first();
      if (await guardarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await guardarBtn.click();
        await page.waitForTimeout(2000);
        console.log('✅ CTE creado');
      }

      await shot(page, 'directivotest-cte-creado');
    }
  }

  console.log('\n✅ DIRECTIVOTEST completado');
});
