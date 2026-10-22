import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** O que o Admin configura sem mexer em código. */
export type Configuracoes = {
  retencaoDosLogsMeses: number;
  lideresVeemHistoricoDoEvento: boolean;
  /** Quando os logs entraram no ar. */
  logsDesde: Date;
};

type ConfiguracoesDoBanco = {
  retencao_dos_logs_meses: number;
  lideres_veem_historico_do_evento: boolean;
  logs_desde: string;
};

/** As configurações como quem está logado as lê (a Liderança); sem acesso, os valores padrão. */
export async function configuracoes(supabase: SupabaseClient): Promise<Configuracoes> {
  const { data } = await supabase
    .from("configuracoes")
    .select("retencao_dos_logs_meses, lideres_veem_historico_do_evento, logs_desde")
    .maybeSingle()
    .overrideTypes<ConfiguracoesDoBanco, { merge: false }>();
  return {
    retencaoDosLogsMeses: data?.retencao_dos_logs_meses ?? 12,
    lideresVeemHistoricoDoEvento: data?.lideres_veem_historico_do_evento ?? false,
    logsDesde: data ? new Date(data.logs_desde) : new Date(),
  };
}
