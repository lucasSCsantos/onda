import { podeGerenciarContas } from "@/dominio/acesso";
import { gerarCsv } from "@/dominio/csv";
import { lerFiltrosDosLogs, nomeDoArquivoDosLogs, tabelaDosLogs } from "@/dominio/logs";
import { perfilAtual } from "@/lib/contas/perfil";
import { todosOsLogs } from "@/lib/logs/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/**
 * Baixa em CSV os logs do filtro da tela, com os mesmos textos dela. Como as outras exportações, é POST e grava o
 * registro antes de ler: o banco só deixa o Admin gravá-lo.
 */
export async function POST(request: Request) {
  const eu = await perfilAtual();
  if (!eu || !podeGerenciarContas(eu)) return new Response("Só o Admin exporta.", { status: 403 });

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.from("exportacoes").insert({ tabela: "logs" });
  if (error) return new Response("Não foi possível registrar a exportação.", { status: 403 });

  const agora = new Date();
  const filtros = lerFiltrosDosLogs(Object.fromEntries(new URL(request.url).searchParams));
  try {
    const { cabecalho, linhas } = tabelaDosLogs(await todosOsLogs(supabase, filtros, agora));
    return new Response(gerarCsv(cabecalho, linhas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeDoArquivoDosLogs(agora)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Não foi possível ler os logs para exportar.", { status: 500 });
  }
}
