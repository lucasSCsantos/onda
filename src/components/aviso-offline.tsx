"use client";

import { useEffect, useSyncExternalStore } from "react";

function assinar(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/** Registra o service worker da tela offline e avisa, no topo, quando a conexão cai com o app aberto. */
export function AvisoOffline() {
  const online = useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem service worker o app funciona igual; só some a tela offline.
      });
    }
  }, []);

  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-aviso px-4 py-2 text-center text-sm font-medium text-fundo">
      Sem internet. Você pode ver o que já carregou, mas não consegue salvar mudanças.
    </div>
  );
}
