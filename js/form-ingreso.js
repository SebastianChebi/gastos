// Cargar y editar un ingreso de un mes.

import { estado, guardarIngreso, borrarIngreso, guardarAjustes, nuevoId } from './db.js';
import { htmlCampoMonto, iniciarCampoMonto } from './campo-monto.js';
import { abrirHoja, confirmar, toast } from './ui.js';
import { esc, hoyISO, ultimoDiaMes, MESES } from './formato.js';

export function abrirFormIngreso({ ingreso, anio, mes, alCambiar }) {
  // Para un mes pasado, el TC sugerido es el más cercano a su último día.
  const fechaTC = () => {
    const fin = ultimoDiaMes(anio, mes);
    return fin < hoyISO() ? fin : hoyISO();
  };

  const { hoja, cerrar } = abrirHoja({
    titulo: `${ingreso ? 'Editar' : 'Nuevo'} ingreso · ${MESES[mes - 1]}`,
    contenido: `
      ${htmlCampoMonto()}
      <label class="campo">
        <span>Concepto</span>
        <input data-concepto type="text" autocomplete="off" autocapitalize="sentences" placeholder="Sueldo, Extra…" value="${esc(ingreso?.concepto || '')}">
      </label>
      <button type="button" class="btn primario grande" data-guardar-abajo>Guardar</button>
      ${ingreso ? '<button type="button" class="btn peligro grande" data-borrar>Borrar ingreso</button>' : ''}`,
    alGuardar: guardar,
    alCerrar: () => monto.destruir()
  });

  const $ = (s) => hoja.querySelector(s);
  const monto = iniciarCampoMonto(hoja, {
    inicial: ingreso, monedaDefecto: estado.ajustes.ultimaMoneda, fechaTC
  });

  async function guardar() {
    const dinero = monto.leer();
    if (dinero.error) {
      toast(dinero.error);
      return false;
    }
    const concepto = $('[data-concepto]').value.trim();
    if (!concepto) {
      toast('Falta el concepto');
      return false;
    }
    try {
      await guardarIngreso({ id: ingreso?.id || nuevoId('i'), anio, mes, concepto, ...dinero });
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

  if (ingreso) {
    $('[data-borrar]').onclick = async () => {
      if (!(await confirmar('¿Borrar este ingreso?', `${ingreso.concepto}. No se puede deshacer.`))) return;
      await borrarIngreso(ingreso.id);
      toast('Ingreso borrado');
      alCambiar();
      cerrar();
    };
  }

  if (!ingreso) monto.enfocar();
}
