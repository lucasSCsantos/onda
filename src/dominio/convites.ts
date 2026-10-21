import { somarDias } from "./fuso";

/** Validade padrão de um convite, em dias; o Admin pode escolher outra entre os limites abaixo. */
export const VALIDADE_PADRAO_DIAS = 7;
export const VALIDADE_MINIMA_DIAS = 1;
export const VALIDADE_MAXIMA_DIAS = 30;

export type SituacaoDoConvite = "valido" | "usado" | "vencido" | "revogado";

export type Convite = { expiraEm: Date; usadoEm: Date | null; revogadoEm: Date | null };

/**
 * Um convite é de uso único: depois de usado, revogado ou vencido, é recusado.
 * A mesma regra está em `public.situacao_do_convite` no banco.
 */
export function situacaoDoConvite(convite: Convite, agora: Date): SituacaoDoConvite {
  if (convite.usadoEm) return "usado";
  if (convite.revogadoEm) return "revogado";
  if (convite.expiraEm <= agora) return "vencido";
  return "valido";
}

export function vencimentoDoConvite(criadoEm: Date, dias: number = VALIDADE_PADRAO_DIAS): Date {
  if (!Number.isInteger(dias) || dias < VALIDADE_MINIMA_DIAS || dias > VALIDADE_MAXIMA_DIAS) {
    throw new RangeError(`A validade do convite vai de ${VALIDADE_MINIMA_DIAS} a ${VALIDADE_MAXIMA_DIAS} dias.`);
  }
  return somarDias(criadoEm, dias);
}
