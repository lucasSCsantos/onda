import type { NextRequest } from "next/server";
import { montarFeed } from "@/lib/calendario/feed";
import { supabaseDeServico } from "@/lib/supabase/servico";

// O feed muda com o Mural e depende do token: nunca vem de cache.
export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/**
 * O feed `.ics` de uma Assinatura de calendário, em `/feed/<token>.ics`. Rota pública: quem autentica é o token, que
 * funciona como senha de leitura. Um endereço que não vale (desconhecido, regerado, revogado) responde 404, sem
 * distinguir um do outro; acima do limite de consultas, 429 com `Retry-After`. O token nunca é registrado.
 */
export async function GET(_: NextRequest, { params }: RouteContext<"/feed/[arquivo]">) {
  const { arquivo } = await params;
  const token = arquivo.replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("Não encontrado.", { status: 404, headers: SEM_CACHE });

  const resultado = await montarFeed(supabaseDeServico(), token, new Date());
  switch (resultado.estado) {
    case "ok":
      return new Response(resultado.texto, {
        headers: { ...SEM_CACHE, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="mural-onda.ics"' },
      });
    case "limite":
      return new Response("Muitas consultas. Tente de novo mais tarde.", {
        status: 429,
        headers: { ...SEM_CACHE, "Retry-After": String(resultado.espera) },
      });
    default:
      return new Response("Não encontrado.", { status: 404, headers: SEM_CACHE });
  }
}
