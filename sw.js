// Older homepage installations check this exact URL for updates.
// Retire that registration so subsequent visits use the published page.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.registration.unregister());
});
