# Porta /caracteristicas y /caracteristicas/data-sheet de la app de Trámites a
# páginas estáticas dentro del sitio de logiu, conservando el diseño original.
#
# Toma el HTML tal como lo renderiza Rails (servidor de desarrollo), le saca el
# andamiaje de la app (importmap, Stimulus, CSRF) y lo reemplaza por un shim de
# ~60 líneas que reimplementa los cuatro comportamientos que estas dos páginas
# usan: reveal, contador, tabs e imprimir.
#
#   python3 portar.py            (requiere bin/rails server en :3000)

import re, urllib.request, pathlib, html

ORIGEN = "http://127.0.0.1:3000"
DESTINO = pathlib.Path("/home/joaco/proyectos/logiu/tramites-digitales")

def bajar(path):
    with urllib.request.urlopen(ORIGEN + path) as r:
        return r.read().decode("utf-8")

# ------------------------------------------------------------------ shim JS
# Reimplementación vanilla de los controladores Stimulus de app/javascript/controllers.
SHIM = """
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var haveIO = 'IntersectionObserver' in window;

  // reveal_controller.js
  document.querySelectorAll('[data-controller~="reveal"]').forEach(function (root) {
    var items = root.querySelectorAll('[data-reveal-item]');
    if (!items.length) items = [root];
    items = Array.prototype.slice.call(items);
    if (!haveIO || reduce) {
      items.forEach(function (i) { i.classList.add('is-revealed'); });
      return;
    }
    var stagger = parseInt(root.dataset.revealStaggerValue || '70', 10);
    items.forEach(function (i) { i.classList.add('reveal-pending'); });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--reveal-delay', (items.indexOf(e.target) * stagger) + 'ms');
        e.target.classList.add('is-revealed');
        obs.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (i) { obs.observe(i); });
  });

  // contador_controller.js
  document.querySelectorAll('[data-controller~="contador"]').forEach(function (el) {
    var objetivo = parseInt(el.dataset.contadorObjetivoValue, 10);
    if (!haveIO || reduce || isNaN(objetivo)) return;
    var obs = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      obs.disconnect();
      var inicio = performance.now();
      (function paso(ahora) {
        var avance = Math.min((ahora - inicio) / 1100, 1);
        el.textContent = Math.round(objetivo * (1 - Math.pow(1 - avance, 3)));
        if (avance < 1) requestAnimationFrame(paso);
      })(inicio);
    }, { threshold: 0.6 });
    obs.observe(el);
  });

  // tabs_controller.js (subconjunto: sin anidamiento ni turbo-frames)
  document.querySelectorAll('[data-controller~="tabs"]').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-tabs-target~="tab"]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-tabs-target~="panel"]'));
    if (!tabs.length) return;
    function show(name) {
      panels.forEach(function (p) { p.classList.toggle('hidden', p.dataset.tabName !== name); });
      tabs.forEach(function (t) {
        var activo = t.dataset.tabName === name;
        t.classList.toggle('tab-active', activo);
        t.setAttribute('aria-selected', activo);
        t.tabIndex = activo ? 0 : -1;
      });
    }
    function mover(e, delta) {
      var actual = tabs.findIndex(function (t) { return t.classList.contains('tab-active'); });
      if (actual === -1) return;
      e.preventDefault();
      var prox = tabs[(actual + delta + tabs.length) % tabs.length];
      prox.focus(); prox.click();
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { show(t.dataset.tabName); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') mover(e, +1);
        if (e.key === 'ArrowLeft') mover(e, -1);
      });
    });
    show(tabs[0].dataset.tabName);
  });

  // imprimir_controller.js
  document.querySelectorAll('[data-action~="imprimir#imprimir"]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.print(); });
  });
})();
"""

# ------------------------------------------------------------------ conversión
def cuerpo(doc):
    """Devuelve (atributos del body, html interno) sin los <script> de la app."""
    m = re.search(r"<body([^>]*)>(.*)</body>", doc, re.S)
    attrs, inner = m.group(1), m.group(2)
    inner = re.sub(r"<script\b.*?</script>", "", inner, flags=re.S)
    # El guard de submit es de formularios de la app: acá no hay ninguno.
    attrs = re.sub(r'\sdata-controller="submit-guard"', "", attrs)
    attrs = re.sub(r'\sdata-action="turbo:[^"]*"', "", attrs)
    return attrs, inner

def pagina(doc, titulo, descripcion, url, enlaces, body_extra=""):
    attrs, inner = cuerpo(doc)
    for viejo, nuevo in enlaces.items():
        inner = inner.replace('href="%s"' % viejo, 'href="%s"' % nuevo)
    # Las capturas pasan a ser archivos del sitio, sin digest de Propshaft.
    inner = re.sub(r'/assets/caracteristicas/([a-z]+)-[0-9a-f]+\.png', r'capturas/\1.png', inner)
    return f"""<!DOCTYPE html>
<html lang="es" class="h-full">
<head>
<meta charset="utf-8">
<title>{html.escape(titulo)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{html.escape(descripcion)}">
<meta property="og:title" content="{html.escape(titulo)}">
<meta property="og:description" content="{html.escape(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<link rel="icon" href="{enlaces['__base__']}icono.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{enlaces['__base__']}estilos.css">
</head>
<body{attrs}>
{inner}
{body_extra}
<script>{SHIM}</script>
</body>
</html>
"""

# ------------------------------------------------------------------ main
DESTINO.mkdir(parents=True, exist_ok=True)
(DESTINO / "data-sheet").mkdir(exist_ok=True)

# CSS: la hoja compilada de la app, tal cual (el diseño entero vive acá).
css = ""
for href in re.findall(r'href="(/assets/(?:application|tailwind)-[0-9a-f]+\.css)"', bajar("/caracteristicas")):
    if href not in css:
        css += "/* %s */\n" % href + bajar(href) + "\n"
(DESTINO / "estilos.css").write_text(css, encoding="utf-8")

# Capturas: se bajan del mismo servidor, resolviendo el digest de Propshaft, para
# que regenerar la página traiga también las imágenes nuevas.
def bajar_capturas(doc):
    destino = DESTINO / "capturas"
    destino.mkdir(exist_ok=True)
    for href in sorted(set(re.findall(r'/assets/caracteristicas/[a-z]+-[0-9a-f]+\.png', doc))):
        nombre = re.sub(r'-[0-9a-f]+\.png$', '.png', href.rsplit("/", 1)[1])
        with urllib.request.urlopen(ORIGEN + href) as r:
            (destino / nombre).write_bytes(r.read())
        print("capturas/%s" % nombre)

DESC_CARAC = ("Portal municipal de trámites en línea: solicitudes con seguimiento por estados, "
              "bandeja del personal, mensajería y notificaciones.")
DESC_DS = ("Data sheet de Trámites Digitales: catálogo de módulos, procedimientos por rol y "
           "matriz completa de roles y permisos.")

volver = ('<p class="mx-auto max-w-[1200px] px-6 pb-10 text-center text-[13px] text-[#8b97a8]">'
          '<a class="font-semibold text-marca hover:underline" href="%s">← Volver a logiu</a></p>')

carac = bajar("/caracteristicas")
bajar_capturas(carac)
(DESTINO / "index.html").write_text(pagina(
    carac, "Trámites Digitales · logiu", DESC_CARAC,
    "https://logiu.com.ar/tramites-digitales",
    {"/caracteristicas": "./", "/caracteristicas/data-sheet": "data-sheet/", "__base__": ""},
    volver % "/"), encoding="utf-8")

ds = bajar("/caracteristicas/data-sheet")
(DESTINO / "data-sheet" / "index.html").write_text(pagina(
    ds, "Data sheet · Trámites Digitales · logiu", DESC_DS,
    "https://logiu.com.ar/tramites-digitales/data-sheet",
    {"/caracteristicas": "../", "/caracteristicas/data-sheet": "./", "__base__": "../"},
    volver % "/"), encoding="utf-8")

for p in ["index.html", "data-sheet/index.html", "estilos.css"]:
    print("%-24s %6.1f KB" % (p, (DESTINO / p).stat().st_size / 1024))
