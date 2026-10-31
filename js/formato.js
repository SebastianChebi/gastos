// Formato de números y fechas. Todo en un solo lugar para que la app sea consistente.

export const MONEDAS = {
  USD: { simbolo: 'US$', boton: 'USD', nombre: 'dólares' },
  PEN: { simbolo: 'S/', boton: 'S/', nombre: 'soles' },
  UYU: { simbolo: '$U', boton: '$U', nombre: 'pesos uruguayos' }
};

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const f2 = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f3 = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const numero = (n) => f2.format(n);
export const usd = (n) => `${n < 0 ? '−' : ''}US$ ${f2.format(Math.abs(n))}`;
export const dinero = (n, moneda) => `${MONEDAS[moneda].simbolo} ${f2.format(n)}`;
export const tipoCambio = (n) => f3.format(n);
export const porcentaje = (n) => `${Math.round(n)}%`;

// Fecha local en YYYY-MM-DD. No usar toISOString(): es UTC, y a la noche daría mañana.
export function hoyISO(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export const fechaCorta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const fechaLarga = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function diasEntre(isoA, isoB) {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000);
}

export function ultimoDiaMes(anio, mes) {
  return hoyISO(new Date(anio, mes, 0));
}

// Acepta lo que escribe el teclado del iPhone: "12,5", "12.5", "1.234,56".
export function leerNumero(texto) {
  let t = String(texto).trim().replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : NaN;
}

// Número para mostrar dentro de un input, con coma decimal y sin ruido de redondeo.
export function numeroEditable(n) {
  return String(Math.round(n * 1e6) / 1e6).replace('.', ',');
}

const MAPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Todo texto escrito por el usuario pasa por acá antes de entrar a innerHTML.
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => MAPA_ESC[c]);

export const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
