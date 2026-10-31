// Inicio: cómo viene el mes actual.

import { estado } from '../db.js';
import { resumenMes, ordenarMovimientos } from '../calculos.js';
import { filaMovimiento, tarjeta } from '../ui.js';
import { usd, porcentaje, MESES } from '../formato.js';
import { dona } from '../graficos.js';
import { diasSinRespaldo } from '../importar.js';

const CANTIDAD_ULTIMOS = 8;
const DIAS_AVISO_RESPALDO = 30;

export function htmlAvisoRespaldo() {
  const dias = diasSinRespaldo();
  if (dias === null || dias <= DIAS_AVISO_RESPALDO) return '';
  const desde = estado.ajustes.ultimoRespaldo ? `Pasaron ${dias} días desde tu último respaldo.` : `Hace ${dias} días que usás la app sin respaldo.`;
  return `<a class="banner" href="#ajustes">${desde} <strong>Hacer respaldo</strong></a>`;
}

function segmentos({ ingreso, gasto }) {
  if (ingreso > 0 && gasto > ingreso) {
    return [
      { etiqueta: 'Gastado', valor: ingreso, color: '--serie-gasto' },
      { etiqueta: 'Exceso', valor: gasto - ingreso, color: '--critico' }
    ];
  }
  if (ingreso > 0) {
    return [
      { etiqueta: 'Gastado', valor: gasto, color: '--serie-gasto' },
      { etiqueta: 'Disponible', valor: ingreso - gasto, color: '--resto' }
    ];
  }
  if (gasto > 0) return [{ etiqueta: 'Gastado', valor: gasto, color: '--serie-gasto' }];
  return [{ etiqueta: 'Sin movimientos', valor: 1, color: '--resto' }];
}

export function renderInicio(raiz) {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth() + 1;
  const r = resumenMes(estado, anio, mes);
  const pctEvitable = r.gasto > 0 ? (r.evitable / r.gasto) * 100 : 0;
  const segs = segmentos(r);
  const ultimos = ordenarMovimientos(estado.gastos).slice(0, CANTIDAD_ULTIMOS);

  const centro = r.ingreso > 0
    ? `<strong>${porcentaje((r.gasto / r.ingreso) * 100)}</strong><small>del ingreso</small>`
    : `<strong>${usd(r.gasto)}</strong><small>sin ingreso cargado</small>`;

  const sinDatos = !estado.gastos.length && !estado.ingresos.length;

  raiz.innerHTML = `
    <header class="titulo"><h1>${MESES[mes - 1]}</h1><p>${anio}</p></header>
    ${htmlAvisoRespaldo()}
    ${sinDatos ? '<a class="banner" href="#ajustes">Todavía no hay datos. <strong>Importar respaldo</strong></a>' : ''}
    <section class="tarjetas">
      ${tarjeta('Ingreso del mes', usd(r.ingreso))}
      ${tarjeta('Gastado', usd(r.gasto))}
      ${tarjeta('Disponible', usd(r.ahorro), r.ahorro < 0 ? 'Te pasaste del ingreso' : '', r.ahorro < 0 ? 'negativo' : '')}
      ${tarjeta('Evitable', usd(r.evitable), `${porcentaje(pctEvitable)} del gasto`)}
    </section>
    <section class="panel dona-panel">
      <h2>Gastado vs disponible</h2>
      <div class="dona-caja">
        <canvas id="dona-mes" role="img" aria-label="${segs.map((s) => `${s.etiqueta}: ${usd(s.valor)}`).join(', ')}"></canvas>
        <div class="dona-centro">${centro}</div>
      </div>
      <ul class="leyenda">
        ${segs.filter((s) => s.etiqueta !== 'Sin movimientos').map((s) => `<li><i style="background:var(${s.color})"></i>${s.etiqueta}<b>${usd(s.valor)}</b></li>`).join('')}
      </ul>
    </section>
    <section class="panel">
      <h2>Últimos movimientos</h2>
      ${ultimos.length ? `<ul class="movs">${ultimos.map(filaMovimiento).join('')}</ul>` : '<p class="vacio">Todavía no cargaste gastos.</p>'}
    </section>`;

  dona(raiz.querySelector('#dona-mes'), segs);
}
