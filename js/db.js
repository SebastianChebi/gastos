// Datos de la app. Viven en IndexedDB y se mantienen en memoria en `estado`.
// Las vistas leen `estado`; toda escritura pasa por las funciones de este archivo.
// Cada escritura marca `modificado` y avisa a sync.js para subir el cambio.

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
  ajustes: {},      // { ultimaMoneda, ultimoRespaldo, primerUso, ultimaSync, tcFijo: { PEN, UYU } }
  borrados: {},     // { id: fecha de borrado }: para que un borrado llegue a los otros dispositivos
  categoriasMod: '' // última vez que se tocó la lista de categorías
};

let db;
let avisarCambio = () => {};

// sync.js se registra acá para enterarse de cada cambio hecho en este dispositivo.
export const alCambiarDatos = (fn) => { avisarCambio = fn; };

const ahora = () => new Date().toISOString();
const metaSync = () => ({ borrados: estado.borrados, categoriasMod: estado.categoriasMod });

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
  const meta = (await leerKV('syncMeta')) || {};
  estado.borrados = meta.borrados || {};
  estado.categoriasMod = meta.categoriasMod || '';
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
  const registro = { ...gasto, modificado: ahora() };
  await transaccion('gastos', (tx) => tx.objectStore('gastos').put(registro));
  reemplazarEnLista(estado.gastos, registro);
  avisarCambio();
}

export async function guardarIngreso(ingreso) {
  const registro = { ...ingreso, modificado: ahora() };
  await transaccion('ingresos', (tx) => tx.objectStore('ingresos').put(registro));
  reemplazarEnLista(estado.ingresos, registro);
  avisarCambio();
}

async function borrar(store, id) {
  estado.borrados = { ...estado.borrados, [id]: ahora() };
  await transaccion([store, 'kv'], (tx) => {
    tx.objectStore(store).delete(id);
    tx.objectStore('kv').put(metaSync(), 'syncMeta');
  });
  estado[store] = estado[store].filter((x) => x.id !== id);
  avisarCambio();
}

export const borrarGasto = (id) => borrar('gastos', id);
export const borrarIngreso = (id) => borrar('ingresos', id);

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
  estado.categoriasMod = ahora();
  await transaccion('kv', (tx) => {
    const kv = tx.objectStore('kv');
    kv.put(categorias, 'categorias');
    kv.put(metaSync(), 'syncMeta');
  });
  estado.categorias = categorias;
  avisarCambio();
}

// Renombra la categoría y todos sus gastos en una sola transacción.
export async function renombrarCategoria(actual, nuevo) {
  const categorias = estado.categorias.map((c) => (c.nombre === actual ? { ...c, nombre: nuevo } : c));
  const marca = ahora();
  const gastos = estado.gastos.map((g) => (g.categoria === actual ? { ...g, categoria: nuevo, modificado: marca } : g));
  estado.categoriasMod = marca;
  await transaccion(['gastos', 'kv'], (tx) => {
    const store = tx.objectStore('gastos');
    gastos.filter((g) => g.categoria === nuevo).forEach((g) => store.put(g));
    const kv = tx.objectStore('kv');
    kv.put(categorias, 'categorias');
    kv.put(metaSync(), 'syncMeta');
  });
  estado.categorias = categorias;
  estado.gastos = gastos;
  avisarCambio();
}

// Carga un conjunto completo (importación). `modo`: 'reemplazar' borra lo que había;
// 'combinar' agrega y pisa por id, así importar dos veces no duplica nada.
export async function cargarDatos(datos, modo) {
  const reemplaza = modo === 'reemplazar';
  const marca = ahora();
  // Lo importado es lo más nuevo: gana contra otros dispositivos, y lo que reemplaza
  // se registra como borrado para que también desaparezca allá.
  const borrados = { ...estado.borrados };
  const porId = (actual, nuevos) => {
    const mapa = new Map((reemplaza ? [] : actual).map((x) => [x.id, x]));
    nuevos.forEach((x) => mapa.set(x.id, { ...x, modificado: marca }));
    if (reemplaza) actual.filter((x) => !mapa.has(x.id)).forEach((x) => { borrados[x.id] = marca; });
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
    kv.put({ borrados, categoriasMod: marca }, 'syncMeta');
  });
  Object.assign(estado, { gastos, ingresos, categorias, tcHist, ajustes, borrados, categoriasMod: marca });
  avisarCambio();
}

// Aplica el resultado de una sincronización. `estado` se actualiza antes de esperar
// para que un gasto guardado mientras tanto se sume a la lista nueva y no se pierda.
export async function aplicarSincronizacion(d) {
  const cambios = (store) => {
    const antes = new Map(estado[store].map((x) => [x.id, x]));
    const nuevos = d[store].filter((x) => antes.get(x.id) !== x);
    const ids = new Set(d[store].map((x) => x.id));
    return { nuevos, quitar: [...antes.keys()].filter((id) => !ids.has(id)) };
  };
  const cg = cambios('gastos');
  const ci = cambios('ingresos');
  Object.assign(estado, {
    gastos: d.gastos, ingresos: d.ingresos, categorias: d.categorias, tcHist: d.tcHist,
    borrados: d.borrados, categoriasMod: d.categoriasMod
  });
  await transaccion(['gastos', 'ingresos', 'kv'], (tx) => {
    const sg = tx.objectStore('gastos');
    const si = tx.objectStore('ingresos');
    cg.nuevos.forEach((x) => sg.put(x));
    cg.quitar.forEach((id) => sg.delete(id));
    ci.nuevos.forEach((x) => si.put(x));
    ci.quitar.forEach((id) => si.delete(id));
    const kv = tx.objectStore('kv');
    kv.put(d.categorias, 'categorias');
    kv.put(d.tcHist, 'tcHist');
    kv.put(metaSync(), 'syncMeta');
  });
}

// La clave de acceso queda solo en este dispositivo: no va en respaldos ni en la sincronización.
export const leerClaveSync = () => leerKV('syncClave');
export const guardarClaveSync = (clave) => escribirKV('syncClave', clave);
