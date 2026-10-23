import { JANELA_MAXIMA, JANELA_MINIMA } from "./cartao-de-chamada";
import { lerDesempate } from "./ranking";

/** Por quanto tempo os logs ficam guardados, em meses. O banco confere os mesmos limites. */
export const RETENCAO_MINIMA = 1;
export const RETENCAO_MAXIMA = 120;
export const RETENCAO_PADRAO = 12;

/** Quantas aulas seguidas sem presença disparam o alerta de ausência. O banco confere os mesmos limites. */
export const FALTAS_MINIMAS = 1;
export const FALTAS_MAXIMAS = 52;

/** O que o formulário de configurações envia, tudo como texto (a caixa de marcar vem como "on" ou vazia). */
export type EntradaDeConfiguracoes = {
  retencao: string;
  lideresVeemHistorico: string;
  faltasParaAlerta: string;
  /** Id da Marcação do desempate do ranking, ou vazio para nenhum. */
  desempate: string;
  /** Quantos dias depois do dia da aula o cartão de Chamada continua à vista. */
  janelaDaChamada: string;
};

export type ConfiguracoesLidas = {
  retencao_dos_logs_meses: number;
  lideres_veem_historico_do_evento: boolean;
  faltas_para_alerta: number;
  desempate_por: string | null;
  janela_da_chamada_dias: number;
};

/** As configurações prontas para gravar, ou o que impede. */
export function lerConfiguracoes(entrada: EntradaDeConfiguracoes): ConfiguracoesLidas | { erro: string } {
  const retencao = Number(entrada.retencao);
  if (!Number.isInteger(retencao) || retencao < RETENCAO_MINIMA || retencao > RETENCAO_MAXIMA) {
    return { erro: `Guarde os logs por ${RETENCAO_MINIMA} a ${RETENCAO_MAXIMA} meses.` };
  }
  const faltas = Number(entrada.faltasParaAlerta);
  if (!Number.isInteger(faltas) || faltas < FALTAS_MINIMAS || faltas > FALTAS_MAXIMAS) {
    return { erro: `O alerta de ausência vai de ${FALTAS_MINIMAS} a ${FALTAS_MAXIMAS} aulas seguidas.` };
  }
  const janela = Number(entrada.janelaDaChamada);
  if (entrada.janelaDaChamada.trim() === "" || !Number.isInteger(janela) || janela < JANELA_MINIMA || janela > JANELA_MAXIMA) {
    return { erro: `O cartão de Chamada fica à vista de ${JANELA_MINIMA} a ${JANELA_MAXIMA} dias depois da aula.` };
  }
  const desempate = lerDesempate(entrada.desempate);
  if (desempate !== null && typeof desempate === "object") return desempate;
  return {
    retencao_dos_logs_meses: retencao,
    lideres_veem_historico_do_evento: entrada.lideresVeemHistorico === "on",
    faltas_para_alerta: faltas,
    desempate_por: desempate,
    janela_da_chamada_dias: janela,
  };
}
