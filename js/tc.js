// Tipos de cambio. Se expresan como "unidades de moneda por 1 USD" (ej. PEN 3,745),
// así montoUSD = montoOriginal / tc.

import { estado, guardarTcHist } from './db.js';
import { hoyISO, diasEntre } from './formato.js';

// API gratuita y sin clave. Permite llamadas desde el navegador (CORS abierto).
const API = 'https://open.er-api.com/v6/latest/USD';
const TIEMPO_MAXIMO_MS = 8000;

export const MONEDAS_TC = ['PEN', 'UYU'];

export const hayTcDeHoy = () => estado.tcHist.some((r) => r.fecha === hoyISO() && r.fuente === 'api');

// Baja el TC si todavía no hay uno de hoy (o siempre, con `forzar`).
// Devuelve true si obtuvo uno nuevo. Si falla, la app sigue con el último guardado.
export async function actualizarTC({ forzar = false } = {}) {
  if (!forzar && hayTcDeHoy()) return false;
  try {
    const r = await fetch(API, { cache: 'no-store', signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    const j = await r.json();
    const { PEN, UYU } = j.rates || {};
    if (j.result !== 'success' || !(PEN > 0) || !(UYU > 0)) return false;

    const fecha = hoyISO();
    const hist = estado.tcHist.filter((x) => x.fecha !== fecha);
    hist.push({ fecha, PEN, UYU, fuente: 'api' });
    await guardarTcHist(hist.sort((a, b) => a.fecha.localeCompare(b.fecha)));
    document.dispatchEvent(new Event('tc-actualizado'));
    return true;
  } catch {
    return false;
  }
}

// TC sugerido para una moneda y fecha: el fijado a mano (de hoy en adelante) o el
// guardado más cercano a esa fecha. Devuelve null si no hay ninguno.
export function tcPara(moneda, fecha = hoyISO()) {
  if (moneda === 'USD') return { tc: 1, fecha, fuente: 'base' };

  const fijo = estado.ajustes.tcFijo?.[moneda];
  if (fijo > 0 && fecha >= hoyISO()) return { tc: fijo, fecha, fuente: 'fijo' };

  let mejor = null;
  for (const r of estado.tcHist) {
    if (!(r[moneda] > 0)) continue;
    if (!mejor || Math.abs(diasEntre(r.fecha, fecha)) < Math.abs(diasEntre(mejor.fecha, fecha))) mejor = r;
  }
  return mejor && { tc: mejor[moneda], fecha: mejor.fecha, fuente: mejor.fuente };
}
