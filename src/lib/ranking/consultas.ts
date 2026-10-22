import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PontosDaMarcacao } from "@/dominio/ranking";

type PontosDoBanco = { adolescente_id: string; nome: string; ativo: boolean; marcacao_id: string; quantas: number; pontos: number };

/** Os pontos de cada Adolescente no ano, Marcação por Marcação, calculados na hora (`pontos_do_ano`); só a Liderança lê. */
export async function pontosDoAno(supabase: SupabaseClient, ano: number): Promise<PontosDaMarcacao[]> {
  const { data } = await supabase.rpc("pontos_do_ano", { ano });
  return ((data ?? []) as PontosDoBanco[]).map((l) => ({
    adolescente: l.adolescente_id,
    nome: l.nome,
    ativo: l.ativo,
    marcacao: l.marcacao_id,
    quantas: l.quantas,
    pontos: l.pontos,
  }));
}

/** Os anos com alguma presença, do mais recente ao mais antigo. */
export async function anosComPresenca(supabase: SupabaseClient): Promise<number[]> {
  const { data } = await supabase.rpc("anos_com_presenca");
  return (data ?? []) as number[];
}
