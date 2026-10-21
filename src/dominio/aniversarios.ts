import type { Pessoa } from "./acesso";
import { diaDoAniversario } from "./adolescentes";
import { podeVerTodosOsEventos } from "./eventos";

/** Quem faz anos: o nome e a data de nascimento `AAAA-MM-DD`. */
export type Aniversariavel = { nome: string; nascimento: string };

/** O que o calendário mostra de um aniversário: só o nome e o dia da comemoração, sem ano de nascimento nem idade. */
export type Aniversario = { nome: string; dia: string };

const porDiaENome = (a: Aniversario, b: Aniversario) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Os aniversários de cada dia da grade. Nunca são Eventos: saem da data de nascimento, no ano de cada dia.
 * Quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos.
 */
export function aniversariosPorDia(pessoas: Aniversariavel[], dias: string[]): Record<string, Aniversario[]> {
  const anos = [...new Set(dias.map((dia) => Number(dia.slice(0, 4))))];
  const festas = pessoas.flatMap(({ nome, nascimento }) => anos.map((ano) => ({ nome, dia: diaDoAniversario(nascimento, ano) })));
  return Object.fromEntries(dias.map((dia) => [dia, festas.filter((festa) => festa.dia === dia).sort(porDiaENome)]));
}

/** Os aniversariantes do mês de um dia de referência (`AAAA-MM-DD`), por dia e depois por nome. */
export function aniversariantesDoMes(pessoas: Aniversariavel[], dia: string): Aniversario[] {
  const ano = Number(dia.slice(0, 4));
  return pessoas
    .map(({ nome, nascimento }) => ({ nome, dia: diaDoAniversario(nascimento, ano) }))
    .filter((festa) => festa.dia.slice(0, 7) === dia.slice(0, 7))
    .sort(porDiaENome);
}

/** Quem entra nos aniversários: Adolescentes e líderes ativos, e só quem tem data de nascimento. */
export function pessoasDoAniversario(
  adolescentes: { nome: string; nascimento: string; ativo: boolean }[],
  lideres: { nome: string; nascimento: string | null; ativo: boolean }[],
): Aniversariavel[] {
  const pessoas: Aniversariavel[] = [];
  for (const { nome, nascimento, ativo } of [...adolescentes, ...lideres]) {
    if (ativo && nascimento) pessoas.push({ nome, nascimento });
  }
  return pessoas;
}

/** Só a Liderança ativa vê aniversários: Professor, Pendente e desativado não veem nenhum. */
export const podeVerAniversarios = (quem: Pessoa): boolean => podeVerTodosOsEventos(quem);

/** Os aniversários que `quem` pode ver: todos, ou nenhum. */
export function aniversariosVisiveis<T>(quem: Pessoa, aniversarios: T[]): T[] {
  return podeVerAniversarios(quem) ? aniversarios : [];
}
