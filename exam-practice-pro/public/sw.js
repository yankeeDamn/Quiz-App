const CACHE_NAME = 'exampro-shell-v1';
const SHELL_PATHS = ['/', '/india-mocks', '/certifications'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(SHELL_PATHS.map(async (path) => {
      try {
        const response = await fetch(path, { credentials: 'same-origin' });
        if (response.ok && response.type === 'basic') await cache.put(path, response);
      } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('exampro-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|auth|admin)(\/|$)/i.test(url.pathname) || /cashfree/i.test(url.hostname + url.pathname)) return;
  if (!SHELL_PATHS.includes(url.pathname) || url.search) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return new Response('ExamPro is offline. Reconnect to load the latest tests and results.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
