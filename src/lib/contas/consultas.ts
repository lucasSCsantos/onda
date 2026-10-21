import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Funções do catálogo, para os campos de escolha de convite e aprovação. */
export async function opcoesDeFuncao(supabase: SupabaseClient) {
  const { data } = await supabase.from("funcoes").select("id, nome, areas(nome)").order("nome");
  return (data ?? []).map((f) => {
    const area = (f.areas as unknown as { nome: string } | null)?.nome;
    return { valor: f.id as string, texto: area ? `${f.nome} (${area})` : (f.nome as string) };
  });
}
