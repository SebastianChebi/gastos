// Resumen anual: ingresos, gastos, ahorro, evolución y categorías.

import { estado } from '../db.js';
import { matrizAnual, aniosActivos } from '../calculos.js';
import { tarjeta, notaMesesSinIngreso } from '../ui.js';
import { usd, esc, numero, porcentaje, MESES_CORTOS } from '../formato.js';
import { barrasIngresoGasto } from '../graficos.js';

let anioElegido = null;

// Tabla categoría × mes. La usan Resumen y 2025. Solo muestra los meses con gastos.
export function htmlMatriz(m) {
  const columnas = MESES_CORTOS.map((nombre, i) => ({ nombre, i })).filter((c) => m.totalesMes[c.i] > 0);
  if (!columnas.length) return '<p class="vacio">Sin gastos.</p>';
  const celda = (v) => (v ? numero(v) : '–');
  return `
    <div class="tabla-scroll" tabindex="0" role="region" aria-label="Gastos por categoría y mes">
      <table class="tabla matriz">
        <thead><tr><th>Categoría</th>${columnas.map((c) => `<th class="n">${c.nombre}</th>`).join('')}<th class="n">Total</th></tr></thead>
        <tbody>${m.filas.map((f) => `<tr><th>${esc(f.categoria)}</th>${columnas.map((c) => `<td class="n">${celda(f.meses[c.i])}</td>`).join('')}<td class="n fuerte">${numero(f.total)}</td></tr>`).join('')}</tbody>
        <tfoot>
          <tr class="fila-gasto"><th>Total</th>${columnas.map((c) => `<td class="n">${numero(m.totalesMes[c.i])}</td>`).join('')}<td class="n">${numero(m.gasto)}</td></tr>
          <tr class="fila-evitable"><th>Evitable</th>${columnas.map((c) => `<td class="n">${numero(m.evitablesMes[c.i])}</td>`).join('')}<td class="n">${numero(m.evitable)}</td></tr>
        </tfoot>
      </table>
    </div>`;
}

export function renderResumen(raiz, volverADibujar) {
  const anioActual = new Date().getFullYear();
  const anios = aniosActivos(estado.gastos, anioActual);
  anioElegido ??= anioActual;
  const m = matrizAnual(estado, anioElegido);

  const mesesConGasto = m.totalesMes.filter((v) => v > 0).length;
  const promedio = mesesConGasto ? m.gasto / mesesConGasto : 0;
  const mayor = m.filas[0]?.total || 1;
  const ahorro = m.ingreso - m.gasto;

  raiz.innerHTML = `
    <header class="titulo"><h1>Resumen</h1>
      ${anios.length > 1
    ? `<select class="select-anio" data-anio aria-label="Año">${anios.map((a) => `<option ${a === anioElegido ? 'selected' : ''}>${a}</option>`).join('')}</select>`
    : `<p>${anioElegido}</p>`}
    </header>
    <section class="tarjetas">
      ${tarjeta('Ingresos del año', usd(m.ingreso), '', 'ingreso')}
      ${tarjeta('Gastos del año', usd(m.gasto), '', 'gasto')}
      ${tarjeta('Ahorro del año', usd(ahorro), '', ahorro < 0 ? 'ahorro negativo' : 'ahorro')}
      ${tarjeta('Evitable del año', usd(m.evitable), m.gasto ? `${porcentaje((m.evitable / m.gasto) * 100)} del gasto` : '', 'evitable')}
    </section>
    ${notaMesesSinIngreso(m)}
    <section class="panel">
      <h2>Ingreso vs gasto por mes</h2>
      <ul class="leyenda en-linea">
        <li><i style="background:var(--serie-ingreso)"></i>Ingreso</li>
        <li><i style="background:var(--serie-gasto)"></i>Gasto</li>
      </ul>
      <div class="barras-caja"><canvas id="barras-anual" role="img" aria-label="Barras de ingreso y gasto por mes. Los valores están en la tabla de abajo."></canvas></div>
    </section>
    <section class="panel">
      <div class="panel-cabecera"><h2>Ranking de categorías</h2><span class="dato">Promedio mensual: <b>${usd(promedio)}</b></span></div>
      ${m.filas.length ? `<ol class="ranking">${m.filas.map((f) => `
        <li>
          <div><span>${esc(f.categoria)}</span><b>${usd(f.total)}</b></div>
          <i style="width:${(f.total / mayor) * 100}%"></i>
        </li>`).join('')}</ol>` : '<p class="vacio">Sin gastos.</p>'}
    </section>
    <section class="panel"><h2>Categoría por mes</h2>${htmlMatriz(m)}</section>`;

  barrasIngresoGasto(raiz.querySelector('#barras-anual'), m.ingresosMes, m.totalesMes);

  raiz.querySelector('[data-anio]')?.addEventListener('change', (e) => {
    anioElegido = Number(e.target.value);
    volverADibujar();
  });
}
