// Punto de entrada: arranca los datos y dibuja la pantalla según el #hash.
// Para agregar una pantalla: creá js/vistas/x.js, sumala a VISTAS y al menú de
// index.html, y agregá el archivo a la lista de sw.js.

import { estado, iniciar } from './db.js';
import { actualizarTC } from './tc.js';
import { abrirFormGasto } from './form-gasto.js';
import { limpiarGraficos } from './graficos.js';
import { hoyISO } from './formato.js';
import { renderInicio } from './vistas/inicio.js';
import { renderMeses } from './vistas/meses.js';
import { renderResumen } from './vistas/resumen.js';
import { renderArchivo } from './vistas/archivo.js';
import { renderAjustes } from './vistas/ajustes.js';

const VISTAS = {
  inicio: renderInicio,
  meses: renderMeses,
  resumen: renderResumen,
  archivo: renderArchivo,
  ajustes: renderAjustes
};

const raiz = document.getElementById('vista');
let ultimaFecha = hoyISO();

function dibujar() {
  const nombre = location.hash.slice(1);
  const clave = nombre in VISTAS ? nombre : 'inicio';
  limpiarGraficos();
  VISTAS[clave](raiz, dibujar);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === clave) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// Tocar un movimiento en cualquier lista abre su edición.
raiz.addEventListener('click', (e) => {
  const fila = e.target.closest('[data-gasto]');
  if (!fila) return;
  const gasto = estado.gastos.find((g) => g.id === fila.dataset.gasto);
  if (gasto) abrirFormGasto(gasto, dibujar);
});

document.getElementById('fab').onclick = () => abrirFormGasto(null, dibujar);

window.addEventListener('hashchange', () => {
  dibujar();
  window.scrollTo(0, 0);
});

// Los gráficos toman sus colores al dibujarse: redibujar si cambia el tema.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', dibujar);

// El iPhone deja la app abierta días: al volver, revisar si cambió la fecha.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) return;
  const hoy = hoyISO();
  if (hoy !== ultimaFecha) {
    ultimaFecha = hoy;
    dibujar();
  }
  if (await actualizarTC()) dibujar();
});

async function arrancar() {
  await iniciar();
  dibujar();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  if (await actualizarTC()) dibujar();
}

arrancar().catch(() => {
  raiz.innerHTML = '<p class="vacio">No se pudieron abrir los datos. Cerrá y volvé a abrir la app.</p>';
});
