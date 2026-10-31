// Gráficos con Chart.js. Los colores salen de las variables de css/app.css, así
// siguen al modo claro/oscuro. Convención fija: Ingreso = azul, Gasto = naranja.

import { MESES_CORTOS, usd, numero } from './formato.js';

/* global Chart */

let activos = [];

export function limpiarGraficos() {
  activos.forEach((g) => g.destroy());
  activos = [];
}

const color = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

function crear(canvas, config) {
  const g = new Chart(canvas, { ...config, options: { animation: false, responsive: true, maintainAspectRatio: false, ...config.options } });
  activos.push(g);
  return g;
}

// `segmentos`: [{ etiqueta, valor, color }] donde color es una variable CSS.
export function dona(canvas, segmentos) {
  const superficie = color('--superficie');
  crear(canvas, {
    type: 'doughnut',
    data: {
      labels: segmentos.map((s) => s.etiqueta),
      datasets: [{
        data: segmentos.map((s) => s.valor),
        backgroundColor: segmentos.map((s) => color(s.color)),
        borderColor: superficie,
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${usd(c.parsed)}` } }
      }
    }
  });
}

export function barrasIngresoGasto(canvas, ingresos, gastos) {
  const tinta = color('--texto-2');
  const superficie = color('--superficie');
  const serie = (label, data, c) => ({
    label, data,
    backgroundColor: color(c),
    borderColor: superficie,
    borderWidth: 1,
    borderRadius: { topLeft: 4, topRight: 4 },
    borderSkipped: 'bottom'
  });
  crear(canvas, {
    type: 'bar',
    data: {
      labels: MESES_CORTOS,
      datasets: [serie('Ingreso', ingresos, '--serie-ingreso'), serie('Gasto', gastos, '--serie-gasto')]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      datasets: { bar: { categoryPercentage: 0.72, barPercentage: 0.92 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${usd(c.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, border: { color: color('--linea') }, ticks: { color: tinta, font: { size: 11 }, maxRotation: 0, autoSkip: false } },
        y: {
          beginAtZero: true,
          grid: { color: color('--linea-suave') },
          border: { display: false },
          ticks: { color: tinta, font: { size: 11 }, maxTicksLimit: 5, callback: (v) => numero(v).replace(/,00$/, '') }
        }
      }
    }
  });
}
