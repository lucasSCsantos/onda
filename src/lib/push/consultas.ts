import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DispositivoDaLista = {
  id: string;
  nome: string;
  /** Hash do endpoint: reconhece "este aparelho" sem revelar o endpoint. */
  hash: string;
  criadoEm: Date;
  usadoEm: Date | null;
};

/** Os dispositivos de uma pessoa, do mais novo ao mais velho. Endpoint e chaves não saem do banco para a interface. */
export async function dispositivosDa(supabase: SupabaseClient, pessoa: string): Promise<DispositivoDaLista[]> {
  const { data } = await supabase
    .from("inscricoes_de_push")
    .select("id, nome, endpoint_hash, criado_em, usado_em")
    .eq("pessoa_id", pessoa)
    .order("criado_em", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id,
    nome: d.nome,
    hash: d.endpoint_hash,
    criadoEm: new Date(d.criado_em),
    usadoEm: d.usado_em ? new Date(d.usado_em) : null,
  }));
}
