// Campo de monto con moneda y conversión en vivo. Lo comparten gastos e ingresos.

import { MONEDAS, dinero, usd, tipoCambio, fechaCorta, leerNumero, numeroEditable, esc } from './formato.js';
import { tcPara } from './tc.js';

export const htmlCampoMonto = () => `
  <div class="monto-caja">
    <input class="monto-input" data-monto type="text" inputmode="decimal" placeholder="0,00" autocomplete="off" aria-label="Monto">
    <div class="seg" role="group" aria-label="Moneda">
      ${Object.entries(MONEDAS).map(([k, m]) => `<button type="button" data-moneda="${k}">${esc(m.boton)}</button>`).join('')}
    </div>
  </div>
  <div class="equiv" data-equiv hidden>
    <p data-equiv-texto></p>
    <button type="button" class="enlace" data-tc-editar>Editar TC</button>
  </div>
  <p class="aviso-tc" data-tc-aviso hidden></p>
  <label class="campo" data-tc-campo hidden>
    <span data-tc-etiqueta></span>
    <input data-tc type="text" inputmode="decimal" autocomplete="off">
  </label>`;

// `inicial`: { montoOriginal, moneda, tc } si se edita un movimiento existente.
// `fechaTC()` da la fecha que define el TC sugerido.
export function iniciarCampoMonto(raiz, { inicial, monedaDefecto, fechaTC }) {
  const $ = (s) => raiz.querySelector(s);
  const input = $('[data-monto]');
  const inputTc = $('[data-tc]');
  let moneda = inicial?.moneda || monedaDefecto || 'USD';
  // Un TC guardado o tocado a mano no se reemplaza por el sugerido.
  let tcManual = Boolean(inicial);

  if (inicial) {
    input.value = numeroEditable(inicial.montoOriginal);
    inputTc.value = numeroEditable(inicial.tc);
  }

  function pintar() {
    raiz.querySelectorAll('[data-moneda]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.moneda === moneda));
    });

    const esUSD = moneda === 'USD';
    const fecha = fechaTC();
    const sugerido = esUSD ? null : tcPara(moneda, fecha);
    if (!esUSD && !tcManual) inputTc.value = sugerido ? numeroEditable(sugerido.tc) : '';

    const tc = leerNumero(inputTc.value);
    const monto = leerNumero(input.value);
    const hayTc = tc > 0;

    $('[data-equiv]').hidden = esUSD || !hayTc;
    if (!esUSD && hayTc) {
      const base = monto > 0 ? monto : 0;
      $('[data-equiv-texto]').textContent =
        `${dinero(base, moneda)} ≈ ${usd(base / tc)} · TC ${tipoCambio(tc)}`;
    }

    if (!esUSD) $('[data-tc-etiqueta]').textContent = `Tipo de cambio: US$ 1 = ${MONEDAS[moneda].simbolo} …`;
    if (esUSD) $('[data-tc-campo]').hidden = true;
    else if (!hayTc) $('[data-tc-campo]').hidden = false;

    const aviso = $('[data-tc-aviso]');
    let textoAviso = '';
    if (!esUSD && !hayTc) textoAviso = 'No hay tipo de cambio guardado. Ingresalo a mano.';
    else if (!esUSD && !tcManual && sugerido.fecha !== fecha) textoAviso = `TC del ${fechaCorta(sugerido.fecha)}`;
    else if (!esUSD && !tcManual && sugerido.fuente === 'fijo') textoAviso = 'TC fijado a mano en Ajustes';
    aviso.textContent = textoAviso;
    aviso.hidden = !textoAviso;
  }

  raiz.querySelectorAll('[data-moneda]').forEach((b) => {
    b.onclick = () => {
      moneda = b.dataset.moneda;
      tcManual = false;
      pintar();
    };
  });
  input.oninput = pintar;
  inputTc.oninput = () => {
    tcManual = true;
    pintar();
  };
  $('[data-tc-editar]').onclick = () => {
    $('[data-tc-campo]').hidden = false;
    inputTc.focus();
  };

  const alActualizarTC = () => pintar();
  document.addEventListener('tc-actualizado', alActualizarTC);
  pintar();

  return {
    enfocar: () => input.focus(),
    refrescar: pintar,
    destruir: () => document.removeEventListener('tc-actualizado', alActualizarTC),
    // Devuelve { error } o los campos de dinero listos para guardar.
    leer() {
      const montoOriginal = leerNumero(input.value);
      if (!(montoOriginal > 0)) return { error: 'Ingresá un monto mayor a cero' };
      const tc = moneda === 'USD' ? 1 : leerNumero(inputTc.value);
      if (!(tc > 0)) return { error: 'Falta el tipo de cambio' };
      return { montoOriginal, moneda, tc, montoUSD: montoOriginal / tc };
    }
  };
}
