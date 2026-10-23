import type { NextRequest } from "next/server";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { cabecalhoDeAnexo, servirItem, type AcaoSobreItem } from "@/dominio/arquivos";
import { atalhoVisivel } from "@/lib/arquivos/consultas";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { perfilAtual } from "@/lib/contas/perfil";
import { clienteDeArquivos } from "@/lib/drive/servidor";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

// O conteúdo depende de quem pede e do que o Drive tem agora: a resposta nunca é compartilhada entre pessoas.
export const dynamic = "force-dynamic";

const ACOES: Record<string, AcaoSobreItem> = { miniatura: "miniatura", ver: "ver", baixar: "baixar" };
const BASE = { "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };

const recusa = (status: number, texto: string) => new Response(texto, { status, headers: { ...BASE, "Cache-Control": "private, no-store" } });

/**
 * Miniatura, imagem ampliada e download de um arquivo do Drive, sempre pelo servidor: o navegador nunca recebe token nem
 * endereço do Drive. Só a Liderança ativa; o item precisa estar dentro da raiz (e do atalho pedido, se a pessoa pode vê-lo).
 * Tudo o que não passa responde 404, sem dizer se o item existe.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/arquivos/item/[id]">) {
  const { id } = await params;
  const acao = ACOES[request.nextUrl.searchParams.get("acao") ?? "baixar"];
  if (!acao || !/^[A-Za-z0-9_-]{10,}$/.test(id)) return recusa(404, "Não encontrado.");

  const perfil = await perfilAtual();
  if (!perfil || !podeVerTodosOsEventos(perfil)) return recusa(404, "Não encontrado.");

  const supabase = await supabaseDoServidor();
  const config = await configuracoes(supabase);
  const cliente = clienteDeArquivos();
  if (!config.drive.ligado || !config.drive.pastaRaizId || !cliente) return recusa(404, "Não encontrado.");

  const atalhoPedido = request.nextUrl.searchParams.get("atalho");
  const atalho = atalhoPedido ? await atalhoVisivel(supabase, atalhoPedido) : null;
  if (atalhoPedido && !atalho) return recusa(404, "Não encontrado.");

  const resultado = await servirItem({
    cliente,
    raizId: config.drive.pastaRaizId,
    atalho,
    itemId: id,
    acao,
    limiteDeDownloadBytes: config.drive.limiteDeDownloadMb * 1024 * 1024,
  });

  switch (resultado.estado) {
    case "ok":
      return new Response(Buffer.from(resultado.bytes), {
        headers: {
          ...BASE,
          "Content-Type": resultado.mime,
          "Content-Disposition": cabecalhoDeAnexo(resultado.nome, resultado.emLinha),
          "Content-Length": String(resultado.bytes.byteLength),
          // Imagem em linha pode ficar alguns minutos no navegador de quem pediu; download e o resto, não.
          "Cache-Control": resultado.emLinha ? "private, max-age=300" : "private, no-store",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    case "grande":
      return recusa(413, "O arquivo passa do limite de download. Abra no Drive.");
    case "erro":
      return recusa(502, "Não foi possível falar com o Drive agora.");
    default:
      return recusa(404, "Não encontrado.");
  }
}
