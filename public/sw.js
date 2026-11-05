// Kurulabilirlik için minimal servis çalışanı: önbellek yok, istekler ağa gider.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
