// Service worker: la app funciona offline.
// Estrategia "stale-while-revalidate": responde al instante desde la caché y, en
// paralelo, baja la versión nueva para la próxima apertura. Así un cambio publicado
// llega solo, sin tocar nada acá. Si agregás un archivo nuevo, sumalo a ARCHIVOS.

const CACHE = 'gastos-v1';

const ARCHIVOS = [
  './', 'index.html', 'manifest.json', 'css/app.css', 'vendor/chart.umd.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/calculos.js', 'js/campo-monto.js', 'js/db.js', 'js/form-gasto.js',
  'js/form-ingreso.js', 'js/formato.js', 'js/graficos.js', 'js/importar.js', 'js/tc.js',
  'js/ui.js', 'js/vistas/ajustes.js', 'js/vistas/archivo.js', 'js/vistas/inicio.js',
  'js/vistas/meses.js', 'js/vistas/resumen.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // El tipo de cambio (otro dominio) nunca pasa por la caché.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardada = await cache.match(e.request, { ignoreSearch: true });
      const red = fetch(e.request)
        .then((r) => {
          if (r.ok) cache.put(e.request, r.clone());
          return r;
        })
        .catch(() => guardada || cache.match('index.html'));
      if (guardada) {
        e.waitUntil(red);
        return guardada;
      }
      return red;
    })
  );
});
