import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Escopo } from "@/dominio/assinatura-de-calendario";

export type AssinaturaDaPessoa = {
  escopo: Escopo;
  categorias: string[];
  aniversarios: boolean;
  criadoEm: Date;
  usadoEm: Date | null;
};

/** A Assinatura de calendário de uma pessoa, ou `null` se ela não tem. O hash do token nunca sai do banco. */
export async function assinaturaDa(supabase: SupabaseClient, pessoa: string): Promise<AssinaturaDaPessoa | null> {
  const { data } = await supabase
    .from("assinaturas_de_calendario")
    .select("escopo, categorias, aniversarios, criado_em, usado_em")
    .eq("pessoa_id", pessoa)
    .maybeSingle();
  if (!data) return null;
  return {
    escopo: data.escopo === "meus" ? "meus" : "todos",
    categorias: data.categorias ?? [],
    aniversarios: data.aniversarios,
    criadoEm: new Date(data.criado_em),
    usadoEm: data.usado_em ? new Date(data.usado_em) : null,
  };
}
