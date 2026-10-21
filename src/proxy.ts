import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, ícones e o manifesto do PWA.
    "/((?!_next/static|_next/image|favicon.ico|icones/|manifest.webmanifest|robots.txt|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
