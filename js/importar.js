// Importar y exportar datos: respaldo JSON y planillas CSV.

import { estado, guardarAjustes } from './db.js';
import { MONEDAS, hoyISO } from './formato.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const gastoValido = (g) => g && typeof g.id === 'string' && typeof g.concepto === 'string'
  && typeof g.categoria === 'string' && FECHA.test(g.fecha) && g.moneda in MONEDAS
  && typeof g.evitable === 'boolean' && g.montoOriginal > 0 && g.tc > 0 && Number.isFinite(g.montoUSD);

const ingresoValido = (i) => i && typeof i.id === 'string' && typeof i.concepto === 'string'
  && Number.isInteger(i.anio) && i.mes >= 1 && i.mes <= 12 && i.moneda in MONEDAS
  && i.montoOriginal > 0 && i.tc > 0 && Number.isFinite(i.montoUSD);

// Revisa un archivo importado. Devuelve los datos o lanza un Error con mensaje legible.
export function validarImportacion(texto) {
  let j;
  try {
    j = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (j?.app !== 'gastos' || !Array.isArray(j.gastos) || !Array.isArray(j.ingresos)) {
    throw new Error('Este archivo no es un respaldo de esta app.');
  }
  const malos = j.gastos.filter((g) => !gastoValido(g)).length + j.ingresos.filter((i) => !ingresoValido(i)).length;
  if (malos) throw new Error(`Movimientos dañados en el archivo: ${malos}. No se importó nada.`);

  return {
    gastos: j.gastos,
    ingresos: j.ingresos,
    categorias: Array.isArray(j.categorias)
      ? j.categorias.filter((c) => typeof c?.nombre === 'string').map((c) => ({ nombre: c.nombre, oculta: Boolean(c.oculta) }))
      : [],
    tcHist: Array.isArray(j.tcHist) ? j.tcHist.filter((r) => FECHA.test(r?.fecha)) : []
  };
}

// En iPhone, compartir abre "Guardar en Archivos"; en otros navegadores, descarga.
// Devuelve false si el usuario canceló.
async function entregarArchivo(nombre, contenido, tipo) {
  const archivo = new File([contenido], nombre, { type: tipo });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export async function exportarRespaldo() {
  const respaldo = {
    app: 'gastos', version: 1, exportado: new Date().toISOString(),
    categorias: estado.categorias, gastos: estado.gastos, ingresos: estado.ingresos, tcHist: estado.tcHist
  };
  const ok = await entregarArchivo(`gastos-respaldo-${hoyISO()}.json`, JSON.stringify(respaldo), 'application/json');
  if (ok) await guardarAjustes({ ultimoRespaldo: new Date().toISOString() });
  return ok;
}

// CSV para Excel en español: separador ";", coma decimal y BOM para los acentos.
const celda = (v) => {
  const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const aCSV = (filas) => `﻿${filas.map((f) => f.map(celda).join(';')).join('\r\n')}`;

export function exportarGastosCSV() {
  const orden = [...estado.gastos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const filas = [['Fecha', 'Concepto', 'Categoria', 'Evitable', 'Monto USD', 'Moneda', 'Monto original', 'TC'],
    ...orden.map((g) => [g.fecha, g.concepto, g.categoria, g.evitable ? 'Si' : 'No',
      Math.round(g.montoUSD * 100) / 100, g.moneda, g.montoOriginal, g.tc])];
  return entregarArchivo(`gastos-${hoyISO()}.csv`, aCSV(filas), 'text/csv');
}

export function exportarIngresosCSV() {
  const orden = [...estado.ingresos].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  const filas = [['Año', 'Mes', 'Concepto', 'Monto USD', 'Moneda', 'Monto original', 'TC'],
    ...orden.map((i) => [i.anio, i.mes, i.concepto, Math.round(i.montoUSD * 100) / 100, i.moneda, i.montoOriginal, i.tc])];
  return entregarArchivo(`ingresos-${hoyISO()}.csv`, aCSV(filas), 'text/csv');
}

// Días desde el último respaldo (o desde que se empezó a usar). null si no hay datos.
export function diasSinRespaldo() {
  const desde = estado.ajustes.ultimoRespaldo || estado.ajustes.primerUso;
  if (!desde) return null;
  return Math.floor((Date.now() - Date.parse(desde)) / 86400000);
}
