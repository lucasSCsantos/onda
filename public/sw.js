// Só existe para a tela de "sem internet". Nada com dados do ministério é guardado aqui.
const CACHE = "mural-onda-offline-v1";
const PAGINA_OFFLINE = "/offline";

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.add(PAGINA_OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Navegação que falha por falta de rede mostra a tela offline; o resto segue direto para a rede.
self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(async () => (await caches.match(PAGINA_OFFLINE)) ?? Response.error()),
  );
});
