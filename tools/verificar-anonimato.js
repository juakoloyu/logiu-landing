#!/usr/bin/env node
//
// Comprueba que los datos inventados que aparecen en tierras/capturas/*.png no
// correspondan a ninguna persona real del sistema.
//
// Que un dato sea inventado no alcanza: un nombre inventado puede coincidir con
// un vecino que existe, y entonces la captura publicada lo señala igual que si
// lo hubiéramos copiado. Pasó de verdad —"Núñez, Rubén" estaba en el padrón—, y
// por eso esto es un script y no un repaso a ojo.
//
// Compara contra el HTML CRUDO del servidor, no contra el DOM: DataTables saca
// del DOM las filas que no se ven, así que mirar la página renderizada compara
// contra diez filas en lugar de contra el padrón entero.
//
// No imprime jamás un dato real: sólo cuántas veces coincide cada dato inventado.
//
// Uso:
//   TIERRAS_DNI=... TIERRAS_PASS=... node tools/verificar-anonimato.js
//
const FICCION = require('./ficcion-tierras.js');

const BASE = process.env.TIERRAS_URL || 'https://tierras.modernizacionsp.ar';
const DNI = process.env.TIERRAS_DNI;
const PASS = process.env.TIERRAS_PASS;

if (!DNI || !PASS) {
  console.error('Faltan TIERRAS_DNI y TIERRAS_PASS en el entorno.');
  process.exit(1);
}

// Las pantallas que llevan datos de personas. `ciudadanos/` es el padrón entero.
const FUENTES = [
  'ciudadanos/', 'tierras/index', 'Notas/', 'Tareas/actuales',
  'inspecciones/', 'turnos/asignados',
];

const normalizar = (s) =>
  s.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/\s+/g, ' ').toUpperCase();

// "Apellido, Nombre" puede estar escrito de varias formas en la base.
const variantes = (completo) => {
  const [apellido, nombre = ''] = completo.split(', ');
  const a = normalizar(apellido);
  const n = normalizar(nombre);
  return [`${a}, ${n}`, `${a} , ${n}`, `${n} ${a}`, `${n}, ${a}`, `${a} ${n}`];
};

const contar = (blob, agujas) =>
  agujas.reduce((suma, aguja) => suma + blob.split(aguja).length - 1, 0);

(async () => {
  // Login por formulario, guardando la cookie de sesión para las descargas.
  const form = new URLSearchParams({ dni: DNI, password: PASS });
  const entrada = await fetch(`${BASE}/auth/login`, {
    method: 'POST', body: form, redirect: 'manual',
  });
  const cookie = (entrada.headers.getSetCookie?.() || [])
    .map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('El login no devolvió cookie de sesión.');

  let blob = '';
  let crudo = 0;
  for (const ruta of FUENTES) {
    const r = await fetch(`${BASE}/${ruta}`, { headers: { cookie } });
    const html = await r.text();
    crudo += html.length;
    console.log(`  ${ruta.padEnd(18)} ${html.length.toLocaleString('es-AR').padStart(11)} caracteres`);
    blob += '\n' + normalizar(html);
  }
  console.log(`\nComparado contra ${crudo.toLocaleString('es-AR')} caracteres de HTML del sistema.\n`);

  // Antes de contrastar contra la base, las reglas estructurales: son más
  // fuertes que una búsqueda, porque no dependen de lo que hoy haya cargado.
  let rotas = 0;

  // Un DNI son 8 dígitos y un teléfono 10. La regla es cuántos quedan a la
  // vista: con 4 o menos no hay documento ni línea que reconstruir, y unos
  // pocos dígitos sueltos no identifican a nadie. Vale para los dos formatos,
  // incluido el `3644` del prefijo, que es el de la ciudad y es público.
  const VISIBLES = 4;
  const tapado = (v) => (v.match(/\d/g) || []).length <= VISIBLES;

  console.log('— DNI tapados —');
  for (const d of FICCION.dnis) {
    const ok = tapado(d);
    if (!ok) rotas++;
    console.log(`  ${ok ? '✓' : '✗'} ${d}${ok ? '' : '  SIN TAPAR: puede ser el DNI de una persona real'}`);
  }
  console.log('');

  console.log('— Teléfonos tapados —');
  for (const t of FICCION.telefonos) {
    const ok = tapado(t);
    if (!ok) rotas++;
    console.log(`  ${ok ? '✓' : '✗'} ${t}${ok ? '' : '  SIN TAPAR: es un número marcable'}`);
  }
  console.log('');

  if (rotas > 0) {
    console.error(`FALLA: ${rotas} valor(es) rompen las reglas de arriba.`);
    console.error('Ver tools/ficcion-tierras.js, que explica por qué existe cada una.');
    process.exit(1);
  }

  const grupos = [
    ['DNI', FICCION.dnis, (d) => [d]],
    ['Teléfonos', FICCION.telefonos, (t) => [t]],
    ['Nombres de poseedores', FICCION.nombres, variantes],
    ['Agentes del área', FICCION.agentes, variantes],
    ['Inspectores', FICCION.inspectores, variantes],
    ['Operador de la barra lateral', [FICCION.operador.nombre], variantes],
  ];

  let choques = 0;
  for (const [titulo, lista, agujas] of grupos) {
    console.log(`— ${titulo} —`);
    for (const valor of lista) {
      const n = contar(blob, agujas(valor));
      if (n > 0) choques++;
      console.log(`  ${n > 0 ? '✗' : '✓'} ${valor}${n > 0 ? `  COINCIDE con ${n} registro(s) real(es)` : ''}`);
    }
    console.log('');
  }

  if (choques > 0) {
    console.error(`FALLA: ${choques} dato(s) inventado(s) coinciden con personas reales.`);
    console.error('Cambiarlos en FICCION (tools/capturar-tierras.js) y volver a capturar.');
    process.exit(1);
  }
  console.log('OK: ningún dato inventado corresponde a una persona real del sistema.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
