import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** O que o Admin configura sem mexer em código. */
export type Configuracoes = {
  retencaoDosLogsMeses: number;
  lideresVeemHistoricoDoEvento: boolean;
  /** Quantas aulas seguidas sem presença disparam o alerta de ausência. */
  faltasParaAlerta: number;
  /** Quando os logs entraram no ar. */
  logsDesde: Date;
};

type ConfiguracoesDoBanco = {
  retencao_dos_logs_meses: number;
  lideres_veem_historico_do_evento: boolean;
  faltas_para_alerta: number;
  logs_desde: string;
};

/** As configurações como quem está logado as lê (a Liderança); sem acesso, os valores padrão. */
export async function configuracoes(supabase: SupabaseClient): Promise<Configuracoes> {
  const { data } = await supabase
    .from("configuracoes")
    .select("retencao_dos_logs_meses, lideres_veem_historico_do_evento, faltas_para_alerta, logs_desde")
    .maybeSingle()
    .overrideTypes<ConfiguracoesDoBanco, { merge: false }>();
  return {
    retencaoDosLogsMeses: data?.retencao_dos_logs_meses ?? 12,
    lideresVeemHistoricoDoEvento: data?.lideres_veem_historico_do_evento ?? false,
    faltasParaAlerta: data?.faltas_para_alerta ?? 3,
    logsDesde: data ? new Date(data.logs_desde) : new Date(),
  };
}
