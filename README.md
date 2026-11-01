# Gastos

App personal de gastos e ingresos para iPhone (PWA). Sitio estático, sin backend. Los datos
viven en cada dispositivo y se sincronizan con un repositorio privado de GitHub.

## Estructura

- `index.html`, `manifest.json`, `sw.js`: página, instalación y modo offline.
- `css/app.css`: estilos. Los colores son variables al principio del archivo.
- `js/app.js`: arranque y navegación.
- `js/db.js`: datos (IndexedDB). Toda escritura pasa por acá.
- `js/calculos.js`: totales y resúmenes, sin tocar la pantalla.
- `js/sync.js`: sincronización entre dispositivos.
- `js/tc.js`: tipos de cambio.
- `js/importar.js`: importar y exportar.
- `js/form-gasto.js`, `js/form-ingreso.js`, `js/campo-monto.js`: formularios.
- `js/vistas/`: una pantalla por archivo.
- `vendor/chart.umd.js`: Chart.js 4.4.4, local para que funcione offline.

## Probarla en la compu

```bash
ruby -run -e httpd . -p 4173
```

Abrir `http://localhost:4173`.

## Privacidad

Los datos personales nunca van al repositorio: `.gitignore` excluye `datos-iniciales.json`,
los `.xlsx` y el script de migración.
