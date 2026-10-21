import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  tabelaDeAdolescentes,
  tabelaDeEventos,
  tabelaDeUsuarios,
  type TabelaCsv,
  type TabelaExportada,
} from "@/dominio/exportacao";

// O PostgREST devolve no máximo 1000 linhas por pedido.
const PAGINA = 1000;

/** Todas as linhas de uma consulta paginada; `pagina(de, ate)` precisa ordenar de forma estável. */
async function todas<L>(pagina: (de: number, ate: number) => PromiseLike<{ data: L[] | null; error: unknown }>): Promise<L[]> {
  const linhas: L[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error || !data) throw new Error("Não foi possível ler os dados para exportar.");
    linhas.push(...data);
    if (data.length < PAGINA) return linhas;
  }
}

/** Lê a tabela inteira, como quem está logado a enxerga, no formato do CSV. */
export async function tabelaParaExportar(supabase: SupabaseClient, tabela: TabelaExportada, agora: Date): Promise<TabelaCsv> {
  switch (tabela) {
    case "eventos":
      return tabelaDeEventos(
        await todas((de, ate) =>
          supabase
            .from("eventos")
            .select(
              "titulo, inicio, fim, dia_inteiro, local, status, observacoes, link, serie_id, criado_em, categorias(nome), responsavel:perfis!eventos_responsavel_id_fkey(nome)",
            )
            .order("inicio")
            .order("id")
            .range(de, ate)
            .overrideTypes<Parameters<typeof tabelaDeEventos>[0], { merge: false }>(),
        ),
        agora,
      );
    case "adolescentes":
      return tabelaDeAdolescentes(
        await todas((de, ate) =>
          supabase
            .from("adolescentes")
            .select("nome, nascimento, ativo, criado_em")
            .order("nome")
            .order("id")
            .range(de, ate)
            .overrideTypes<Parameters<typeof tabelaDeAdolescentes>[0], { merge: false }>(),
        ),
      );
    case "usuarios":
      return tabelaDeUsuarios(
        await todas((de, ate) =>
          supabase
            .from("perfis")
            .select("nome, email, data_nascimento, nivel, ativo, criado_em, funcoes_das_pessoas(funcoes(nome))")
            .order("nome")
            .order("id")
            .range(de, ate)
            .overrideTypes<Parameters<typeof tabelaDeUsuarios>[0], { merge: false }>(),
        ),
      );
  }
}
