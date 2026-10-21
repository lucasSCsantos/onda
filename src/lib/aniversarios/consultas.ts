import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pessoasDoAniversario, podeVerAniversarios, type Aniversariavel } from "@/dominio/aniversarios";
import type { Pessoa } from "@/dominio/acesso";

/**
 * Quem faz anos para `quem` ver: Adolescentes e líderes ativos. Quem não é da Liderança não recebe ninguém,
 * e nem consulta o banco, que também não deixaria (ADR 0003: nada é gravado, tudo sai da data de nascimento).
 */
export async function aniversariaveis(supabase: SupabaseClient, quem: Pessoa): Promise<Aniversariavel[]> {
  if (!podeVerAniversarios(quem)) return [];
  const [adolescentes, lideres] = await Promise.all([
    supabase.from("adolescentes").select("nome, nascimento, ativo").eq("ativo", true),
    supabase.from("perfis").select("nome, data_nascimento, ativo").in("nivel", ["admin", "lider"]).eq("ativo", true),
  ]);
  return pessoasDoAniversario(
    (adolescentes.data ?? []).map((a) => ({ nome: a.nome, nascimento: a.nascimento, ativo: a.ativo })),
    (lideres.data ?? []).map((l) => ({ nome: l.nome, nascimento: l.data_nascimento, ativo: l.ativo })),
  );
}
