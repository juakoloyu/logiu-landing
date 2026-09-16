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
├── tramites-digitales/
│   ├── index.html          # caso: Trámites Digitales (HTML escrito a mano)
│   └── capturas/*.png      # capturas de producto que embebe esa página
├── .do/                    # restos del template de DigitalOcean (inertes, ver abajo)
├── .github/dependabot.yaml # heredado del template; el repo no tiene dependencias
└── .npmignore              # heredado del template
```

Las dos páginas son de naturaleza distinta y **se editan de manera distinta**.

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
variables y `<sc-for list="{{ proyectos }}">` repite un bloque por cada elemento del
array `proyectos`, que está definido en un `renderVals()` al final del mismo string.

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

### `tramites-digitales/` — página de caso

HTML plano escrito a mano, autocontenido: un solo archivo con su `<style>` y un
`<script>` de ~10 líneas para las solapas de la galería. Copia los tokens visuales de
la landing (`#07080F` de fondo, acento `#C6FF4A`, tipografía Poppins desde Google
Fonts) para que las dos páginas se sientan la misma marca, pero no comparte código:
si cambian los colores de la landing, hay que replicarlos acá.

Se edita como cualquier HTML.

> **Ojo con el data sheet.** La segunda mitad de esa página (catálogo de módulos,
> procedimientos por rol y la matriz de 75 permisos × 6 roles) está copiada de la app
> de Trámites, donde se genera desde el código (`Rbac::Seeds` y los locales). Acá está
> congelada: si en la app cambian los permisos o los módulos, esta página queda
> desactualizada y hay que regenerarla a mano.

---

## Levantarlo localmente

No hace falta instalar nada. Desde la raíz del repo:

```bash
python3 -m http.server 8000
```

- Landing → <http://localhost:8000/>
- Caso Trámites → <http://localhost:8000/tramites-digitales/>

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

### Sobre `.do/`

Este repo empezó como clon de [`digitalocean/sample-html`](https://github.com/digitalocean/sample-html)
y quedaron adentro `.do/app.yaml` y `.do/deploy.template.yaml`, que todavía describen
una app de DigitalOcean llamada `sample-html` apuntando al repo de ejemplo. **No
tienen efecto sobre el deploy actual**; se pueden borrar. Lo mismo `.npmignore` y
`.github/dependabot.yaml`, que vigila ecosistemas (bundler, composer, npm, pip…) que
este repo no usa.

---

## Agregar una página de caso nueva

1. Crear `nombre-del-caso/index.html` (queda servido en `/nombre-del-caso`), tomando
   `tramites-digitales/index.html` como molde para no reinventar los estilos.
2. Poner las imágenes en `nombre-del-caso/capturas/` y referenciarlas con rutas
   relativas (`capturas/foo.png`), nunca con `/`.
3. Sumar la fila en "Proyectos recientes" de la landing, editando el bundle con el
   procedimiento de arriba. La fila de Trámites Digitales está como markup fijo antes
   del `<sc-for>` y sirve de ejemplo: es un `<a>` con la misma caja que las demás.
4. Probar local con el servidor, y recién ahí pushear.
