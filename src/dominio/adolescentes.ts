import { dataDeNascimentoValida } from "./cadastro";
import { dataLocal } from "./fuso";

/** O que se preenche para cadastrar um Adolescente. */
export type DadosDoAdolescente = { nome: string; nascimento: string };

export type Adolescente = DadosDoAdolescente & { id: string; ativo: boolean };

const DIA_MS = 24 * 60 * 60 * 1000;
const doisDigitos = (n: number) => String(n).padStart(2, "0");
const ehBissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
/** Um dia civil como instante UTC: só para contar dias, sem fuso no meio. */
const diaCivil = (ano: number, mes: number, dia: number) => Date.UTC(ano, mes - 1, dia);

/** O que impede salvar um Adolescente; `null` se nada impede. */
export function erroNoAdolescente({ nome, nascimento }: DadosDoAdolescente, agora: Date): string | null {
  if (!nome.trim()) return "Informe o nome.";
  if (!dataDeNascimentoValida(nascimento, agora)) return "Informe uma data de nascimento válida, que não seja futura.";
  return null;
}

/**
 * Próximo aniversário a partir de hoje (no fuso do Mural; hoje conta): a data, quantos dias faltam e a idade que
 * a pessoa completa. Quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos, para não sumir da lista.
 */
export function proximoAniversario(nascimento: string, agora: Date): { data: string; dias: number; idade: number } {
  const [anoDeNascimento, mes, dia] = nascimento.split("-").map(Number);
  const hoje = dataLocal(agora);
  const hojeCivil = diaCivil(hoje.ano, hoje.mes, hoje.dia);

  const noAno = (ano: number) => (mes === 2 && dia === 29 && !ehBissexto(ano) ? 28 : dia);
  let ano = hoje.ano;
  if (diaCivil(ano, mes, noAno(ano)) < hojeCivil) ano += 1;

  const diaDaFesta = noAno(ano);
  return {
    data: `${ano}-${doisDigitos(mes)}-${doisDigitos(diaDaFesta)}`,
    dias: Math.round((diaCivil(ano, mes, diaDaFesta) - hojeCivil) / DIA_MS),
    idade: ano - anoDeNascimento,
  };
}

/** Do aniversário mais próximo ao mais distante; empate pela ordem alfabética. Devolve uma lista nova. */
export function ordenarPorProximoAniversario<T extends DadosDoAdolescente>(lista: T[], agora: Date): T[] {
  return lista
    .map((item) => ({ item, dias: proximoAniversario(item.nascimento, agora).dias }))
    .sort((a, b) => a.dias - b.dias || a.item.nome.localeCompare(b.item.nome, "pt-BR"))
    .map(({ item }) => item);
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** Filtra pelo nome, sem diferenciar maiúsculas nem acentos; sem texto, devolve todos. */
export function buscarPorNome<T extends { nome: string }>(lista: T[], busca: string): T[] {
  const procurado = semAcento(busca.trim());
  return procurado ? lista.filter((item) => semAcento(item.nome).includes(procurado)) : lista;
}

/** "hoje", "amanhã" ou "em N dias". */
export function prazoDoAniversario(dias: number): string {
  if (dias === 0) return "hoje";
  return dias === 1 ? "amanhã" : `em ${dias} dias`;
}

export type FiltroDeAdolescentes = { busca: string; ordem: "aniversario" | "nome"; comInativos: boolean };

/**
 * A lista que a tela mostra: inativos só se pedidos, depois a busca, na ordem escolhida. Devolve também quantos
 * inativos há no cadastro.
 */
export function listarAdolescentes(
  todos: Adolescente[],
  { busca, ordem, comInativos }: FiltroDeAdolescentes,
  agora: Date,
): { adolescentes: Adolescente[]; inativos: number } {
  const encontrados = buscarPorNome(
    todos.filter((a) => a.ativo || comInativos),
    busca,
  );
  return {
    adolescentes:
      ordem === "nome"
        ? [...encontrados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        : ordenarPorProximoAniversario(encontrados, agora),
    inativos: todos.filter((a) => !a.ativo).length,
  };
}
