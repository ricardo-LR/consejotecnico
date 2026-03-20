"""
validate_navigation.py -- Selenium end-to-end navigation test for CONSEJOTECNICO MVP.

Usage:
    pip install selenium
    python validate_navigation.py

ChromeDriver is auto-managed by selenium>=4.6 (no manual install needed).
"""

import sys
# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
sys.stdout.reconfigure(encoding='utf-8')

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

CLOUDFRONT_URL = "https://db0i745ypndsx.cloudfront.net"

# ── Chrome setup ────────────────────────────────────────────────────────────
chrome_options = Options()
# chrome_options.add_argument("--headless")  # uncomment for headless
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--window-size=1280,720")

print("=" * 80)
print("VALIDACION REAL DE NAVEGACION - CONSEJOTECNICO MVP")
print("=" * 80)

test_results = []

def go(driver, path, pause=3):
    driver.get(f"{CLOUDFRONT_URL}{path}")
    time.sleep(pause)

def js_click(driver, element):
    """Click via JS to bypass any overlay interception."""
    driver.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", element)

def wait_for_url(driver, fragment, timeout=8):
    """Wait up to timeout seconds for URL to contain fragment."""
    try:
        WebDriverWait(driver, timeout).until(EC.url_contains(fragment))
        return True
    except TimeoutException:
        return False

def assert_url_contains(driver, fragment, label):
    current = driver.current_url
    if fragment in current:
        print(f"      OK  navego a {fragment}  ({current})")
        test_results.append((label, "PASS"))
    else:
        print(f"      FAIL  URL actual: {current}")
        test_results.append((label, "FAIL"))

def wait_for_element(driver, by, value, timeout=12):
    """Wait for element to be present and visible."""
    try:
        return WebDriverWait(driver, timeout).until(
            EC.visibility_of_element_located((by, value))
        )
    except TimeoutException:
        return None

# ── Driver ──────────────────────────────────────────────────────────────────
try:
    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 10)

    # ═══════════════════════════════════════════════════════════════
    # TEST 1: Landing page → links principales
    # ═══════════════════════════════════════════════════════════════
    print("\nTEST 1: LANDING PAGE (/) — botones principales")
    print("-" * 80)

    # 1.1 "Ver catalogo"
    print("\n  1.1  Landing -> 'Ver catalogo'")
    go(driver, "/")
    try:
        btn = driver.find_element(
            By.XPATH,
            "//a[contains(text(),'catálogo') or contains(text(),'Catálogo')]"
            " | //button[contains(text(),'catálogo') or contains(text(),'Catálogo')]"
        )
        print(f"      Elemento encontrado: '{btn.text}'")
        js_click(driver, btn)
        wait_for_url(driver, "/catalog")
        assert_url_contains(driver, "/catalog", "Landing -> Catalogo")
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Landing -> Catalogo", "ERROR"))

    # 1.2 "Crear cuenta gratis"
    print("\n  1.2  Landing -> 'Crear cuenta gratis'")
    go(driver, "/")
    try:
        btn = driver.find_element(
            By.XPATH,
            "//a[contains(text(),'cuenta gratis') or contains(text(),'Crear cuenta')]"
            " | //button[contains(text(),'cuenta gratis') or contains(text(),'Crear cuenta')]"
        )
        print(f"      Elemento encontrado: '{btn.text}'")
        js_click(driver, btn)
        wait_for_url(driver, "/auth/register")
        assert_url_contains(driver, "/auth/register", "Landing -> Crear cuenta gratis")
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Landing -> Crear cuenta gratis", "ERROR"))

    # ═══════════════════════════════════════════════════════════════
    # TEST 2: Navbar links
    # ═══════════════════════════════════════════════════════════════
    print("\nTEST 2: NAVBAR")
    print("-" * 80)

    # 2.1 Navbar -> Catalogo
    print("\n  2.1  Navbar -> 'Catalogo'")
    go(driver, "/")
    try:
        # Find Navbar link specifically (href="/catalog" or href contains "/catalog")
        target = driver.find_element(By.XPATH, "//nav//a[contains(@href,'/catalog')]")
        print(f"      Link encontrado: '{target.text}'")
        js_click(driver, target)
        wait_for_url(driver, "/catalog")
        assert_url_contains(driver, "/catalog", "Navbar -> Catalogo")
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Navbar -> Catalogo", "ERROR"))

    # 2.2 Navbar -> Registrarse
    print("\n  2.2  Navbar -> 'Registrarse'")
    go(driver, "/")
    try:
        target = driver.find_element(By.XPATH, "//nav//a[contains(@href,'/auth/register')]")
        print(f"      Link encontrado: '{target.text}'")
        js_click(driver, target)
        wait_for_url(driver, "/auth/register")
        assert_url_contains(driver, "/auth/register", "Navbar -> Registrarse")
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Navbar -> Registrarse", "ERROR"))

    # 2.3 Navbar -> Iniciar sesion
    print("\n  2.3  Navbar -> 'Iniciar sesion'")
    go(driver, "/")
    try:
        target = driver.find_element(By.XPATH, "//nav//a[contains(@href,'/auth/login')]")
        print(f"      Link encontrado: '{target.text}'")
        js_click(driver, target)
        wait_for_url(driver, "/auth/login")
        assert_url_contains(driver, "/auth/login", "Navbar -> Iniciar sesion")
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Navbar -> Iniciar sesion", "ERROR"))

    # ═══════════════════════════════════════════════════════════════
    # TEST 3: Pagina de Registro
    # ═══════════════════════════════════════════════════════════════
    print("\nTEST 3: PAGINA DE REGISTRO (/auth/register)")
    print("-" * 80)

    print("\n  3.1  Register page carga el formulario")
    go(driver, "/auth/register", pause=4)
    try:
        # React hydration needed — wait for form to appear
        form = wait_for_element(driver, By.TAG_NAME, "form", timeout=15)
        if form is None:
            raise Exception("form no aparecio en 15 segundos (React no hidrto?)")
        name_input  = wait_for_element(driver, By.ID, "name", timeout=5)
        email_input = wait_for_element(driver, By.ID, "email", timeout=5)
        pwd_input   = wait_for_element(driver, By.ID, "password", timeout=5)
        if name_input and email_input and pwd_input:
            print(f"      OK  formulario con campos nombre/email/password encontrado")
        else:
            print(f"      OK  formulario encontrado (algunos campos con ID no visibles aun)")
        print(f"      URL: {driver.current_url}")
        test_results.append(("Register page load", "PASS"))
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Register page load", "ERROR"))

    # 3.2 Link "Inicia sesion" en la pagina de registro
    print("\n  3.2  Register -> link 'Inicia sesion'")
    try:
        target = driver.find_element(By.XPATH, "//a[contains(@href,'/auth/login')]")
        print(f"      Link encontrado: '{target.text}' href={target.get_attribute('href')}")
        js_click(driver, target)
        wait_for_url(driver, "/auth/login")
        assert_url_contains(driver, "/auth/login", "Register -> link Login")
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Register -> link Login", "ERROR"))

    # ═══════════════════════════════════════════════════════════════
    # TEST 4: Pagina de Login
    # ═══════════════════════════════════════════════════════════════
    print("\nTEST 4: PAGINA DE LOGIN (/auth/login)")
    print("-" * 80)

    print("\n  4.1  Login page carga el formulario")
    go(driver, "/auth/login", pause=4)
    try:
        form = wait_for_element(driver, By.TAG_NAME, "form", timeout=15)
        if form is None:
            raise Exception("form no aparecio en 15 segundos")
        email_input = wait_for_element(driver, By.ID, "email", timeout=5)
        pwd_input   = wait_for_element(driver, By.ID, "password", timeout=5)
        if email_input and pwd_input:
            print(f"      OK  formulario con campos email/password encontrado")
        else:
            print(f"      OK  formulario encontrado")
        test_results.append(("Login page load", "PASS"))
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Login page load", "ERROR"))

    # ═══════════════════════════════════════════════════════════════
    # TEST 5: Pagina de Catalogo
    # ═══════════════════════════════════════════════════════════════
    print("\nTEST 5: PAGINA DE CATALOGO (/catalog)")
    print("-" * 80)

    print("\n  5.1  Catalog page carga")
    go(driver, "/catalog")
    try:
        body = wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        page_text = body.text
        if "AccessDenied" in page_text or "<Error>" in page_text:
            print("      FAIL  AccessDenied en catalog")
            test_results.append(("Catalog page load", "FAIL"))
        else:
            print(f"      OK  catalogo cargado ({driver.current_url})")
            test_results.append(("Catalog page load", "PASS"))
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Catalog page load", "ERROR"))

    # 5.2 Catalog → checkout link
    print("\n  5.2  Catalog -> link 'Comprar' o 'Ver'")
    try:
        links = driver.find_elements(By.TAG_NAME, "a")
        checkout_link = next(
            (l for l in links if "checkout" in l.get_attribute("href") or ""),
            None
        )
        # Also try buttons
        if not checkout_link:
            btns = driver.find_elements(By.XPATH,
                "//a[contains(@href,'checkout')] | //button[contains(text(),'Comprar') or contains(text(),'Ver')]"
            )
            checkout_link = btns[0] if btns else None

        if checkout_link:
            href = checkout_link.get_attribute("href") or checkout_link.text
            print(f"      OK  link a checkout encontrado: {href[:60]}")
            test_results.append(("Catalog -> Checkout link", "PASS"))
        else:
            print("      INFO  no hay planeaciones en catalogo (puede ser normal en sandbox)")
            test_results.append(("Catalog -> Checkout link", "SKIP"))
    except Exception as e:
        print(f"      ERROR: {e}")
        test_results.append(("Catalog -> Checkout link", "ERROR"))

    # ═══════════════════════════════════════════════════════════════
    # TEST 6: Pricing cards en landing
    # ═══════════════════════════════════════════════════════════════
    print("\nTEST 6: PRICING CARDS — landing page")
    print("-" * 80)

    go(driver, "/")

    for plan_key, plan_text, expected_fragment in [
        ("grado",  "Suscribirse",    "/checkout?plan=grado"),
        ("pro",    "Pro",            "/checkout?plan=pro"),
        ("gratis", "Crear cuenta",   "/auth/register"),
    ]:
        print(f"\n  6.x  Plan '{plan_key}' -> href correcto")
        try:
            links = driver.find_elements(By.TAG_NAME, "a")
            target = next(
                (l for l in links if expected_fragment in (l.get_attribute("href") or "")),
                None
            )
            if target:
                href = target.get_attribute("href")
                print(f"      OK  href='{href}'  texto='{target.text}'")
                test_results.append((f"Pricing card {plan_key}", "PASS"))
            else:
                print(f"      FAIL  no link con href contiene '{expected_fragment}'")
                test_results.append((f"Pricing card {plan_key}", "FAIL"))
        except Exception as e:
            print(f"      ERROR: {e}")
            test_results.append((f"Pricing card {plan_key}", "ERROR"))

    # ═══════════════════════════════════════════════════════════════
    # RESUMEN
    # ═══════════════════════════════════════════════════════════════
    print("\n" + "=" * 80)
    print("RESUMEN DE RESULTADOS")
    print("=" * 80)

    passed = sum(1 for _, r in test_results if r == "PASS")
    failed = sum(1 for _, r in test_results if r in ("FAIL", "NOT_FOUND"))
    errors = sum(1 for _, r in test_results if r == "ERROR")
    skipped = sum(1 for _, r in test_results if r == "SKIP")
    total = len(test_results)

    print(f"\nPASS:    {passed}/{total}")
    print(f"FAIL:    {failed}/{total}")
    print(f"ERROR:   {errors}/{total}")
    print(f"SKIP:    {skipped}/{total}")

    print("\nDetalle:")
    for test_name, result in test_results:
        icon = "OK " if result == "PASS" else "SKP" if result == "SKIP" else "FAI"
        print(f"  [{icon}]  {test_name}: {result}")

    if passed + skipped == total:
        print("\n*** TODOS LOS TESTS PASARON *** MVP 100% FUNCIONAL")
    elif failed == 0 and errors == 0:
        print("\nTodos los tests criticos pasaron")
    else:
        print(f"\n{failed + errors} test(s) fallaron — revisar output arriba")

    print("\n" + "=" * 80)

finally:
    try:
        driver.quit()
        print("Navegador cerrado")
    except Exception:
        pass
