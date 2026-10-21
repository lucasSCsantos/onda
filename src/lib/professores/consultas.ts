import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConviteDeProfessor = {
  id: string;
  codigo: string;
  criado_em: string;
  expira_em: string;
  usado_em: string | null;
  revogado_em: string | null;
  usado_por_perfil: { nome: string } | null;
};

export type ProfessorCadastrado = { id: string; nome: string; ativo: boolean };

/** Os convites de Professor mais recentes; as políticas de `convites` decidem quem os lê. */
export async function convitesDeProfessor(supabase: SupabaseClient): Promise<ConviteDeProfessor[]> {
  const { data } = await supabase
    .from("convites")
    .select("id, codigo, criado_em, expira_em, usado_em, revogado_em, usado_por_perfil:perfis!convites_usado_por_fkey(nome)")
    .eq("nivel", "professor")
    .order("criado_em", { ascending: false })
    .limit(30)
    .overrideTypes<ConviteDeProfessor[], { merge: false }>();
  return data ?? [];
}

/** Todos os Professores cadastrados, ativos e inativos, por nome. */
export async function professoresCadastrados(supabase: SupabaseClient): Promise<ProfessorCadastrado[]> {
  const { data } = await supabase
    .from("perfis")
    .select("id, nome, ativo")
    .eq("nivel", "professor")
    .order("nome")
    .overrideTypes<ProfessorCadastrado[], { merge: false }>();
  return data ?? [];
}
