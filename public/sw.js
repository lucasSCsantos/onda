// Tela de "sem internet" (nada com dados do ministério é guardado aqui) e notificações push.
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

// Push: o servidor manda só texto curto, uma tag e um caminho do próprio app (nunca dados de Adolescentes).
self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    // Carga que não é JSON vira o aviso genérico.
  }
  const titulo = typeof dados.titulo === "string" && dados.titulo ? dados.titulo : "Mural Onda";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: typeof dados.texto === "string" ? dados.texto : "",
      tag: typeof dados.tag === "string" ? dados.tag : undefined,
      icon: "/icones/icone-192.png",
      data: { url: typeof dados.url === "string" ? dados.url : "/" },
    }),
  );
});

// Tocar na notificação reaproveita a janela do app que já está aberta ou abre uma nova no Evento ou na Chamada.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url ?? "/", self.location.origin);
  const url = destino.origin === self.location.origin ? destino.href : self.location.origin + "/";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (janelas) => {
      const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
      if (!aberta) return self.clients.openWindow(url);
      await aberta.focus();
      return "navigate" in aberta ? aberta.navigate(url) : undefined;
    }),
  );
});
