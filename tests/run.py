"""Banco de pruebas de Jabner.

Sirve la web desde la carpeta del repo con las mismas cabeceras que vercel.json (CSP incluida)
y contesta las llamadas a Supabase con un PostgREST falso en memoria. Reloj fijo para que
las pruebas no dependan del día. Uso:  python3 tests/run.py   (necesita playwright + chromium)
"""
import json, os, re, sys, uuid, urllib.parse as up
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = "https://jabner.test"
SUPA = "https://wuilmkfwxcexsepdcpdn.supabase.co"
LLAVE = "k" * 24
A, J = "00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"
HOY = "2026-11-04"  # miércoles
VERCEL = json.load(open(os.path.join(RAIZ, "vercel.json")))
CAB = {h["key"]: h["value"] for h in VERCEL["headers"][0]["headers"]}
PLAN = json.load(open(os.path.join(RAIZ, "tests", "plan.json")))
CLAVES = {"recomp_dias": ("profile_id", "fecha"), "recomp_objetivos": ("profile_id",), "jabner_habitos_log": ("habito_id", "fecha")}
TIPOS = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2"}


def base_datos():
    dias = {}
    def d(f, **k):
        dias[f] = {"profile_id": A, "fecha": f, "hechos": [], "comidas": [], "peso": None, "whoop": None, "animo": None, "pasos": None,
                   "sueno": None, "dieta": None, "nota": None, "descanso": False, "extras": [], "entreno": None, **k}
    # racha de 3 días antes de hoy (amarillos), lunes con sesión 1 y peso apuntado la semana anterior
    d("2026-10-26", pasos=11000, sueno=3, dieta=3, entreno={"semana": "PRUEBA SEMANA 2", "sesion": 1, "hecho": True, "pesos": {"PRESS MILITAR MÁQUINA": 30}})
    d("2026-11-01", pasos=7000, dieta=2, sueno=2)
    d("2026-11-02", pasos=9000, dieta=2, sueno=3, entreno={"semana": "PRUEBA SEMANA 2", "sesion": 1, "hecho": True, "pesos": {"PRESS MILITAR MÁQUINA": 32.5}})
    d("2026-11-03", pasos=6000, dieta=3, sueno=2, descanso=True)
    return {
        "recomp_dias": list(dias.values()),
        "recomp_mediciones": [{"id": "m1", "profile_id": A, "fecha": "2026-10-01", "peso": 90, "grasa_pct": 22, "musculo_kg": 38, "visceral": 90},
                              {"id": "m2", "profile_id": A, "fecha": "2026-10-29", "peso": 88, "grasa_pct": 21, "musculo_kg": 38.4, "visceral": 85}],
        "recomp_objetivos": [{"profile_id": A, "fecha_inicio": "2026-10-01", "peso_inicial": 90, "peso_objetivo": 81, "fecha_objetivo": "2026-12-31", "prot_obj": 170, "kcal_obj": 2000, "plan_semana": "PRUEBA SEMANA 2"}],
        "jabner_habitos": [{"id": "h1", "profile_id": A, "area": "mente", "nombre": "Leer 15 min", "orden": 1, "activo": True, "created_at": "2026-11-01"}],
        "jabner_habitos_log": [], "jabner_movimientos": [
            {"id": "f1", "profile_id": A, "fecha": "2026-10-01", "tipo": "ingreso", "importe": 900, "facturado": 2500, "moneda": "EUR", "categoria": "trud", "concepto": "Venta octubre", "origen": "app", "created_at": "2026-10-01"},
            {"id": "f2", "profile_id": A, "fecha": "2026-10-01", "tipo": "gasto", "importe": 300, "facturado": None, "moneda": "EUR", "categoria": "casa", "concepto": "Villa", "origen": "app", "created_at": "2026-10-01"},
            {"id": "f3", "profile_id": A, "fecha": "2026-09-01", "tipo": "ingreso", "importe": 500, "facturado": None, "moneda": "EUR", "categoria": "trud", "concepto": "Septiembre", "origen": "app", "created_at": "2026-09-01"}],
    }


class FakeSupabase:
    def __init__(self):
        self.db = base_datos(); self.fallar = False; self.llamadas = []

    def filtrar(self, filas, qs):
        for k, vs in qs.items():
            if k in ("select", "order", "limit", "offset", "on_conflict", "columns"): continue
            for v in vs:
                op, _, val = v.partition(".")
                if op == "not": filas = [r for r in filas if r.get(k) is not None]; continue
                f = {"eq": lambda a, b: str(a).lower() == b.lower() if isinstance(a, bool) else str(a) == b, "gte": lambda a, b: a is not None and str(a) >= b,
                     "lte": lambda a, b: a is not None and str(a) <= b}[op]
                filas = [r for r in filas if f(r.get(k), val)]
        return filas

    def __call__(self, route):
        req = route.request; u = up.urlparse(req.url); qs = up.parse_qs(u.query); path = u.path
        self.llamadas.append((req.method, path))
        hdr = {k.lower(): v for k, v in req.headers.items()}
        cors = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"}
        if req.method == "OPTIONS": return route.fulfill(status=204, headers=cors)
        ok = True  # sin llave
        js = lambda st, body: route.fulfill(status=st, headers={**cors, "content-type": "application/json"}, body=json.dumps(body))
        if path == "/rest/v1/rpc/recomp_ajustes":
            return js(200, [{"clave": "ahmed", "id": A, "nombre": "Ahmed", "plan": True}, {"clave": "javi", "id": J, "nombre": "Javi", "plan": False}] if ok else None)
        if path == "/functions/v1/recomp-plan":
            if not ok: return js(401, {"error": "llave"})
            body = json.loads(req.post_data or "{}"); return js(200, PLAN if body.get("perfil") == A else {"semanas": []})
        if path == "/functions/v1/recomp-comida":
            body = json.loads(req.post_data or "{}")
            return js(200, {"platos": [{"n": "Lentejas con chorizo (plato)", "k": 560, "p": 28, "c": 60, "f": 22}, {"n": "Pan 60 g", "k": 160, "p": 5, "c": 32, "f": 1}],
                            "dieta": 2, "conclusion": f"Llevas {body['llevas']['prot'] + 33} g de proteína; en la cena mete 50 g más."})
        m = re.match(r"/rest/v1/(\w+)$", path)
        if not m: return js(404, {})
        t = m.group(1); tabla = self.db.setdefault(t, [])
        if req.method != "GET" and self.fallar: return js(500, {"message": "fallo simulado"})
        if req.method == "GET":
            filas = self.filtrar(tabla, qs) if ok else []
            if "order" in qs:
                for o in reversed(qs["order"][0].split(",")):
                    c, _, dirn = o.partition("."); filas = sorted(filas, key=lambda r: (r.get(c) is None, r.get(c)), reverse=dirn.startswith("desc"))
            if "limit" in qs: filas = filas[: int(qs["limit"][0])]
            if "vnd.pgrst.object" in hdr.get("accept", ""):
                return js(200, filas[0]) if len(filas) == 1 else js(406, {"code": "PGRST116", "message": "0 rows"})
            return js(200, filas)
        if not ok: return js(401, {"message": "llave"})
        if req.method == "POST":
            body = json.loads(req.post_data); body = body if isinstance(body, list) else [body]
            pref = hdr.get("prefer", ""); clave = CLAVES.get(t)
            out = []
            for b in body:
                if "merge-duplicates" in pref and clave:
                    ex = next((r for r in tabla if all(str(r.get(c)) == str(b.get(c)) for c in clave)), None)
                    if ex: ex.update(b); out.append(ex); continue
                b = {"id": str(uuid.uuid4()), **b}; tabla.append(b); out.append(b)
            return js(201, out if "return=representation" in pref else [])
        if req.method == "PATCH":
            for r in self.filtrar(tabla, qs): r.update(json.loads(req.post_data))
            return js(204 if "return=representation" not in hdr.get("prefer", "") else 200, [])
        if req.method == "DELETE":
            quitar = self.filtrar(tabla, qs); self.db[t] = [r for r in tabla if r not in quitar]; return js(204, [])
        return js(405, {})

    def dia(self, f, p=A):
        return next((r for r in self.db["recomp_dias"] if r["fecha"] == f and r["profile_id"] == p), None)


def servir(route):
    path = up.urlparse(route.request.url).path
    if path == "/": path = "/index.html"
    fn = os.path.join(RAIZ, path.lstrip("/"))
    if not os.path.splitext(fn)[1] and os.path.exists(fn + ".html"): fn += ".html"
    if not os.path.isfile(fn): return route.fulfill(status=404, body="no")
    route.fulfill(status=200, headers={**CAB, "content-type": TIPOS.get(os.path.splitext(fn)[1], "application/octet-stream")}, body=open(fn, "rb").read())


FALLOS = []
def check(cond, msg):
    print(("  ok   " if cond else "  FALLO ") + msg)
    if not cond: FALLOS.append(msg)


def abrir(ctx, fake, ruta):
    pg = ctx.new_page(); errores = []
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.on("console", lambda m: errores.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.route(WEB + "/**", servir); pg.route(SUPA + "/**", fake)
    pg.clock.set_fixed_time(HOY + "T10:00:00")
    pg.add_init_script(f"localStorage.setItem('recomp.llave','{LLAVE}');localStorage.setItem('recomp.perfil','ahmed')")
    pg.goto(WEB + ruta); pg.wait_for_selector("#app:not([hidden])", timeout=8000); pg.wait_for_timeout(500)
    return pg, errores


def sin_desborde(pg):
    return pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")


def runTests():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for ancho in (320, 375, 1440):
            print(f"\n== {ancho} px")
            fake = FakeSupabase()
            ctx = b.new_context(viewport={"width": ancho, "height": 900}, timezone_id="Europe/Madrid", locale="es-ES", permissions=["clipboard-read", "clipboard-write"], service_workers="block")
            pg, err = abrir(ctx, fake, "/")
            check(not err, f"sin errores al cargar Recomp {err[:2]}")
            check(sin_desborde(pg), "sin scroll horizontal")
            check(pg.inner_text("#estadoDia") == "Sin apuntar", "hoy empieza sin apuntar")
            check(pg.inner_text("#rachaN") == "3", f"racha de 3 días (hay {pg.inner_text('#rachaN')})")
            check(pg.locator("#sesBtns button").count() == 3, "3 sesiones del plan")
            check(pg.inner_text("#fzN") == "1" and pg.inner_text("#fzObj") == "/3", "1/3 sesiones esta semana")
            # día rojo: pocos pasos + comida mal + sin entreno
            pg.click('#pasos [data-p="3000"]'); pg.click('#dieta [data-v="1"]'); pg.wait_for_timeout(300)
            check("rojo" in pg.inner_text("#estadoDia"), "pocos pasos + comida mal + sin entreno = día rojo")
            check(pg.inner_text("#rachaN") == "0", f"un día rojo corta la racha (hay {pg.inner_text('#rachaN')})")
            check(fake.dia(HOY) and fake.dia(HOY)["pasos"] == 3000 and fake.dia(HOY)["dieta"] == 1, "se guarda en Supabase al momento")
            # día verde: 12.000 pasos, 8 h, perfecto, sesión con peso
            pg.fill("#pasosIn", "12000"); pg.press("#pasosIn", "Tab")
            pg.click('#sueno [data-v="3"]'); pg.click('#dieta [data-v="3"]'); pg.wait_for_timeout(300)
            check("amarillo" in pg.inner_text("#estadoDia"), "sin entreno el día queda amarillo")
            check(pg.inner_text("#rachaN") == "4", "la racha cuenta amarillos")
            pg.click('#sesBtns [data-s="2"]')
            inp = pg.locator("#sesion input[data-e]").first
            nombre = inp.get_attribute("data-e"); inp.fill("40"); inp.press("Tab"); pg.wait_for_timeout(400)
            d = fake.dia(HOY)
            check(d["entreno"] and d["entreno"]["sesion"] == 2 and d["entreno"]["pesos"].get(nombre) == 40 and d["entreno"]["hecho"], "apuntar un peso marca la sesión")
            check("verde" in pg.inner_text("#estadoDia"), "los 4 en verde = día verde")
            check(pg.inner_text("#fzN") == "2", "2/3 sesiones tras entrenar")
            check(pg.locator("#descansoBtn").is_disabled(), "con sesión hecha no se puede marcar descanso")
            # extras
            pg.click('#extras [data-x="Pádel"]'); pg.wait_for_timeout(200)
            check(any(x["t"] == "Pádel" for x in fake.dia(HOY)["extras"]), "extra de un toque")
            # ficha con historial
            pg.click('#sesBtns [data-s="1"]'); pg.locator("#sesion [data-f]").filter(has_text="Press militar").first.click()
            check(pg.locator("#ficha[open]").count() == 1 and "32,5" in pg.inner_text("#fichaIn"), "ficha con récord e historial")
            pg.click("#fichaIn [data-cerrar]")
            # calendario: corregir un día
            pg.click('#cal [data-d="2026-11-01"]')
            pg.fill("#hPasos", "10500"); pg.click('#hojaIn [data-k="sueno"] [data-v="3"]'); pg.click('#hojaIn [data-k="dieta"] [data-v="3"]')
            pg.select_option("#hEnt", "libre"); pg.click("#hGuardar"); pg.wait_for_timeout(300)
            d = fake.dia("2026-11-01")
            check(d["pasos"] == 10500 and d["entreno"]["hecho"] and d["sueno"] == 3, "tocar un día del calendario lo corrige")
            # semanas y resumen
            check("Cumplida" in pg.inner_text("#semanas") or "Faltó" in pg.inner_text("#semanas"), "bloque de semanas")
            pg.click("#resumenBtn"); pg.wait_for_timeout(200)
            txt = pg.evaluate("navigator.clipboard.readText()")
            check("Sesiones: 2/3" in txt and "40 kg" in txt, "resumen para el entrenador con pesos")
            # cómo vas
            check(pg.inner_text("#vasEstado").replace("\n", " ") in ("En línea", "Casi", "Fuera"), f"cómo vas: {pg.inner_text('#vasEstado')}")
            check("88" in pg.inner_text("#sUlt"), "último InBody")
            pg.click('#kpis4 [data-m="grasa"]'); check(pg.locator("#gCuerpo svg").count() == 1, "cambiar indicador cambia la gráfica")
            # comida: carta de casa
            pg.click("#addBtn"); pg.click('.chips [data-r="casa"]'); pg.fill("#buscar", "lentejas"); pg.locator("#lista .opt").first.click(); pg.wait_for_timeout(200)
            check(any("Lentejas" in c["n"] for c in fake.dia(HOY)["comidas"]), "platos de casa en la carta")
            # cuéntame qué has comido
            pg.fill("#iaTexto", "lentejas con chorizo y pan"); pg.click("#iaBtn"); pg.wait_for_timeout(500)
            d = fake.dia(HOY)
            check(any(c["r"] == "ia" and "Pan" in c["n"] for c in d["comidas"]) and d["dieta"] == 2, "Claude apunta los platos y la nota de comida")
            check("en la cena" in pg.inner_text("#iaConclusion"), "se ve la conclusión")
            # si un guardado falla, vuelve a lo guardado y avisa
            fake.fallar = True
            pg.click('#animo [data-a="5"]'); pg.wait_for_timeout(500)
            check(pg.get_attribute('#animo [data-a="5"]', "aria-pressed") == "false" and "No se pudo" in pg.inner_text("#toast"), "fallo al guardar: deshace y avisa")
            fake.fallar = False
            check(sin_desborde(pg), "sin scroll horizontal tras usarla")
            err[:] = [e for e in err if "fallo simulado" not in e]
            check(not err, f"sin errores tras usar Recomp {err[:2]}")
            pg.screenshot(path=f"/tmp/jabner-recomp-{ancho}.png", full_page=True)
            # cambio de perfil: Javi sin plan
            pg.click('[data-p="javi"]'); pg.wait_for_timeout(400)
            check(pg.locator("#sesBtns button").count() == 0 and "He entrenado" in pg.inner_text("#sesion"), "Javi sin plan: entreno simple")
            # otras páginas
            # una sola pantalla: hábitos y finanzas en la misma página
            pg.click('[data-p="ahmed"]'); pg.wait_for_timeout(300)
            check(pg.locator("a.modulo").count() == 0 and pg.locator("#hCart table").count() == 1 and pg.locator("#fTotales").count() == 1, "todo en una sola pantalla")
            pg.locator('#hHoy [data-val="1"]').first.click(); pg.wait_for_timeout(200)
            check(pg.inner_text("#kHab") == "1/1", f"marcar un hábito sube la cifra de arriba ({pg.inner_text('#kHab')})")
            pg.fill("#aImp", "12"); pg.click('#alta button[type=submit]'); pg.wait_for_timeout(400)
            check("12" in pg.inner_text("#kGasto"), f"un gasto sube la cifra de arriba ({pg.inner_text('#kGasto')})")
            check(pg.locator("#conclus li").count() >= 1, "salen conclusiones")
            check(pg.locator("#fMeses tr").count() >= 3 and "3.000" in pg.inner_text("#fTotal").replace("\u202f",".") , f"tabla mes a mes con facturado ({pg.inner_text('#fTotal')})")
            pg.click('#fMeses tr[data-m="2026-10"]'); pg.wait_for_timeout(200)
            check("Venta octubre" in pg.inner_text("#hIng") and "2500" in pg.inner_text("#hIng").replace(".","").replace("\u202f",""), "tocar un mes enseña su hoja con lo facturado")
            check(pg.locator(".fgraf rect[data-m]").count() >= 3, "gráfica de columnas por mes")
            check(sin_desborde(pg), "sin scroll horizontal al final")
            pg.screenshot(path=f"/tmp/jabner-final-{ancho}.png", full_page=True)
            ctx.close()
        b.close()
    print(f"\n{'TODO OK' if not FALLOS else str(len(FALLOS)) + ' FALLOS'}")
    return not FALLOS


if __name__ == "__main__":
    sys.exit(0 if runTests() else 1)
