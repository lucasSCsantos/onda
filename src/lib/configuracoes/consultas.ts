import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JANELA_PADRAO } from "@/dominio/cartao-de-chamada";

/** O que o Admin configura sem mexer em código. */
export type Configuracoes = {
  retencaoDosLogsMeses: number;
  lideresVeemHistoricoDoEvento: boolean;
  /** Quantas aulas seguidas sem presença disparam o alerta de ausência. */
  faltasParaAlerta: number;
  /** A Marcação que desempata o ranking; nula, o empate divide a posição. */
  desempatePor: string | null;
  /** Quantos dias depois do dia da aula o cartão de Chamada continua à vista. */
  janelaDaChamadaDias: number;
  /** Quando os logs entraram no ar. */
  logsDesde: Date;
};

type ConfiguracoesDoBanco = {
  retencao_dos_logs_meses: number;
  lideres_veem_historico_do_evento: boolean;
  faltas_para_alerta: number;
  desempate_por: string | null;
  janela_da_chamada_dias: number;
  logs_desde: string;
};

/** Por quantos dias depois da aula o cartão de Chamada fica à vista; qualquer pessoa aprovada lê (o Professor não lê as configurações). */
export async function janelaDaChamada(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.rpc("janela_da_chamada_dias");
  return typeof data === "number" ? data : JANELA_PADRAO;
}

/** As configurações como quem está logado as lê (a Liderança); sem acesso, os valores padrão. */
export async function configuracoes(supabase: SupabaseClient): Promise<Configuracoes> {
  const { data } = await supabase
    .from("configuracoes")
    .select("retencao_dos_logs_meses, lideres_veem_historico_do_evento, faltas_para_alerta, desempate_por, janela_da_chamada_dias, logs_desde")
    .maybeSingle()
    .overrideTypes<ConfiguracoesDoBanco, { merge: false }>();
  return {
    retencaoDosLogsMeses: data?.retencao_dos_logs_meses ?? 12,
    lideresVeemHistoricoDoEvento: data?.lideres_veem_historico_do_evento ?? false,
    faltasParaAlerta: data?.faltas_para_alerta ?? 3,
    desempatePor: data?.desempate_por ?? null,
    janelaDaChamadaDias: data?.janela_da_chamada_dias ?? JANELA_PADRAO,
    logsDesde: data ? new Date(data.logs_desde) : new Date(),
  };
}
