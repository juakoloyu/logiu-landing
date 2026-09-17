//
// Los datos inventados con los que se tapan los datos reales en las capturas de
// Tierras. Viven en su propio módulo porque los usan dos scripts:
//
//   - `capturar-tierras.js`, que los escribe en la página antes de la foto
//   - `verificar-anonimato.js`, que los contrasta contra el sistema real
//
// Apellidos del nordeste chaqueño, para que las tablas se lean verosímiles.
//
// CUIDADO: que un nombre sea inventado no alcanza. Puede coincidir con un vecino
// que existe, y entonces la captura publicada lo señala igual que si lo
// hubiéramos copiado. Pasó de verdad: "Núñez, Rubén" estaba en el padrón.
// **Después de tocar estas listas hay que correr `verificar-anonimato.js`**, que
// es lo único que distingue un nombre inventado de uno inventado y libre.
//
// El reemplazo es determinista —se elige por índice de fila, sin azar—, así que
// volver a capturar produce las mismas imágenes y el diff de git queda limpio.
//
module.exports = {
  nombres: [
    'Rojas, Marcela Beatriz', 'Ibarra, Hugo Daniel', 'Sosa, Norma Elena',
    'Villalba, Ramón Alberto', 'Benítez, Claudia Mariel', 'Ferreyra, Oscar Ramón',
    'Ojeda, Silvia Noemí', 'Acuña, Miguel Ángel', 'Maidana, Lucía Fernanda',
    'Gauna, Carlos Alberto', 'Zárate, Mirta Susana', 'Duarte, Julio César',
  ],
  // El DNI y el teléfono van TAPADOS, no inventados.
  //
  // Con los nombres alcanza con comprobar que no sean de nadie del sistema. Con
  // estos dos no, porque el universo es todo el país: un DNI de ocho dígitos que
  // parezca creíble es casi con certeza el de alguien, esté o no en Tierras, y
  // un teléfono además se marca.
  //
  // Se publica el formato, no el número. Los últimos tres dígitos quedan a la
  // vista para que las filas se distingan entre sí; tres dígitos sueltos no
  // identifican a nadie.
  dnis: [
    '••.•••.387', '••.•••.934', '••.•••.045', '••.•••.956',
    '••.•••.273', '••.•••.601', '••.•••.418', '••.•••.529',
    '••.•••.247', '••.•••.830', '••.•••.192', '••.•••.361',
  ],
  telefonos: ['3644 ••••••'],
  // Personal del área: quienes firman pases e inspecciones.
  agentes: [
    'Bogado, Verónica', 'Escobar, Daniel', 'Sandoval, Patricia',
    'Quiroga, Rubén Omar', 'Miño, Gabriela', 'Cáceres, Pablo Martín',
  ],
  inspectores: ['Cáceres, Pablo Martín', 'Romero, Andrea Luján'],
  caratulas: [
    'SOLICITUD DE TERRENO FISCAL', 'CAMBIO DE TITULARIDAD', 'MENSURA Y DESLINDE',
    'ESCRITURACIÓN', 'PEDIDO DE INSPECCIÓN', 'REGULARIZACIÓN DOMINIAL',
  ],
  motivos: [
    'continuar trámite', 'presentar documentación', 'consulta por mensura',
    'retirar constancia', 'firma de convenio', 'alta de expediente',
  ],
  operador: { iniciales: 'VB', nombre: 'VERÓNICA BOGADO' },
};
