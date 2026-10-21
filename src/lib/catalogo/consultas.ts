import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opcao } from "@/components/formulario";
import { NOMES_DOS_TIPOS, TIPOS_DE_CAMPO } from "@/dominio/catalogo";

/** Os dez tipos de campo, para o campo de escolha. */
export const OPCOES_DE_TIPO: Opcao[] = TIPOS_DE_CAMPO.map((tipo) => ({ valor: tipo, texto: NOMES_DOS_TIPOS[tipo] }));

/** Áreas do catálogo, para os campos de escolha de Função e Categoria. */
export async function opcoesDeArea(supabase: SupabaseClient): Promise<Opcao[]> {
  const { data } = await supabase.from("areas").select("id, nome").order("nome");
  return (data ?? []).map((a) => ({ valor: a.id as string, texto: a.nome as string }));
}
