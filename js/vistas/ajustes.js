// Ajustes: respaldo, tipos de cambio y categorías.

import { estado, cargarDatos, guardarAjustes, guardarCategorias, renombrarCategoria } from '../db.js';
import { validarImportacion, exportarRespaldo, exportarGastosCSV, exportarIngresosCSV } from '../importar.js';
import { actualizarTC, tcPara, MONEDAS_TC } from '../tc.js';
import { dialogo, toast } from '../ui.js';
import { esc, fechaLarga, leerNumero, numeroEditable, tipoCambio, MONEDAS } from '../formato.js';
import { htmlAvisoRespaldo } from './inicio.js';

function htmlTC(moneda) {
  const actual = tcPara(moneda);
  const fijo = estado.ajustes.tcFijo?.[moneda];
  let detalle = 'Sin datos todavía';
  if (fijo) detalle = 'Fijado a mano';
  else if (actual) detalle = `Del ${fechaLarga(actual.fecha)}`;
  return `
    <div class="tc-fila">
      <div><strong>USD → ${moneda}</strong><small>${detalle}</small></div>
      <b>${actual ? tipoCambio(actual.tc) : '–'}</b>
      <button type="button" class="btn chico" data-fijar="${moneda}">Fijar</button>
      ${fijo ? `<button type="button" class="btn chico" data-soltar="${moneda}">Automático</button>` : ''}
    </div>`;
}

function htmlCategoria(c) {
  return `
    <li class="${c.oculta ? 'oculta' : ''}">
      <span>${esc(c.nombre)}</span>
      <button type="button" class="enlace" data-renombrar="${esc(c.nombre)}">Renombrar</button>
      <button type="button" class="enlace" data-ocultar="${esc(c.nombre)}">${c.oculta ? 'Mostrar' : 'Ocultar'}</button>
    </li>`;
}

async function importar(archivo, volverADibujar) {
  let datos;
  try {
    datos = validarImportacion(await archivo.text());
  } catch (e) {
    await dialogo({ titulo: 'No se pudo importar', mensaje: e.message, botones: [] });
    return;
  }
  const resumen = `${datos.gastos.length} gastos y ${datos.ingresos.length} ingresos.`;
  const hayDatos = estado.gastos.length || estado.ingresos.length;
  const modo = await dialogo({
    titulo: 'Importar datos',
    mensaje: hayDatos
      ? `El archivo tiene ${resumen} Reemplazar borra lo que hay hoy (${estado.gastos.length} gastos). Combinar agrega y actualiza sin borrar.`
      : `El archivo tiene ${resumen}`,
    botones: hayDatos
      ? [{ texto: 'Combinar', valor: 'combinar', tipo: 'primario' }, { texto: 'Reemplazar todo', valor: 'reemplazar', tipo: 'peligro' }]
      : [{ texto: 'Importar', valor: 'reemplazar', tipo: 'primario' }]
  });
  if (!modo) return;
  try {
    await cargarDatos(datos, modo);
    toast(`Importados ${resumen}`);
  } catch {
    toast('No se pudo importar. No cambió nada.');
  }
  volverADibujar();
}

export function renderAjustes(raiz, volverADibujar) {
  const u = estado.ajustes.ultimoRespaldo;

  raiz.innerHTML = `
    <header class="titulo"><h1>Ajustes</h1></header>
    ${htmlAvisoRespaldo()}
    <section class="panel">
      <h2>Datos</h2>
      <p class="dato">${estado.gastos.length} gastos · ${estado.ingresos.length} ingresos · Último respaldo: ${u ? fechaLarga(u.slice(0, 10)) : 'nunca'}</p>
      <div class="pila">
        <label class="btn primario grande">Importar JSON<input data-importar type="file" hidden></label>
        <button type="button" class="btn grande" data-respaldo>Exportar respaldo JSON</button>
        <button type="button" class="btn grande" data-csv-gastos>Exportar gastos (Excel/CSV)</button>
        <button type="button" class="btn grande" data-csv-ingresos>Exportar ingresos (Excel/CSV)</button>
      </div>
    </section>
    <section class="panel">
      <div class="panel-cabecera"><h2>Tipos de cambio</h2><button type="button" class="enlace fuerte" data-actualizar-tc>Actualizar</button></div>
      ${MONEDAS_TC.map(htmlTC).join('')}
    </section>
    <section class="panel">
      <h2>Categorías</h2>
      <form class="agregar" data-agregar>
        <input type="text" placeholder="Nueva categoría" aria-label="Nueva categoría" autocomplete="off">
        <button type="submit" class="btn">Agregar</button>
      </form>
      <ul class="lista-cats">${estado.categorias.map(htmlCategoria).join('')}</ul>
    </section>`;

  const $ = (s) => raiz.querySelector(s);

  $('[data-importar]').onchange = async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (archivo) await importar(archivo, volverADibujar);
  };
  $('[data-respaldo]').onclick = async () => {
    if (await exportarRespaldo()) {
      toast('Respaldo exportado');
      volverADibujar();
    }
  };
  $('[data-csv-gastos]').onclick = exportarGastosCSV;
  $('[data-csv-ingresos]').onclick = exportarIngresosCSV;

  $('[data-actualizar-tc]').onclick = async () => {
    const ok = await actualizarTC({ forzar: true });
    toast(ok ? 'Tipo de cambio actualizado' : 'No se pudo actualizar. Sigue el último guardado.');
    volverADibujar();
  };
  raiz.querySelectorAll('[data-fijar]').forEach((b) => {
    b.onclick = async () => {
      const moneda = b.dataset.fijar;
      const actual = tcPara(moneda);
      const texto = await dialogo({
        titulo: `US$ 1 = ${MONEDAS[moneda].simbolo} …`,
        mensaje: 'Se usa en los movimientos nuevos hasta que vuelvas a Automático.',
        campo: actual ? numeroEditable(actual.tc) : '',
        botones: [{ texto: 'Fijar', valor: true, tipo: 'primario' }]
      });
      if (texto === null) return;
      const tc = leerNumero(texto);
      if (!(tc > 0)) {
        toast('Valor inválido');
        return;
      }
      await guardarAjustes({ tcFijo: { ...estado.ajustes.tcFijo, [moneda]: tc } });
      volverADibujar();
    };
  });
  raiz.querySelectorAll('[data-soltar]').forEach((b) => {
    b.onclick = async () => {
      const { [b.dataset.soltar]: _, ...resto } = estado.ajustes.tcFijo;
      await guardarAjustes({ tcFijo: resto });
      volverADibujar();
    };
  });

  const existe = (nombre) => estado.categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase());

  $('[data-agregar]').onsubmit = async (e) => {
    e.preventDefault();
    const nombre = e.target.querySelector('input').value.trim();
    if (!nombre) return;
    if (existe(nombre)) {
      toast('Esa categoría ya existe');
      return;
    }
    await guardarCategorias([...estado.categorias, { nombre, oculta: false }]);
    volverADibujar();
  };
  raiz.querySelectorAll('[data-renombrar]').forEach((b) => {
    b.onclick = async () => {
      const actual = b.dataset.renombrar;
      const nuevo = await dialogo({
        titulo: `Renombrar ${actual}`,
        mensaje: 'También cambia en todos sus gastos.',
        campo: actual,
        botones: [{ texto: 'Renombrar', valor: true, tipo: 'primario' }]
      });
      if (!nuevo || nuevo === actual) return;
      if (existe(nuevo) && nuevo.toLowerCase() !== actual.toLowerCase()) {
        toast('Esa categoría ya existe');
        return;
      }
      await renombrarCategoria(actual, nuevo);
      volverADibujar();
    };
  });
  raiz.querySelectorAll('[data-ocultar]').forEach((b) => {
    b.onclick = async () => {
      const nombre = b.dataset.ocultar;
      await guardarCategorias(estado.categorias.map((c) => (c.nombre === nombre ? { ...c, oculta: !c.oculta } : c)));
      volverADibujar();
    };
  });
}
