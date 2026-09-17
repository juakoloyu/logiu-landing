#!/usr/bin/env node
//
// Regenera tierras/capturas/*.png desde la app de Tierras en producción.
//
// La base de Tierras tiene el padrón real de vecinos de Sáenz Peña: nombres,
// DNI, teléfonos y expedientes de gente que existe. NINGUNA captura puede
// publicarse con eso adentro. Por eso el script no fotografía la pantalla tal
// como viene: antes de cada disparo corre `sanear()` dentro de la página, que
// reemplaza celda por celda todo dato personal por uno inventado.
//
// El reemplazo es determinista (los valores salen de una lista por índice de
// fila, sin azar), así que volver a correr el script produce las mismas
// imágenes y el diff de git queda limpio.
//
// De paso rellena las celdas que en la base están en null —el nomenclador
// catastral está casi vacío— porque una tabla de guiones no muestra nada.
//
// Uso:
//   npm i playwright-core        # usa el Chrome del sistema, no baja navegador
//   TIERRAS_DNI=... TIERRAS_PASS=... node tools/capturar-tierras.js
//
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.TIERRAS_URL || 'https://tierras.modernizacionsp.ar';
const DNI = process.env.TIERRAS_DNI;
const PASS = process.env.TIERRAS_PASS;
const DESTINO = path.join(__dirname, '..', 'tierras', 'capturas');
const VIEWPORT = { width: 1440, height: 757 }; // el mismo tamaño que Trámites y PinPadel

// Los datos inventados con los que se tapan los reales. Ver ese archivo antes
// de tocarlos: hay un verificador que los contrasta contra el sistema.
const FICCION = require('./ficcion-tierras.js');

// ── Saneamiento dentro de la página ─────────────────────────────────────────
// Se inyecta como string porque corre en el contexto del navegador.
function sanear(datos, plan) {
  const pick = (lista, i) => lista[i % lista.length];
  const panel = document.querySelector('.main-panel') || document.body;

  // Red de seguridad: la barra ya se ensancha desde `SIN_BARRA_MINI`, antes de
  // que corra nada de la app. Acá sólo se cubre el caso de que algo la haya
  // vuelto a poner después.
  document.body.classList.remove('sidebar-mini');

  // El usuario logueado aparece en la barra lateral de todas las pantallas.
  const mini = document.querySelector('.sidebar .logo-mini');
  const normal = document.querySelector('.sidebar .logo-normal');
  if (mini) mini.textContent = datos.operador.iniciales;
  if (normal) normal.innerHTML = `${datos.operador.nombre}<br>Administrador`;

  // Nº de expediente: mismo formato NNNN/AA que usa el sistema.
  const expediente = (i) => `${1200 + i * 137}/${String((i * 7 + 3) % 40).padStart(2, '0')}`;

  const celdas = (fila) => Array.from(fila.querySelectorAll('td'));
  const filas = (tabla) => Array.from(tabla.querySelectorAll('tbody tr'));

  const escribir = (celda, valor) => {
    if (!celda) return;
    // Sólo el nodo de texto: conserva botones y badges que cuelguen de la celda.
    const propio = Array.from(celda.childNodes).filter((n) => n.nodeType === 3);
    if (propio.length) propio.forEach((n, i) => { n.textContent = i === 0 ? valor : ''; });
    else celda.textContent = valor;
  };

  (plan.tablas || []).forEach((cfg) => {
    const tabla = document.querySelectorAll(cfg.selector || '.main-panel table')[cfg.indice || 0];
    if (!tabla) return;
    filas(tabla).forEach((fila, i) => {
      const td = celdas(fila);
      Object.entries(cfg.columnas).forEach(([col, tipo]) => {
        const celda = td[Number(col)];
        if (!celda) return;
        const actual = celda.textContent.trim();
        switch (tipo) {
          case 'nombre': escribir(celda, pick(datos.nombres, i)); break;
          case 'nombreMayus': escribir(celda, pick(datos.nombres, i).replace(', ', ' ').toUpperCase()); break;
          case 'dni': escribir(celda, pick(datos.dnis, i)); break;
          case 'telefono': escribir(celda, pick(datos.telefonos, i)); break;
          case 'agente': escribir(celda, pick(datos.agentes, i)); break;
          case 'agenteAlt': escribir(celda, /todos/i.test(actual) ? actual : pick(datos.agentes, i + 3)); break;
          case 'inspector': escribir(celda, pick(datos.inspectores, i)); break;
          case 'expediente': escribir(celda, expediente(i)); break;
          case 'caratula': escribir(celda, pick(datos.caratulas, i)); break;
          case 'motivo': escribir(celda, pick(datos.motivos, i)); break;
          case 'nota': escribir(celda, `${2100 + i * 13}/24`); break;
          case 'estadoCivil':
            // En la base hay filas con "Casado/a con" y el cónyuge vacío; acá
            // siempre se completa, si no la columna queda a medias en la foto.
            escribir(celda, /casado/i.test(actual) ? `Casado/a con ${pick(datos.nombres, i + 5)}` : actual);
            break;
          case 'catastro': {
            // Columnas nulas en la base: se inventan valores catastrales creíbles.
            // La fracción está vacía en casi todos los padrones reales: se
            // completa sólo en algunas filas para que se lea igual de creíble.
            const serie = [
              String(1 + (i % 2)), 'ABCDF'[i % 5], String(24 + ((i * 3) % 60)),
              String(1 + (i % 9)), ['', 'II', '', 'I', '', 'III', ''][i % 7],
              String(1 + ((i * 5) % 40)), String(1 + ((i * 11) % 30)),
            ];
            escribir(celda, serie[Number(col)] ?? '');
            break;
          }
        }
      });
    });
  });

  // Campos sueltos de la ficha del expediente (inputs, no celdas).
  (plan.campos || []).forEach(({ selector, valor }) => {
    panel.querySelectorAll(selector).forEach((el) => {
      if ('value' in el) el.value = valor;
      else el.textContent = valor;
    });
  });

  // DataTables le clava a la tabla y a cada columna un ancho en línea, medido al
  // arrancar. Con esos anchos la tabla se desborda del panel y la última columna
  // sale cortada. Sacándolos, el navegador vuelve al reparto automático: achica
  // lo que puede y parte en dos líneas lo que no entra, que es como se ve la app
  // cuando nadie la tocó.
  panel.querySelectorAll('table').forEach((tabla) => {
    tabla.style.width = '';
    tabla.querySelectorAll('th, td').forEach((celda) => { celda.style.width = ''; });
  });

  // Texto libre que nombra personas (banners, carátulas del encabezado).
  (plan.textos || []).forEach(({ buscar, poner }) => {
    const re = new RegExp(buscar);
    const it = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    const pendientes = [];
    while (it.nextNode()) if (re.test(it.currentNode.textContent)) pendientes.push(it.currentNode);
    pendientes.forEach((n) => { n.textContent = n.textContent.replace(re, poner); });
  });
}

// ── La barra lateral, ancha desde el arranque ───────────────────────────────
// El panel de ajustes de la app deja `sidebar-mini` pegado al body y la barra
// queda en 80px, con los rótulos cortados a la mitad.
//
// No alcanza con sacarle la clase una vez cargada la página: para entonces
// DataTables ya midió el ancho disponible y le clavó a cada columna un ancho en
// línea. Al ensancharse la barra después, la tabla no recalcula y la última
// columna sale cortada. Así que la clase se saca ANTES de que corra la app, con
// un observador que la vigila desde que existe el body.
const SIN_BARRA_MINI = () => {
  const quitar = () => document.body && document.body.classList.remove('sidebar-mini');
  new MutationObserver(quitar).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });
  document.addEventListener('DOMContentLoaded', quitar);
  quitar();
};

// ── Qué se captura ──────────────────────────────────────────────────────────
const CAPTURAS = [
  {
    archivo: 'expediente.png',
    url: 'Tierras/edit/1245',
    plan: {
      campos: [
        { selector: 'input[name="expediente"]', valor: '1200/03' },
        { selector: 'input[name="caratula"]', valor: 'Rojas Marcela Beatriz' },
        { selector: 'input[name="localizacion"]', valor: 'Calle 12 nº 1450, entre 9 y 11' },
        { selector: 'input[name="medidas"]', valor: '12,00 m x 26,25 m' },
        { selector: 'input[name="fraccion"]', valor: 'II' },
        { selector: 'input[name="latitud_longitud"]', valor: '-26.786420, -60.438610' },
        { selector: 'textarea[name="linderos"]', valor: 'Al norte con parcela 17 · al sur con parcela 19 · al este con calle 12 · al oeste con fondo de parcela 4' },
      ],
      textos: [
        { buscar: 'Aguado, Mauricio', poner: 'Bogado, Verónica' },
        { buscar: 'Alcaraz Genara', poner: 'Rojas Marcela Beatriz' },
      ],
    },
  },
  {
    archivo: 'expedientes.png',
    url: 'tierras/index',
    plan: {
      tablas: [{ columnas: { 0: 'expediente', 1: 'nombre', 2: 'dni', 3: 'estadoCivil' } }],
    },
  },
  {
    archivo: 'nomenclador.png',
    url: 'tierras/buscador',
    plan: {
      tablas: [{ columnas: { 0: 'catastro', 1: 'catastro', 2: 'catastro', 3: 'catastro', 4: 'catastro', 5: 'catastro', 6: 'catastro' } }],
    },
  },
  {
    archivo: 'circulacion.png',
    url: 'Tareas/actuales',
    plan: {
      tablas: [{ columnas: { 1: 'expediente', 4: 'agente', 6: 'agenteAlt' } }],
    },
  },
  {
    archivo: 'inspecciones.png',
    url: 'inspecciones/',
    plan: {
      tablas: [{ columnas: { 2: 'expediente', 3: 'inspector' } }],
    },
  },
  {
    archivo: 'notas.png',
    url: 'Notas/',
    plan: {
      tablas: [{ columnas: { 1: 'nota', 2: 'nombreMayus', 3: 'nombre', 4: 'dni', 6: 'caratula' } }],
    },
  },
  {
    archivo: 'turnos.png',
    url: 'turnos/asignados',
    plan: {
      tablas: [{ columnas: { 4: 'dni', 5: 'expediente', 6: 'telefono', 7: 'motivo' } }],
    },
  },
];

// `verificar-anonimato.js` importa las listas de ficción para contrastarlas
// contra el sistema, y no debe disparar las capturas al hacerlo.
if (!DNI || !PASS) {
  console.error('Faltan TIERRAS_DNI y TIERRAS_PASS en el entorno.');
  process.exit(1);
}

(async () => {
  fs.mkdirSync(DESTINO, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.addInitScript(SIN_BARRA_MINI);

  await page.goto(`${BASE}/auth/login`);
  await page.fill('input[name="dni"]', DNI);
  await page.fill('input[name="password"]', PASS);
  await Promise.all([page.waitForNavigation(), page.click('input[type="submit"]')]);
  if (!/auth\/dash/.test(page.url())) throw new Error('El login no llegó al panel: ' + page.url());

  for (const { archivo, url, plan } of CAPTURAS) {
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // las tablas se llenan por AJAX después del load
    // `sanear` está definida acá, en Node: se manda como fuente para que corra
    // dentro de la página.
    await page.evaluate(
      ([fuente, datos, plan]) => new Function('return ' + fuente)()(datos, plan),
      [sanear.toString(), FICCION, plan],
    );
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(DESTINO, archivo) });
    console.log('✓ ' + archivo);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
