// Cargar y editar un gasto. Es la pantalla más usada: tiene que ser rapidísima.

import { estado, guardarGasto, borrarGasto, guardarAjustes, nuevoId } from './db.js';
import { categoriasPorUso, habitosDeConceptos } from './calculos.js';
import { htmlCampoMonto, iniciarCampoMonto } from './campo-monto.js';
import { abrirHoja, confirmar, toast } from './ui.js';
import { esc, hoyISO, normalizar } from './formato.js';

const MAX_SUGERENCIAS = 5;

export function abrirFormGasto(gasto, alCambiar) {
  const habitos = habitosDeConceptos(estado.gastos);
  let categoria = gasto?.categoria || '';

  const { hoja, cerrar } = abrirHoja({
    titulo: gasto ? 'Editar gasto' : 'Nuevo gasto',
    contenido: `
      ${htmlCampoMonto()}
      <label class="campo">
        <span>Concepto</span>
        <input data-concepto type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" value="${esc(gasto?.concepto || '')}">
      </label>
      <div class="sugerencias" data-sugerencias></div>
      <div class="campo"><span>Categoría</span>
        <div class="chips" data-chips>
          ${categoriasPorUso(estado, categoria).map((c) => `<button type="button" class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>
      </div>
      <label class="interruptor">
        <span>Evitable</span>
        <input data-evitable type="checkbox" role="switch" ${gasto?.evitable ? 'checked' : ''}>
      </label>
      <label class="campo">
        <span>Fecha</span>
        <input data-fecha type="date" value="${gasto?.fecha || hoyISO()}">
      </label>
      <button type="button" class="btn primario grande" data-guardar-abajo>Guardar</button>
      ${gasto ? '<button type="button" class="btn peligro grande" data-borrar>Borrar gasto</button>' : ''}`,
    alGuardar: guardar,
    alCerrar: () => monto.destruir()
  });

  const $ = (s) => hoja.querySelector(s);
  const inputFecha = $('[data-fecha]');
  const inputConcepto = $('[data-concepto]');
  const inputEvitable = $('[data-evitable]');
  const cajaSugerencias = $('[data-sugerencias]');

  const monto = iniciarCampoMonto(hoja, {
    inicial: gasto,
    monedaDefecto: estado.ajustes.ultimaMoneda,
    fechaTC: () => inputFecha.value || hoyISO()
  });

  function marcarCategoria() {
    hoja.querySelectorAll('[data-cat]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.cat === categoria));
    });
  }

  function mostrarSugerencias() {
    const texto = normalizar(inputConcepto.value);
    const coincidencias = texto
      ? habitos.filter((h) => h.clave.includes(texto) && h.clave !== texto).slice(0, MAX_SUGERENCIAS)
      : [];
    cajaSugerencias.innerHTML = coincidencias
      .map((h) => `<button type="button" class="sugerencia" data-clave="${esc(h.clave)}">${esc(h.concepto)}<small>${esc(h.categoria)}</small></button>`)
      .join('');
  }

  // Al elegir un concepto conocido se completan su categoría y "evitable" habituales.
  cajaSugerencias.onclick = (e) => {
    const b = e.target.closest('[data-clave]');
    if (!b) return;
    const h = habitos.find((x) => x.clave === b.dataset.clave);
    inputConcepto.value = h.concepto;
    categoria = h.categoria;
    inputEvitable.checked = h.evitable;
    cajaSugerencias.innerHTML = '';
    marcarCategoria();
  };
  inputConcepto.oninput = mostrarSugerencias;

  $('[data-chips]').onclick = (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    marcarCategoria();
  };

  inputFecha.onchange = () => monto.refrescar();

  async function guardar() {
    const dinero = monto.leer();
    if (dinero.error) {
      toast(dinero.error);
      return false;
    }
    const concepto = inputConcepto.value.trim();
    if (!concepto) {
      toast('Falta el concepto');
      return false;
    }
    if (!categoria) {
      toast('Elegí una categoría');
      return false;
    }
    if (!inputFecha.value) {
      toast('Falta la fecha');
      return false;
    }
    const registro = {
      id: gasto?.id || nuevoId('g'),
      creado: gasto?.creado || new Date().toISOString(),
      concepto, categoria,
      evitable: inputEvitable.checked,
      fecha: inputFecha.value,
      ...dinero
    };
    try {
      await guardarGasto(registro);
      await guardarAjustes({ ultimaMoneda: dinero.moneda });
    } catch {
      toast('No se pudo guardar');
      return false;
    }
    toast('Guardado');
    alCambiar();
    return true;
  }

  $('[data-guardar-abajo]').onclick = async () => {
    if (await guardar()) cerrar();
  };

  if (gasto) {
    $('[data-borrar]').onclick = async () => {
      if (!(await confirmar('¿Borrar este gasto?', `${gasto.concepto}. No se puede deshacer.`))) return;
      await borrarGasto(gasto.id);
      toast('Gasto borrado');
      alCambiar();
      cerrar();
    };
  }

  marcarCategoria();
  // Sincrónico dentro del toque: si no, iOS no abre el teclado.
  if (!gasto) monto.enfocar();
}
