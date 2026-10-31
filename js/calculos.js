// Cálculos puros: reciben datos y devuelven números. No tocan la pantalla.
// Un gasto pertenece al mes de su fecha; un ingreso, a su anio/mes.

import { normalizar } from './formato.js';

const suma = (lista) => lista.reduce((t, x) => t + x.montoUSD, 0);

export const gastosDelMes = (gastos, anio, mes) => {
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  return gastos.filter((g) => g.fecha.startsWith(prefijo));
};

export const ingresosDelMes = (ingresos, anio, mes) =>
  ingresos.filter((i) => i.anio === anio && i.mes === mes);

// Más nuevo primero. Dentro del mismo día, el último cargado va arriba.
export const ordenarMovimientos = (gastos) => [...gastos].sort((a, b) =>
  b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || '') || b.id.localeCompare(a.id));

export function porCategoria(gastos) {
  const mapa = new Map();
  for (const g of gastos) {
    const c = mapa.get(g.categoria) || { nombre: g.categoria, total: 0, evitable: 0 };
    c.total += g.montoUSD;
    if (g.evitable) c.evitable += g.montoUSD;
    mapa.set(g.categoria, c);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function resumenMes(estado, anio, mes) {
  const gastos = gastosDelMes(estado.gastos, anio, mes);
  const ingresos = ingresosDelMes(estado.ingresos, anio, mes);
  const gasto = suma(gastos);
  const ingreso = suma(ingresos);
  const evitable = suma(gastos.filter((g) => g.evitable));
  return { gastos, ingresos, gasto, ingreso, evitable, ahorro: ingreso - gasto };
}

// Tabla categoría × mes de un año: filas ordenadas por total, y totales por columna.
export function matrizAnual(estado, anio) {
  const delAnio = estado.gastos.filter((g) => g.fecha.startsWith(`${anio}-`));
  const columna = (g) => Number(g.fecha.slice(5, 7)) - 1;

  const totalesMes = Array(12).fill(0);
  const evitablesMes = Array(12).fill(0);
  const ingresosMes = Array(12).fill(0);
  const filas = new Map();

  for (const g of delAnio) {
    const m = columna(g);
    const fila = filas.get(g.categoria) || { categoria: g.categoria, meses: Array(12).fill(0), total: 0 };
    fila.meses[m] += g.montoUSD;
    fila.total += g.montoUSD;
    filas.set(g.categoria, fila);
    totalesMes[m] += g.montoUSD;
    if (g.evitable) evitablesMes[m] += g.montoUSD;
  }
  for (const i of estado.ingresos) {
    if (i.anio === anio) ingresosMes[i.mes - 1] += i.montoUSD;
  }

  const sumar = (v) => v.reduce((a, b) => a + b, 0);
  return {
    filas: [...filas.values()].sort((a, b) => b.total - a.total),
    totalesMes, evitablesMes, ingresosMes,
    gasto: sumar(totalesMes),
    evitable: sumar(evitablesMes),
    ingreso: sumar(ingresosMes)
  };
}

// Años que se manejan día a día: 2026 en adelante. 2025 queda como archivo.
export function aniosActivos(gastos, anioActual) {
  const anios = new Set([2026, anioActual]);
  gastos.forEach((g) => {
    const a = Number(g.fecha.slice(0, 4));
    if (a >= 2026) anios.add(a);
  });
  return [...anios].sort();
}

const masFrecuente = (conteo) => [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0];

// Por cada concepto usado: cuántas veces, y su categoría y "evitable" habituales.
export function habitosDeConceptos(gastos) {
  const mapa = new Map();
  for (const g of gastos) {
    const clave = normalizar(g.concepto);
    const h = mapa.get(clave) || { concepto: g.concepto, usos: 0, cats: new Map(), evit: new Map() };
    h.usos += 1;
    h.cats.set(g.categoria, (h.cats.get(g.categoria) || 0) + 1);
    h.evit.set(g.evitable, (h.evit.get(g.evitable) || 0) + 1);
    mapa.set(clave, h);
  }
  return [...mapa.entries()].map(([clave, h]) => ({
    clave, concepto: h.concepto, usos: h.usos,
    categoria: masFrecuente(h.cats), evitable: masFrecuente(h.evit)
  })).sort((a, b) => b.usos - a.usos);
}

// Categorías visibles, las más usadas primero.
export function categoriasPorUso(estado, incluir) {
  const usos = new Map();
  estado.gastos.forEach((g) => usos.set(g.categoria, (usos.get(g.categoria) || 0) + 1));
  return estado.categorias
    .filter((c) => !c.oculta || c.nombre === incluir)
    .map((c) => c.nombre)
    .sort((a, b) => (usos.get(b) || 0) - (usos.get(a) || 0));
}
