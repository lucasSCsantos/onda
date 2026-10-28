import { dataDeNascimentoValida } from "./cadastro";
import { dataLocal } from "./fuso";
import { erroNoGenero, lerGenero, type Genero } from "./genero";

/** O que se preenche para cadastrar um Adolescente. */
export type DadosDoAdolescente = { nome: string; nascimento: string };

/** `genero` nulo é "não informado": registros antigos, de antes do Gênero existir. */
export type Adolescente = DadosDoAdolescente & { id: string; ativo: boolean; genero: Genero | null };

const DIA_MS = 24 * 60 * 60 * 1000;
const doisDigitos = (n: number) => String(n).padStart(2, "0");
const ehBissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
/** Um dia civil como instante UTC: só para contar dias, sem fuso no meio. */
const diaCivil = (ano: number, mes: number, dia: number) => Date.UTC(ano, mes - 1, dia);

/**
 * O que impede salvar um Adolescente; `null` se nada impede. O Gênero é obrigatório só em cadastro novo: ao editar
 * um registro antigo pode ficar em branco, mas, se vier, tem de ser válido.
 */
export function erroNoAdolescente(
  { nome, nascimento, genero }: DadosDoAdolescente & { genero?: unknown },
  agora: Date,
  novo = false,
): string | null {
  if (!nome.trim()) return "Informe o nome.";
  if (!dataDeNascimentoValida(nascimento, agora)) return "Informe uma data de nascimento válida, que não seja futura.";
  if (novo || (genero !== undefined && genero !== "")) return erroNoGenero(genero);
  return null;
}

/** O dia `AAAA-MM-DD` em que a pessoa comemora num ano: quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos. */
export function diaDoAniversario(nascimento: string, ano: number): string {
  const [, mes, dia] = nascimento.split("-").map(Number);
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(mes === 2 && dia === 29 && !ehBissexto(ano) ? 28 : dia)}`;
}

/**
 * Próximo aniversário a partir de hoje (no fuso do Mural; hoje conta): a data, quantos dias faltam e a idade que
 * a pessoa completa. Quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos, para não sumir da lista.
 */
export function proximoAniversario(nascimento: string, agora: Date): { data: string; dias: number; idade: number } {
  const [anoDeNascimento, mes] = nascimento.split("-").map(Number);
  const hoje = dataLocal(agora);
  const hojeCivil = diaCivil(hoje.ano, hoje.mes, hoje.dia);

  const noAno = (ano: number) => Number(diaDoAniversario(nascimento, ano).slice(8));
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

/** "sem" é "sem gênero informado"; `null`, sem filtro. */
export type FiltroDeGenero = Genero | "sem" | null;

export const lerFiltroDeGenero = (valor: unknown): FiltroDeGenero => (valor === "sem" ? "sem" : lerGenero(valor));

export type TotaisPorGenero = Record<Genero | "naoInformado", number>;

/** Quantos Adolescentes ativos há de cada Gênero (e sem informação). */
export function totaisPorGenero(todos: Adolescente[]): TotaisPorGenero {
  const totais: TotaisPorGenero = { masculino: 0, feminino: 0, naoInformado: 0 };
  for (const a of todos) if (a.ativo) totais[a.genero ?? "naoInformado"] += 1;
  return totais;
}

export type FiltroDeAdolescentes = { busca: string; ordem: "aniversario" | "nome"; comInativos: boolean; genero: FiltroDeGenero };

/**
 * A lista que a tela mostra: inativos só se pedidos, depois o Gênero e a busca, na ordem escolhida. Devolve também
 * quantos inativos há no cadastro e os totais por Gênero, que contam todos os ativos, qualquer que seja o filtro.
 */
export function listarAdolescentes(
  todos: Adolescente[],
  { busca, ordem, comInativos, genero }: FiltroDeAdolescentes,
  agora: Date,
): { adolescentes: Adolescente[]; inativos: number; totais: TotaisPorGenero } {
  const doGenero = (a: Adolescente) => genero === null || (genero === "sem" ? a.genero === null : a.genero === genero);
  const encontrados = buscarPorNome(
    todos.filter((a) => (a.ativo || comInativos) && doGenero(a)),
    busca,
  );
  return {
    adolescentes:
      ordem === "nome"
        ? [...encontrados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        : ordenarPorProximoAniversario(encontrados, agora),
    inativos: todos.filter((a) => !a.ativo).length,
    totais: totaisPorGenero(todos),
  };
}
