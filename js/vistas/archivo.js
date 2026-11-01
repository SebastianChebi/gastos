// 2025: solo resumen y solo lectura. Sin secciones por mes ni ingresos.

import { estado } from '../db.js';
import { matrizAnual } from '../calculos.js';
import { tarjeta } from '../ui.js';
import { usd } from '../formato.js';
import { htmlMatriz } from './resumen.js';

const ANIO = 2025;

export function renderArchivo(raiz) {
  const m = matrizAnual(estado, ANIO);
  raiz.innerHTML = `
    <header class="titulo"><h1>2025</h1><p>Junio a diciembre · solo lectura</p></header>
    <section class="tarjetas">
      ${tarjeta('Total del período', usd(m.gasto), '', 'gasto')}
      ${tarjeta('Evitable', usd(m.evitable), '', 'evitable')}
    </section>
    <section class="panel"><h2>Categoría por mes</h2>${htmlMatriz(m)}</section>`;
}
