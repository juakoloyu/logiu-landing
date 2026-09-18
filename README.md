# logiu — sitio

Sitio estático de [logiu.com.ar](https://logiu.com.ar): la landing de la agencia más
las páginas de caso de cada proyecto.

No hay build, ni framework, ni dependencias: son archivos HTML servidos tal cual.
Lo que está en `main` es exactamente lo que está publicado.

---

## Estructura

```
.
├── index.html              # la landing (export de un canvas de Claude Design)
├── tramites-digitales/     # caso: Trámites Digitales (portado desde la app)
│   ├── index.html          #   características
│   ├── data-sheet/         #   documento técnico, con imprimir / guardar PDF
│   ├── estilos.css         #   hoja compilada de la app (Tailwind), tal cual
│   └── capturas/*.png      #   capturas de producto
├── pinpadel/               # caso: PinPadel (escrito a mano, reusando ese diseño)
│   ├── index.html          #   funcionalidades
│   ├── estilos.css         #   copia de la hoja de Trámites, sin tocar
│   ├── paleta.css          #   los colores de PinPadel encima de esa hoja
│   └── capturas/*.png      #   capturas de producto
├── tierras/                # caso: Tierras (mismo molde que PinPadel)
│   ├── index.html          #   funcionalidades
│   ├── estilos.css         #   copia de la hoja de Trámites, sin tocar
│   ├── paleta.css          #   los colores de Tierras encima de esa hoja
│   └── capturas/*.png      #   capturas de producto, con datos inventados
├── tools/
│   ├── portar-tramites.py  # regenera las dos páginas de Trámites desde la app
│   ├── capturar-tierras.js # regenera las capturas de Tierras, anonimizadas
│   ├── ficcion-tierras.js  #   los datos inventados que tapan a los reales
│   └── verificar-anonimato.js # prueba que esos datos no sean de nadie real
├── .do/                    # restos del template de DigitalOcean (inertes, ver abajo)
├── .github/dependabot.yaml # heredado del template; el repo no tiene dependencias
└── .npmignore              # heredado del template
```

La landing y las páginas de caso son de naturaleza distinta y **se editan de
manera distinta**.

### `index.html` — la landing

No es HTML escrito a mano: es el **export bundleado de un canvas de Claude Design**.
~470 KB repartidos en 179 líneas (las que importan, kilométricas), con esta forma:

| Bloque | Qué es |
|---|---|
| `<script>` inicial | el cargador: arma el documento real y reemplaza la página |
| `<script type="__bundler/manifest">` | los assets (runtime JS, fuentes Poppins) en base64 + gzip |
| `<script type="__bundler/ext_resources">` | recursos externos (hoy vacío) |
| `<script type="__bundler/template">` | **el documento real**, guardado como un string JSON |

El contenido visible —secciones, textos, la lista de proyectos— vive dentro de ese
último string. La página se arma con componentes `x-dc`: `{{ accent }}` interpola
variables y `<sc-for list="{{ servicios }}">` repite un bloque por cada elemento de
un array definido en el `renderVals()` del final del mismo string. Hoy sólo
**Servicios** y **Proceso** se arman así; las filas de **Proyectos recientes** son
markup fijo, una `<a class="proj-row">` por proyecto, escritas una abajo de la otra.

**Para editarlo hay que decodificar y volver a codificar**, no buscar y reemplazar a
mano: dentro del string los `</` van escapados como `<\u002F`, y si eso se rompe el
navegador corta el `<script>` antes de tiempo y la página queda en blanco.

```python
import json

path = "index.html"
MARK = '<script type="__bundler/template">'
s = open(path, encoding="utf-8").read()
start = s.find(MARK) + len(MARK)
end = s.find("</script>", start)

tpl = json.loads(s[start:end].strip())     # el documento real, como texto normal

# ... editar tpl acá ...

raw = json.dumps(tpl, ensure_ascii=False).replace("</", "<\\u002F")
open(path, "w", encoding="utf-8").write(s[:start] + "\n" + raw + "\n  " + s[end:])
```

Después de editar, verificar que el bundle sigue entero: que `json.loads` del bloque
vuelva a parsear y que el archivo no tenga ningún `</` crudo dentro de ese string.

Rediseños grandes conviene hacerlos en el canvas y volver a exportar, no acá.

### `tramites-digitales/` — páginas de caso

**No están escritas a mano: son un port de la app de Trámites.** Las vistas
`/caracteristicas` y `/caracteristicas/data-sheet` siguen viviendo en el repo de
Trámites, que es donde se editan; acá hay una copia estática con el mismo diseño.

| Archivo | Viene de |
|---|---|
| `index.html` | `/caracteristicas` |
| `data-sheet/index.html` | `/caracteristicas/data-sheet` |
| `estilos.css` | las hojas compiladas de la app (Tailwind), concatenadas |
| `capturas/*.png` | `app/assets/images/caracteristicas/` de la app |

El port le saca el andamiaje de Rails (importmap, Stimulus, CSRF) y lo reemplaza por
un shim de ~60 líneas al final del `<body>` que reimplementa a mano los controladores
Stimulus: `reveal` (animación de entrada), `contador` (números que suben), `tabs` (la
galería de capturas) e `imprimir` (el botón **Imprimir / Guardar PDF** del data sheet,
que sigue funcionando: son 14 páginas A4 con el layout de impresión de la app).

**El port además saca la sección de cifras**, los cuatro contadores grandes del
principio. Es la única parte de la vista que la página de logiu no publica: adentro de
la app tienen sentido, de cara afuera son cuatro números sin contexto. Lo hace
`sin_cifras()`, que las ubica por los `data-cifra` de la vista. Va en el script y no a
mano sobre el HTML portado justamente porque el HTML portado lo pisa el próximo port;
el arreglo de fondo es sacar la sección de la vista en el repo de Trámites, y mientras
siga ahí el script la saca en cada pasada. Si un día no la encuentra, avisa por
consola en vez de seguir de largo. `contador` queda en el shim igual: si la vista suma
contadores en otro lado, siguen andando.

**Para regenerarlas** —cuando cambie la página en la app, o cuando cambien los
permisos y el data sheet quede viejo— con el servidor de Trámites levantado en
`:3000`:

```bash
python3 tools/portar-tramites.py
```

Eso reescribe el HTML, el CSS y las capturas desde cero. **No editar el HTML a mano**: el próximo
port lo pisa. Lo que hay que editar es la vista en el repo de Trámites.

Lo único que el script agrega de su cosecha: el `<head>` propio (título, meta
description y og para logiu, sin el `noindex` que la página tiene dentro de la app) y
el enlace "← Volver a logiu" al pie. Los links internos quedan relativos, así que las
dos páginas se pueden mover de carpeta sin romperse.

### `pinpadel/` — página de caso

**Esta sí está escrita a mano.** PinPadel (el repo `elcanchero`, una app Rails de
gestión para clubes de pádel) no tiene una vista `/caracteristicas` que portar, así
que `index.html` se escribió directo, reusando el diseño de Trámites: misma
estructura de secciones (hero, funcionalidades, galería, línea de tiempo), mismo JS al
pie y **el mismo `estilos.css`, copiado sin modificar**.

Dentro de Funcionalidades, los tres formatos de torneo —Americano, Americano de
parejas y Clásico— tienen su propia fila de tarjetas, con la familia `Formato`. Están
ahí porque son lo que más se pregunta del producto y se confunden entre sí: cada una
dice **cómo se inscribe** (solo o en pareja) y **cómo se compite** (todos contra
todos, o zonas más llaves).

El truco para que se vea como PinPadel y no como Trámites es `paleta.css`, que se
carga después:

| Archivo | Qué hace |
|---|---|
| `estilos.css` | copia byte a byte de `tramites-digitales/estilos.css` |
| `paleta.css` | redefine las cuatro variables de marca y los tres acentos de familia |

Toda la hoja de Trámites cuelga de `--color-brand`, `--color-brand-dark`,
`--color-brand-light` y `--color-brand-border` (de ahí salen `--l-dark`, `--color-ink`
y el resto por `color-mix`), más `--acento` en las clases `familia-*`. Cambiando esas
siete variables se cambia el sitio entero. PinPadel usa el azul noche y el lima de la
app (`#17253f` y `#c4d600`), y las familias pasan a ser club / jugador / organizador.

**Consecuencia:** `estilos.css` es una hoja de Tailwind ya compilada, así que sólo
contiene las clases que usan las páginas de Trámites. **No se puede inventar una clase
nueva de Tailwind**: si hace falta una, o se escribe a mano en `paleta.css`, o se
recompila la hoja en el repo de Trámites. Para verificar que no se coló ninguna:

```bash
python3 - <<'PY'
import re
css = open("pinpadel/estilos.css").read() + open("pinpadel/paleta.css").read()
html = open("pinpadel/index.html").read()
usadas = {c for m in re.findall(r'class="([^"]*)"', html) for c in m.split()}
esc = lambda c: re.sub(r'([.:\[\]()/%#,])', r'\\\1', c)
faltan = sorted(c for c in usadas if '.' + esc(c) not in css)
print(faltan or "todas las clases existen")
PY
```

Para actualizar `estilos.css` cuando cambie el de Trámites: `cp
tramites-digitales/estilos.css pinpadel/estilos.css`. `paleta.css` sobrevive al copy.

**Las capturas** (`capturas/*.png`) salieron de la app corriendo en local, con
Playwright, a 1440×757 como las de Trámites.

Lo que se fotografía **no es la base tal como viene**. La base de desarrollo tiene
~940 jugadores reales, con nombre y teléfono, repartidos entre cuatro complejos; el
único que se puede mostrar es el complejo de prueba (`sport_complex_id: 1`), y estaba
vacío o con basura (`test`, `Prueba`, `domoingo`). Así que antes de capturar se armó
un escenario adentro de ese complejo:

- 24 jugadores ficticios, marcados con `instagram: "demo-pinpadel"` para poder
  borrarlos (`Player.where(instagram: "demo-pinpadel")`)
- cuatro categorías jugadas de punta a punta —un Clásico con grupos y llaves, un
  Americano y dos Ligas— con resultados cargados por los servicios de la app, no
  escritos a mano en la tabla
- 85 turnos repartidos en la semana, con clientes ficticios (prefijo `DEMO `)
- 10 ventas de caja con un catálogo de buffet y horas distintas
- los torneos y los tipos de turno renombrados a algo presentable

**Regla:** ninguna captura puede salir de un complejo que no sea el 1, ni mostrar el
catálogo global de jugadores (`/jugadores`), que lista a todos los del sistema. Esa
pantalla se sacó de la galería justamente por eso; en su lugar va el perfil de un
jugador inventado.

### `tierras/` — página de caso

Tierras es el sistema de gestión de tierras fiscales del municipio de Sáenz Peña
(`tierras.modernizacionsp.ar`): nomenclador catastral, expedientes de posesión,
inspecciones, notas y pases entre áreas. La página está **escrita a mano con el molde
de PinPadel**: la misma estructura de secciones salvo la de cifras (ver abajo), el
mismo JS al pie, el mismo `estilos.css` copiado sin tocar, y un `paleta.css` que
cambia las siete variables de marca.

| Archivo | Qué hace |
|---|---|
| `estilos.css` | copia byte a byte de `tramites-digitales/estilos.css` |
| `paleta.css` | terracota `#9a4b1f` sobre marrón tierra `#3f2415`, y las familias catastro / expediente / atención |

Vale lo mismo que en PinPadel: la hoja es Tailwind ya compilado, así que **no se puede
inventar una clase nueva**. El chequeo de arriba sirve tal cual cambiando `pinpadel`
por `tierras`.

**Las capturas se regeneran con un script**, no a mano:

```bash
npm i playwright-core     # usa el Chrome del sistema, no descarga navegador
TIERRAS_DNI=... TIERRAS_PASS=... node tools/capturar-tierras.js
```

**Por qué hay un script y no capturas sueltas:** Tierras corre en producción contra el
padrón real de vecinos —6.617 expedientes con nombre, DNI y domicilio—. El script no
fotografía la pantalla tal como viene: antes de cada disparo corre una función
`sanear()` dentro de la página que reemplaza, celda por celda, todo dato personal por
uno inventado, y de paso rellena las columnas que en la base están en null (el
nomenclador catastral está casi vacío y una tabla de guiones no muestra nada). El
reemplazo es determinista —los valores salen de listas por índice de fila, sin azar—,
así que volver a correrlo da las mismas imágenes y el diff queda limpio.

**Regla:** ninguna captura de Tierras se toma a mano ni se publica sin pasar por
`sanear()`. Si se agrega una pantalla nueva a la galería, va con su entrada en
`CAPTURAS` y su mapa de columnas; y después **se mira la imagen**, que es lo único que
confirma que no quedó un nombre real suelto.

### Que el dato sea inventado no alcanza

Un nombre inventado puede coincidir con un vecino que existe, y entonces la captura
publicada lo señala igual que si lo hubiéramos copiado de la base. **No es hipotético:
pasó.** "Núñez, Rubén" —inventado— resultó ser una persona real del padrón, y estuvo
en `circulacion.png` hasta que lo detectó el chequeo.

Por eso los datos de ficción viven en `tools/ficcion-tierras.js` y hay un verificador:

```bash
TIERRAS_DNI=... TIERRAS_PASS=... node tools/verificar-anonimato.js
```

Descarga el padrón y las pantallas con personas, y contrasta cada DNI, teléfono y
nombre inventado contra el HTML crudo del servidor. Sale con código 1 si alguno
coincide, y **nunca imprime un dato real**: sólo cuántas veces coincide cada dato
inventado. Se compara contra el HTML crudo y no contra el DOM a propósito: DataTables
saca del DOM las filas que no se ven, así que mirar la página renderizada compara
contra diez filas en lugar de contra los ~6.600 registros.

**Después de tocar cualquier lista de `ficcion-tierras.js`, correrlo.** Los apellidos
frecuentes del nordeste son justamente los que más chocan: al buscar reemplazo para
"Núñez, Rubén", el primer candidato ("Aguirre, Rubén Ernesto") también coincidía.

### DNI y teléfonos: tapados, no inventados

Con los nombres, "no está en el sistema" es un criterio razonable. Con el DNI y el
celular no, porque el universo es todo el país: un DNI de 8 dígitos que parezca
creíble es casi con certeza el de alguien, esté o no cargado en Tierras, y un teléfono
además se marca. Como no hay forma de inventar uno y probar que no es de nadie, **no
se inventan: se tapan.** Se publica el formato, no el número.

| | Se ve | Dígitos a la vista |
|---|---|---|
| DNI | `••.•••.387` | 3 |
| Celular | `3644 ••••••` | 4 (el prefijo de la ciudad, que es público) |

Los últimos dígitos quedan visibles para que las filas se distingan entre sí; sueltos
no identifican a nadie. El verificador comprueba esta regla **antes** de mirar la base:
si en algún valor quedan más de 4 dígitos, sale con código 1. Probalo pegando un DNI
entero en la lista y corriéndolo: tiene que fallar.

El script además normaliza dos cosas de la app que si no arruinan la foto, y que
cuestan de encontrar:

- **`sidebar-mini`.** El panel de ajustes de Tierras deja esa clase pegada al `body`
  y la barra lateral queda en 80px, con los rótulos cortados a la mitad. Se le saca
  desde un `addInitScript`, antes de que corra nada de la app.
- **Los anchos de DataTables.** A cada columna le clava un ancho en línea, medido al
  arrancar y con el texto que traía la base. Con el texto ya reemplazado esos anchos
  no dan, la tabla se desborda del panel y la última columna sale cortada. La salida
  es **borrarlos** y dejar que el navegador reparta solo; `columns.adjust()` no sirve
  —ensancha todavía más— y un evento `resize` no hace nada.

**Ninguna de las tres páginas de caso lleva sección de cifras.** Las tres tenían el
mismo bloque —cuatro contadores grandes arriba de todo— y se sacó de las tres a
propósito: son humo y molestan más de lo que suman. En Tierras y PinPadel se borró el
markup; en Trámites lo saca el port en cada pasada (ver arriba). Como consecuencia,
`tierras/index.html` y `pinpadel/index.html` tampoco traen el `contador_controller.js`
al pie: no quedó nada que contar. La única copia que sobrevive está en el `SHIM` de
`tools/portar-tramites.py`.

---

## Levantarlo localmente

No hace falta instalar nada. Desde la raíz del repo:

```bash
python3 -m http.server 8000
```

- Landing → <http://localhost:8000/>
- Caso Trámites → <http://localhost:8000/tramites-digitales/>
- Data sheet → <http://localhost:8000/tramites-digitales/data-sheet/>
- Caso PinPadel → <http://localhost:8000/pinpadel/>
- Caso Tierras → <http://localhost:8000/tierras/>

Cualquier servidor estático sirve (`npx serve`, `php -S localhost:8000`, etc.).

Abrir los archivos con doble clic (`file://`) también los renderiza bien, pero los
links entre páginas están escritos como rutas absolutas (`/tramites-digitales`, `/`)
y apuntan a la raíz del disco: para probar la navegación hay que usar el servidor.

---

## Deploy

**Cloudflare Pages**, conectado al repo `juakoloyu/logiu-landing`.

```bash
git add -A
git commit -m "..."
git push origin main
```

Push a `main` → Pages reconstruye y publica solo. No hay paso de build (el sitio ya
es estático: se publica el repo tal cual), ni pipeline propio en este repositorio.
El dominio `logiu.com.ar` también se resuelve en Cloudflare.

**Verificar que salió lo que esperabas** (compara lo publicado contra el commit):

```bash
curl -sS https://logiu.com.ar | md5sum
git show HEAD:index.html | md5sum       # deben coincidir
```

Rollback: revertir el commit y volver a pushear, o republicar un deployment anterior
desde el panel de Pages.

`tools/` no participa del build (no hay build), pero Pages publica el repo tal cual,
así que los dos scripts quedan accesibles en `/tools/`. Son inocuos —ninguno tiene
credenciales: `capturar-tierras.js` las lee de `TIERRAS_DNI` y `TIERRAS_PASS`, y lo
único que nombra es la URL pública de la app—; si molestan, se borran o se excluyen
con `.assetsignore`.

### Sobre `.do/`

Este repo empezó como clon de [`digitalocean/sample-html`](https://github.com/digitalocean/sample-html)
y quedaron adentro `.do/app.yaml` y `.do/deploy.template.yaml`, que todavía describen
una app de DigitalOcean llamada `sample-html` apuntando al repo de ejemplo. **No
tienen efecto sobre el deploy actual**; se pueden borrar. Lo mismo `.npmignore` y
`.github/dependabot.yaml`, que vigila ecosistemas (bundler, composer, npm, pip…) que
este repo no usa.

---

## Agregar una página de caso nueva

1. Crear `nombre-del-caso/index.html` (queda servido en `/nombre-del-caso`). El
   molde a copiar es `pinpadel/`, no `tramites-digitales/`: el de Trámites es un port
   automático que el próximo `portar-tramites.py` pisa, el de PinPadel está escrito a
   mano justamente para eso. Copiar `index.html`, `estilos.css` y `paleta.css`, y
   cambiar los colores en la paleta.
2. Poner las imágenes en `nombre-del-caso/capturas/` y referenciarlas con rutas
   relativas (`capturas/foo.png`), nunca con `/`.
3. Sumar la fila en "Proyectos recientes" de la landing, editando el bundle con el
   procedimiento de arriba: copiar la última `<a class="proj-row">` de la sección y
   cambiarle `href`, título y bajada. La bajada entra en una sola línea hasta unos
   110 caracteres; más larga que eso, salta a dos y rompe el ritmo de la lista.
   Copiando una fila entera se hereda el `target="_blank" rel="noopener"` que llevan
   todas: los casos abren en pestaña nueva y la fila nueva tiene que hacer lo mismo.
4. Probar local con el servidor —que la fila se vea, que el link abra el caso en una
   pestaña nueva y que el "← Volver a logiu" vuelva—, y recién ahí pushear.
