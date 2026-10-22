/** Por quanto tempo os logs ficam guardados, em meses. O banco confere os mesmos limites. */
export const RETENCAO_MINIMA = 1;
export const RETENCAO_MAXIMA = 120;
export const RETENCAO_PADRAO = 12;

/** O que o formulário de configurações envia, tudo como texto (a caixa de marcar vem como "on" ou vazia). */
export type EntradaDeConfiguracoes = { retencao: string; lideresVeemHistorico: string };

export type ConfiguracoesLidas = { retencao_dos_logs_meses: number; lideres_veem_historico_do_evento: boolean };

/** As configurações prontas para gravar, ou o que impede. */
export function lerConfiguracoes(entrada: EntradaDeConfiguracoes): ConfiguracoesLidas | { erro: string } {
  const retencao = Number(entrada.retencao);
  if (!Number.isInteger(retencao) || retencao < RETENCAO_MINIMA || retencao > RETENCAO_MAXIMA) {
    return { erro: `Guarde os logs por ${RETENCAO_MINIMA} a ${RETENCAO_MAXIMA} meses.` };
  }
  return { retencao_dos_logs_meses: retencao, lideres_veem_historico_do_evento: entrada.lideresVeemHistorico === "on" };
}
