import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, ícones, o manifesto, o service worker e a tela offline do PWA.
    "/((?!_next/static|_next/image|favicon.ico|icones/|manifest.webmanifest|robots.txt|sw.js|offline|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
