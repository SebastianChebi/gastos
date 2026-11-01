// Sincronización entre dispositivos. Los datos se guardan en un archivo JSON dentro de
// un repositorio privado de GitHub, usando una clave limitada a ese repositorio.
//
// Cada dispositivo trabaja con su copia local y, al sincronizar, baja el archivo,
// lo combina con lo suyo y sube el resultado. Por eso funciona sin conexión: lo cargado
// offline se combina la próxima vez. Si dos dispositivos tocan el mismo movimiento,
// gana el cambio más reciente.

import {
  estado, alCambiarDatos, aplicarSincronizacion, guardarAjustes, leerClaveSync, guardarClaveSync
} from './db.js';
import { fechaCorta, hoyISO } from './formato.js';

const DUENO = 'SebastianChebi';
const REPO = 'gastos-datos';
const ARCHIVO = 'datos.json';
const API = `https://api.github.com/repos/${DUENO}/${REPO}`;
const ESPERA_TRAS_CAMBIO_MS = 800;
const MAX_INTENTOS = 4; // otro dispositivo pudo subir justo antes que este

export const URL_CREAR_CLAVE = `https://github.com/settings/personal-access-tokens/new?name=Gastos&description=Sincronizar%20app%20de%20gastos&target_name=${DUENO}&contents=write`;

let clave = null;
let enCurso = null;
let repetir = false;
let temporizador = null;
let problema = '';

const VACIO = { gastos: [], ingresos: [], categorias: [], tcHist: [], borrados: {}, categoriasMod: '' };

function mayor(a = '', b = '') {
  return a >= b ? a : b;
}

// Combina dos copias. Función pura: conserva los objetos de `local` cuando ganan,
// lo que permite a aplicarSincronizacion() escribir solo lo que cambió.
export function combinar(local, remoto) {
  const borrados = { ...remoto.borrados };
  Object.entries(local.borrados).forEach(([id, f]) => { borrados[id] = mayor(borrados[id], f); });

  const lista = (a, b) => {
    const mapa = new Map(b.map((x) => [x.id, x]));
    a.forEach((x) => {
      const otro = mapa.get(x.id);
      if (!otro || (x.modificado || '') >= (otro.modificado || '')) mapa.set(x.id, x);
    });
    return [...mapa.values()].filter((x) => !(borrados[x.id] >= (x.modificado || '')));
  };

  const tc = new Map(remoto.tcHist.map((r) => [r.fecha, r]));
  local.tcHist.forEach((r) => tc.set(r.fecha, r));

  // En un empate decide el contenido, así los dos dispositivos eligen la misma lista.
  const usarLocal = local.categoriasMod > remoto.categoriasMod
    || (local.categoriasMod === remoto.categoriasMod
      && JSON.stringify(local.categorias) >= JSON.stringify(remoto.categorias));
  return {
    gastos: lista(local.gastos, remoto.gastos),
    ingresos: lista(local.ingresos, remoto.ingresos),
    categorias: usarLocal ? local.categorias : remoto.categorias,
    categoriasMod: usarLocal ? local.categoriasMod : remoto.categoriasMod,
    tcHist: [...tc.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    borrados
  };
}

// Resumen para saber si dos copias difieren sin comparar todo el contenido.
export function firma(d) {
  const claves = (l) => l.map((x) => `${x.id}|${x.modificado || ''}`).sort().join();
  return [claves(d.gastos), claves(d.ingresos), d.categoriasMod, JSON.stringify(d.categorias),
    d.tcHist.map((r) => r.fecha).join(), Object.keys(d.borrados).sort().join()].join('#');
}

// ---------- GitHub ----------

async function pedir(ruta, opciones = {}) {
  const r = await fetch(API + ruta, {
    cache: 'no-store',
    ...opciones,
    headers: { Authorization: `Bearer ${clave}`, ...opciones.headers }
  });
  return r;
}

function textoABase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

async function bajar() {
  const info = await pedir(`/contents/${ARCHIVO}`, { headers: { Accept: 'application/vnd.github.object+json' } });
  if (info.status === 404) return { sha: null, datos: VACIO };
  if (!info.ok) throw new ErrorSync(info.status);
  const { sha } = await info.json();
  const crudo = await pedir(`/contents/${ARCHIVO}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (!crudo.ok) throw new ErrorSync(crudo.status);
  return { sha, datos: { ...VACIO, ...(await crudo.json()) } };
}

async function subir(datos, sha) {
  const r = await pedir(`/contents/${ARCHIVO}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Datos ${hoyISO()}`,
      content: textoABase64(JSON.stringify({ app: 'gastos', version: 1, ...datos })),
      ...(sha ? { sha } : {})
    })
  });
  // 409/422: otro dispositivo subió primero. Hay que volver a combinar.
  if (r.status === 409 || r.status === 422) return false;
  if (!r.ok) throw new ErrorSync(r.status);
  return true;
}

class ErrorSync extends Error {
  constructor(status) {
    super(String(status));
    this.status = status;
  }
}

// ---------- Ciclo de sincronización ----------

async function correr() {
  for (let intento = 0; intento < MAX_INTENTOS; intento += 1) {
    const { sha, datos: remoto } = await bajar();
    // Se combina recién acá para incluir lo guardado mientras se descargaba.
    const local = {
      gastos: estado.gastos, ingresos: estado.ingresos, categorias: estado.categorias,
      tcHist: estado.tcHist, borrados: estado.borrados, categoriasMod: estado.categoriasMod
    };
    const combinado = combinar(local, remoto);
    const firmaFinal = firma(combinado);
    const cambioLocal = firmaFinal !== firma(local);
    if (cambioLocal) {
      await aplicarSincronizacion(combinado);
      document.dispatchEvent(new Event('datos-sincronizados'));
    }
    if (firmaFinal === firma(remoto) || await subir(combinado, sha)) {
      problema = '';
      await guardarAjustes({ ultimaSync: new Date().toISOString() });
      return true;
    }
  }
  throw new ErrorSync(409);
}

// Lanza una sincronización, o pide otra al terminar si ya hay una en curso.
export function sincronizar() {
  if (!clave) return Promise.resolve(false);
  if (enCurso) {
    repetir = true;
    return enCurso;
  }
  enCurso = correr()
    .catch((e) => {
      if (e.status === 401 || e.status === 403) problema = 'La clave no funciona. Desconectá y volvé a conectar.';
      else if (e.status === 404) problema = 'No se encontró el repositorio de datos.';
      else if (e instanceof ErrorSync) problema = 'GitHub no respondió bien. Se reintenta solo.';
      else problema = 'Sin conexión. Se sincroniza al volver internet.';
      return false;
    })
    .finally(() => {
      enCurso = null;
      if (repetir) {
        repetir = false;
        sincronizar();
      }
    });
  return enCurso;
}

function programar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(sincronizar, ESPERA_TRAS_CAMBIO_MS);
}

export async function iniciarSync() {
  clave = (await leerClaveSync()) || null;
  alCambiarDatos(programar);
  sincronizar();
}

// Devuelve un mensaje de error, o '' si conectó.
export async function conectarSync(texto) {
  clave = texto.trim();
  let error = '';
  try {
    const r = await pedir('');
    if (r.status === 401) error = 'GitHub no reconoce esa clave.';
    else if (r.status === 403 || r.status === 404) error = 'La clave no tiene acceso a gastos-datos.';
    else if (!r.ok) error = 'GitHub no respondió bien. Probá de nuevo.';
    else if (!(await r.json()).permissions?.push) error = 'La clave no tiene permiso de escritura.';
  } catch {
    error = 'Sin conexión.';
  }
  if (error) {
    clave = null;
    return error;
  }
  await guardarClaveSync(clave);
  await sincronizar();
  return problema;
}

export async function desconectarSync() {
  clave = null;
  problema = '';
  await guardarClaveSync(null);
}

export function estadoSync() {
  const u = estado.ajustes.ultimaSync;
  const cuando = u
    ? `Última: ${fechaCorta(hoyISO(new Date(u)))} a las ${new Date(u).toTimeString().slice(0, 5)}`
    : 'Todavía sin sincronizar';
  return { conectado: Boolean(clave), mensaje: problema || `Sincronizado. ${cuando}` };
}
