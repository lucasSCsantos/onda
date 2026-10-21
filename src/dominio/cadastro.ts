import { dataLocal } from "./fuso";

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Data de nascimento no formato do campo de data (aaaa-mm-dd), existente e não futura no fuso do Mural. */
export function dataDeNascimentoValida(valor: string, agora: Date): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return false;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const civil = new Date(Date.UTC(ano, mes - 1, dia));
  const existe = civil.getUTCFullYear() === ano && civil.getUTCMonth() === mes - 1 && civil.getUTCDate() === dia;

  const hoje = dataLocal(agora);
  return existe && valor <= `${hoje.ano}-${doisDigitos(hoje.mes)}-${doisDigitos(hoje.dia)}`;
}
