// Datos de la app. Viven en IndexedDB y se mantienen en memoria en `estado`.
// Las vistas leen `estado`; toda escritura pasa por las funciones de este archivo.

const NOMBRE_DB = 'gastos-app';
const VERSION_DB = 1;

export const CATEGORIAS_INICIALES = [
  'Alquiler Peru', 'Noche', 'Servicios Apto', 'Deporte', 'Super', 'Vicios', 'Comida', 'Ropa',
  'Kiosko', 'Transporte', 'Apartamento', 'Empresa', 'Necesidad personal', 'Pasajes', 'Otros',
  'Regalos', 'Viajes', 'Ocio'
];

export const estado = {
  gastos: [],
  ingresos: [],
  categorias: [],   // [{ nombre, oculta }]
  tcHist: [],       // [{ fecha, PEN, UYU, fuente }] ordenado por fecha
  ajustes: {}       // { ultimaMoneda, ultimoRespaldo, primerUso, tcFijo: { PEN, UYU } }
};

let db;

function abrir() {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open(NOMBRE_DB, VERSION_DB);
    pedido.onupgradeneeded = () => {
      const d = pedido.result;
      d.createObjectStore('gastos', { keyPath: 'id' });
      d.createObjectStore('ingresos', { keyPath: 'id' });
      d.createObjectStore('kv');
    };
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}

const promesa = (pedido) => new Promise((ok, mal) => {
  pedido.onsuccess = () => ok(pedido.result);
  pedido.onerror = () => mal(pedido.error);
});

function transaccion(stores, accion) {
  return new Promise((ok, mal) => {
    const tx = db.transaction(stores, 'readwrite');
    accion(tx);
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error);
  });
}

const leerKV = (clave) => promesa(db.transaction('kv').objectStore('kv').get(clave));
const escribirKV = (clave, valor) => transaccion('kv', (tx) => tx.objectStore('kv').put(valor, clave));

export async function iniciar() {
  db = await abrir();
  const tx = db.transaction(['gastos', 'ingresos']);
  estado.gastos = await promesa(tx.objectStore('gastos').getAll());
  estado.ingresos = await promesa(tx.objectStore('ingresos').getAll());
  estado.categorias = (await leerKV('categorias'))
    || CATEGORIAS_INICIALES.map((nombre) => ({ nombre, oculta: false }));
  estado.tcHist = (await leerKV('tcHist')) || [];
  estado.ajustes = (await leerKV('ajustes')) || {};
  // Le pide a iOS que no borre los datos por falta de espacio.
  navigator.storage?.persist?.();
}

function reemplazarEnLista(lista, item) {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i >= 0) lista[i] = item;
  else lista.push(item);
}

export function nuevoId(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function guardarGasto(gasto) {
  await transaccion('gastos', (tx) => tx.objectStore('gastos').put(gasto));
  reemplazarEnLista(estado.gastos, gasto);
}

export async function borrarGasto(id) {
  await transaccion('gastos', (tx) => tx.objectStore('gastos').delete(id));
  estado.gastos = estado.gastos.filter((g) => g.id !== id);
}

export async function guardarIngreso(ingreso) {
  await transaccion('ingresos', (tx) => tx.objectStore('ingresos').put(ingreso));
  reemplazarEnLista(estado.ingresos, ingreso);
}

export async function borrarIngreso(id) {
  await transaccion('ingresos', (tx) => tx.objectStore('ingresos').delete(id));
  estado.ingresos = estado.ingresos.filter((i) => i.id !== id);
}

export async function guardarAjustes(cambios) {
  const ajustes = { ...estado.ajustes, ...cambios };
  await escribirKV('ajustes', ajustes);
  estado.ajustes = ajustes;
}

export async function guardarTcHist(tcHist) {
  await escribirKV('tcHist', tcHist);
  estado.tcHist = tcHist;
}

export async function guardarCategorias(categorias) {
  await escribirKV('categorias', categorias);
  estado.categorias = categorias;
}

// Renombra la categoría y todos sus gastos en una sola transacción.
export async function renombrarCategoria(actual, nuevo) {
  const categorias = estado.categorias.map((c) => (c.nombre === actual ? { ...c, nombre: nuevo } : c));
  const gastos = estado.gastos.map((g) => (g.categoria === actual ? { ...g, categoria: nuevo } : g));
  await transaccion(['gastos', 'kv'], (tx) => {
    const store = tx.objectStore('gastos');
    gastos.filter((g) => g.categoria === nuevo).forEach((g) => store.put(g));
    tx.objectStore('kv').put(categorias, 'categorias');
  });
  estado.categorias = categorias;
  estado.gastos = gastos;
}

// Carga un conjunto completo (importación). `modo`: 'reemplazar' borra lo que había;
// 'combinar' agrega y pisa por id, así importar dos veces no duplica nada.
export async function cargarDatos(datos, modo) {
  const reemplaza = modo === 'reemplazar';
  const porId = (actual, nuevos) => {
    const mapa = new Map((reemplaza ? [] : actual).map((x) => [x.id, x]));
    nuevos.forEach((x) => mapa.set(x.id, x));
    return [...mapa.values()];
  };
  const gastos = porId(estado.gastos, datos.gastos);
  const ingresos = porId(estado.ingresos, datos.ingresos);

  const categorias = reemplaza && datos.categorias.length ? [...datos.categorias] : [...estado.categorias];
  datos.categorias.forEach((c) => {
    if (!categorias.some((x) => x.nombre === c.nombre)) categorias.push(c);
  });

  const hist = new Map(estado.tcHist.map((r) => [r.fecha, r]));
  datos.tcHist.forEach((r) => hist.set(r.fecha, r));
  const tcHist = [...hist.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const ajustes = { ...estado.ajustes, primerUso: estado.ajustes.primerUso || new Date().toISOString() };

  await transaccion(['gastos', 'ingresos', 'kv'], (tx) => {
    const sg = tx.objectStore('gastos');
    const si = tx.objectStore('ingresos');
    if (reemplaza) {
      sg.clear();
      si.clear();
    }
    gastos.forEach((g) => sg.put(g));
    ingresos.forEach((i) => si.put(i));
    const kv = tx.objectStore('kv');
    kv.put(categorias, 'categorias');
    kv.put(tcHist, 'tcHist');
    kv.put(ajustes, 'ajustes');
  });
  Object.assign(estado, { gastos, ingresos, categorias, tcHist, ajustes });
}
