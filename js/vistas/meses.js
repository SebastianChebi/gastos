// Meses: una sección por mes con su resumen, categorías, ingresos y movimientos.

import { estado } from '../db.js';
import { resumenMes, porCategoria, ordenarMovimientos, aniosActivos } from '../calculos.js';
import { filaMovimiento, tarjeta } from '../ui.js';
import { usd, dinero, esc, numero, MESES } from '../formato.js';
import { abrirFormIngreso } from '../form-ingreso.js';

// Filtros y selección: sobreviven a volver de editar un movimiento.
const seleccion = { anio: null, mes: null, categoria: '', evitable: 'todos' };

const FILTROS_EVITABLE = [['todos', 'Todos'], ['si', 'Evitable'], ['no', 'No evitable']];

function htmlTablaCategorias(categorias, r) {
  if (!categorias.length) return '<p class="vacio">Sin gastos este mes.</p>';
  return `
    <table class="tabla">
      <thead><tr><th>Categoría</th><th class="n">Total</th><th class="n">Evitable</th></tr></thead>
      <tbody>${categorias.map((c) => `<tr><td>${esc(c.nombre)}</td><td class="n">${numero(c.total)}</td><td class="n">${c.evitable ? numero(c.evitable) : '–'}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th>Total</th><td class="n total-gasto">${numero(r.gasto)}</td><td class="n total-evitable">${numero(r.evitable)}</td></tr></tfoot>
    </table>`;
}

function filtrar(gastos) {
  return gastos.filter((g) => (!seleccion.categoria || g.categoria === seleccion.categoria)
    && (seleccion.evitable === 'todos' || g.evitable === (seleccion.evitable === 'si')));
}

export function renderMeses(raiz, volverADibujar) {
  const ahora = new Date();
  const anios = aniosActivos(estado.gastos, ahora.getFullYear());
  seleccion.anio ??= ahora.getFullYear();
  seleccion.mes ??= ahora.getMonth() + 1;
  const { anio, mes } = seleccion;

  const r = resumenMes(estado, anio, mes);
  const categorias = porCategoria(r.gastos);
  // Un filtro que quedó de otro mes no debe esconder la lista entera.
  if (seleccion.categoria && !categorias.some((c) => c.nombre === seleccion.categoria)) seleccion.categoria = '';
  const lista = ordenarMovimientos(filtrar(r.gastos));
  const totalLista = lista.reduce((t, g) => t + g.montoUSD, 0);

  raiz.innerHTML = `
    <header class="titulo"><h1>Meses</h1>
      ${anios.length > 1
    ? `<select class="select-anio" data-anio aria-label="Año">${anios.map((a) => `<option ${a === anio ? 'selected' : ''}>${a}</option>`).join('')}</select>`
    : `<p>${anio}</p>`}
    </header>
    <div class="selector-mes" role="group" aria-label="Mes">
      ${MESES.map((m, i) => `<button type="button" data-mes="${i + 1}" aria-pressed="${i + 1 === mes}">${m}</button>`).join('')}
    </div>
    <section class="tarjetas">
      ${tarjeta('Ingreso', usd(r.ingreso), '', 'ingreso')}
      ${tarjeta('Gasto total', usd(r.gasto), '', 'gasto')}
      ${tarjeta('Ahorro', usd(r.ahorro), '', r.ahorro < 0 ? 'ahorro negativo' : 'ahorro')}
      ${tarjeta('Evitable', usd(r.evitable), '', 'evitable')}
    </section>
    <section class="panel">
      <div class="panel-cabecera"><h2>Ingresos</h2><button type="button" class="enlace fuerte" data-nuevo-ingreso>+ Agregar</button></div>
      ${r.ingresos.length
    ? `<ul class="movs">${r.ingresos.map((i) => `
        <li><button type="button" class="mov es-ingreso" data-ingreso="${esc(i.id)}">
          <span class="mov-texto"><strong>${esc(i.concepto)}</strong></span>
          <span class="mov-monto"><strong>${usd(i.montoUSD)}</strong>${i.moneda !== 'USD' ? `<small>${dinero(i.montoOriginal, i.moneda)}</small>` : ''}</span>
        </button></li>`).join('')}</ul>`
    : '<p class="vacio">Sin ingresos cargados.</p>'}
    </section>
    <section class="panel"><h2>Por categoría</h2>${htmlTablaCategorias(categorias, r)}</section>
    <section class="panel">
      <h2>Movimientos</h2>
      <div class="filtros">
        <select data-filtro-categoria aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          ${categorias.map((c) => `<option value="${esc(c.nombre)}" ${c.nombre === seleccion.categoria ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
        </select>
        <div class="seg" role="group" aria-label="Filtrar por evitable">
          ${FILTROS_EVITABLE.map(([v, t]) => `<button type="button" data-filtro-evitable="${v}" aria-pressed="${v === seleccion.evitable}">${t}</button>`).join('')}
        </div>
      </div>
      <p class="conteo">${lista.length} ${lista.length === 1 ? 'movimiento' : 'movimientos'} · ${usd(totalLista)}</p>
      ${lista.length ? `<ul class="movs">${lista.map(filaMovimiento).join('')}</ul>` : '<p class="vacio">Nada para mostrar.</p>'}
    </section>`;

  raiz.querySelector('.selector-mes [aria-pressed="true"]').scrollIntoView({ inline: 'center', block: 'nearest' });

  raiz.querySelectorAll('[data-mes]').forEach((b) => {
    b.onclick = () => {
      seleccion.mes = Number(b.dataset.mes);
      volverADibujar();
    };
  });
  raiz.querySelector('[data-anio]')?.addEventListener('change', (e) => {
    seleccion.anio = Number(e.target.value);
    volverADibujar();
  });
  raiz.querySelector('[data-filtro-categoria]').onchange = (e) => {
    seleccion.categoria = e.target.value;
    volverADibujar();
  };
  raiz.querySelectorAll('[data-filtro-evitable]').forEach((b) => {
    b.onclick = () => {
      seleccion.evitable = b.dataset.filtroEvitable;
      volverADibujar();
    };
  });
  raiz.querySelector('[data-nuevo-ingreso]').onclick = () => {
    abrirFormIngreso({ anio, mes, alCambiar: volverADibujar });
  };
  raiz.querySelectorAll('[data-ingreso]').forEach((b) => {
    b.onclick = () => {
      const ingreso = estado.ingresos.find((i) => i.id === b.dataset.ingreso);
      abrirFormIngreso({ ingreso, anio, mes, alCambiar: volverADibujar });
    };
  });
}
