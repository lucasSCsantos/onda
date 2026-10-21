/** Fuso fixo do Mural, America/Bahia. Ele não tem horário de verão desde 2012: UTC-3 o ano todo. */
const DESLOCAMENTO_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Data civil (ano, mês 1-12, dia, dia da semana 0=domingo) de um instante, no fuso do Mural. */
export function dataLocal(instante: Date) {
  const local = new Date(instante.getTime() + DESLOCAMENTO_MS);
  return {
    ano: local.getUTCFullYear(),
    mes: local.getUTCMonth() + 1,
    dia: local.getUTCDate(),
    diaDaSemana: local.getUTCDay(),
  };
}

/** Instante da meia-noite de uma data civil no fuso do Mural. */
export function meiaNoite(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia) - DESLOCAMENTO_MS);
}

export function somarDias(instante: Date, dias: number): Date {
  return new Date(instante.getTime() + dias * DIA_MS);
}
