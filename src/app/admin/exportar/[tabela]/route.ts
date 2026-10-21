import { gerarCsv } from "@/dominio/csv";
import { nomeDoArquivo, tabelaExportada } from "@/dominio/exportacao";
import { podeGerenciarContas } from "@/dominio/acesso";
import { perfilAtual } from "@/lib/contas/perfil";
import { tabelaParaExportar } from "@/lib/exportacao/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/**
 * Baixa uma tabela em CSV. É POST porque grava o registro da exportação; o banco só deixa o Admin gravá-lo, e a
 * leitura só acontece depois do registro.
 */
export async function POST(_: Request, ctx: RouteContext<"/admin/exportar/[tabela]">) {
  const tabela = tabelaExportada((await ctx.params).tabela);
  if (!tabela) return new Response("Tabela desconhecida.", { status: 404 });

  const eu = await perfilAtual();
  if (!eu || !podeGerenciarContas(eu)) return new Response("Só o Admin exporta.", { status: 403 });

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.from("exportacoes").insert({ tabela });
  if (error) return new Response("Não foi possível registrar a exportação.", { status: 403 });

  const agora = new Date();
  try {
    const { cabecalho, linhas } = await tabelaParaExportar(supabase, tabela, agora);
    return new Response(gerarCsv(cabecalho, linhas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeDoArquivo(tabela, agora)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Não foi possível ler os dados para exportar.", { status: 500 });
  }
}
