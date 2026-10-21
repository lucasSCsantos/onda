import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opcao } from "@/components/formulario";
import { NIVEIS_CONCEDIVEIS, NOMES_DOS_NIVEIS } from "@/dominio/acesso";

/** Níveis que um convite ou uma aprovação concedem, para os campos de escolha. */
export const OPCOES_DE_NIVEL: Opcao[] = NIVEIS_CONCEDIVEIS.map((nivel) => ({ valor: nivel, texto: NOMES_DOS_NIVEIS[nivel] }));

/** Funções do catálogo, para os campos de escolha de convite e aprovação. */
export async function opcoesDeFuncao(supabase: SupabaseClient): Promise<Opcao[]> {
  const { data } = await supabase.from("funcoes").select("id, nome, areas(nome)").order("nome");
  return (data ?? []).map((f) => {
    const area = (f.areas as unknown as { nome: string } | null)?.nome;
    return { valor: f.id as string, texto: area ? `${f.nome} (${area})` : (f.nome as string) };
  });
}
