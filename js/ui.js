// Piezas de interfaz compartidas: avisos, diálogos, hojas y listas.

import { esc, usd, dinero, fechaCorta, MESES } from './formato.js';

export function toast(texto) {
  const el = document.getElementById('toast');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

// Diálogo con botones. `botones`: [{ texto, valor, tipo }]. Resuelve con el valor
// elegido; cerrar con Cancelar resuelve null.
export function dialogo({ titulo, mensaje = '', botones, campo = null }) {
  return new Promise((ok) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.innerHTML = `
      <h2>${esc(titulo)}</h2>
      ${mensaje ? `<p>${esc(mensaje)}</p>` : ''}
      ${campo !== null ? `<input type="text" value="${esc(campo)}" aria-label="${esc(titulo)}" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false">` : ''}
      <div class="dialogo-botones">
        ${botones.map((b, i) => `<button type="button" class="btn ${b.tipo || ''}" data-i="${i}">${esc(b.texto)}</button>`).join('')}
        <button type="button" class="btn" data-cancelar>Cancelar</button>
      </div>`;
    const cerrar = (valor) => {
      d.close();
      d.remove();
      ok(valor);
    };
    d.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if ('cancelar' in b.dataset) return cerrar(null);
      const valor = botones[Number(b.dataset.i)].valor;
      cerrar(campo !== null ? d.querySelector('input').value.trim() : valor);
    };
    d.oncancel = (e) => {
      e.preventDefault();
      cerrar(null);
    };
    document.body.append(d);
    d.showModal();
  });
}

export const confirmar = async (titulo, mensaje, textoBoton = 'Borrar') =>
  (await dialogo({ titulo, mensaje, botones: [{ texto: textoBoton, valor: true, tipo: 'peligro' }] })) === true;

// Hoja a pantalla completa para formularios. `alGuardar` devuelve true si guardó.
export function abrirHoja({ titulo, contenido, alGuardar, alCerrar }) {
  const hoja = document.createElement('div');
  hoja.className = 'hoja';
  hoja.setAttribute('role', 'dialog');
  hoja.setAttribute('aria-modal', 'true');
  hoja.setAttribute('aria-label', titulo);
  hoja.innerHTML = `
    <header class="hoja-cabecera">
      <button type="button" class="enlace" data-cerrar>Cancelar</button>
      <h2>${esc(titulo)}</h2>
      <button type="button" class="enlace fuerte" data-guardar>Guardar</button>
    </header>
    <div class="hoja-cuerpo">${contenido}</div>`;

  const cerrar = () => {
    hoja.remove();
    document.body.classList.remove('con-hoja');
    alCerrar?.();
  };
  hoja.querySelector('[data-cerrar]').onclick = cerrar;
  hoja.querySelector('[data-guardar]').onclick = async () => {
    if (await alGuardar()) cerrar();
  };
  document.body.append(hoja);
  document.body.classList.add('con-hoja');
  return { hoja, cerrar };
}

export function filaMovimiento(g) {
  const detalle = [esc(g.categoria), fechaCorta(g.fecha)];
  return `
    <li><button type="button" class="mov" data-gasto="${esc(g.id)}">
      <span class="mov-texto">
        <strong>${esc(g.concepto)}</strong>
        <small>${detalle.join(' · ')}${g.evitable ? ' · <span class="etiqueta">Evitable</span>' : ''}</small>
      </span>
      <span class="mov-monto">
        <strong>${usd(g.montoUSD)}</strong>
        ${g.moneda !== 'USD' ? `<small>${dinero(g.montoOriginal, g.moneda)}</small>` : ''}
      </span>
    </button></li>`;
}

export function tarjeta(etiqueta, valor, detalle = '', clase = '') {
  return `<div class="tarjeta ${clase}"><span>${esc(etiqueta)}</span><strong>${valor}</strong>${detalle ? `<small>${detalle}</small>` : ''}</div>`;
}

// Aviso de meses con gastos pero sin ingreso (ej. Enero y Febrero 2026).
export function notaMesesSinIngreso(matriz) {
  const faltan = MESES.filter((_, i) => matriz.totalesMes[i] > 0 && matriz.ingresosMes[i] === 0);
  if (!faltan.length) return '';
  return `<p class="nota">Sin ingreso cargado: ${faltan.join(', ')}. El ahorro del año no los compensa.</p>`;
}
