import { dataLocal, meiaNoite, somarDias } from "./fuso";

/** A semana do ministério vai de segunda a domingo. `fim` é exclusivo (meia-noite da segunda seguinte). */
export function semanaDe(instante: Date): { inicio: Date; fim: Date } {
  const { ano, mes, dia, diaDaSemana } = dataLocal(instante);
  const diasDesdeSegunda = (diaDaSemana + 6) % 7;
  const inicio = somarDias(meiaNoite(ano, mes, dia), -diasDesdeSegunda);
  return { inicio, fim: somarDias(inicio, 7) };
}
