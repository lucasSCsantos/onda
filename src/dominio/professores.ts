import { podeGerenciarContas, podeMudarAcesso, type Pessoa } from "./acesso";

/** A Área cujas Funções cadastram Professores. */
export const AREA_DO_ENSINO = "Ensino";

/** Os papéis de uma aula de EBD: os campos pessoa da Categoria com esses nomes são o Professor e o Auxiliar. */
export const PAPEIS_DE_AULA = ["Professor", "Auxiliar"];

type Definicao = { id: string; nome: string; tipo: string };

/** O campo é o Professor ou o Auxiliar de uma aula? */
export const eCampoDeAula = (campo: { nome: string; tipo: string }) => campo.tipo === "pessoa" && PAPEIS_DE_AULA.includes(campo.nome);

/** Quem foi escolhido como Professor e Auxiliar de um Evento, sem repetir. */
export function professoresDaAula(campos: Record<string, unknown>, definicoes: readonly Definicao[]): string[] {
  const escolhidos = definicoes
    .filter(eCampoDeAula)
    .map((d) => campos[d.id])
    .filter((valor): valor is string => typeof valor === "string");
  return [...new Set(escolhidos)];
}

/** A aula tem a vaga de Professor e ela está vazia? Categorias sem a vaga não contam. */
export function semProfessor(campos: Record<string, unknown>, definicoes: readonly Definicao[]): boolean {
  const vaga = definicoes.find((d) => eCampoDeAula(d) && d.nome === "Professor");
  return vaga !== undefined && typeof campos[vaga.id] !== "string";
}

/** A tela de Professores fora do Admin: o caminho de quem tem Função em Ensino e não entra no Admin. */
export const CAMINHO_DOS_PROFESSORES = "/professores";
/** A mesma tela dentro do Admin, com a barra lateral e o item ativo. */
export const CAMINHO_DOS_PROFESSORES_NO_ADMIN = "/admin/professores";

/** Para onde leva o link de Professores de cada pessoa: o Admin fica dentro do Admin; os líderes de Ensino, fora dele. */
export const caminhoDosProfessores = (quem: Pessoa) => (podeGerenciarContas(quem) ? CAMINHO_DOS_PROFESSORES_NO_ADMIN : CAMINHO_DOS_PROFESSORES);

/** Admin e quem tem Função em Ensino cadastram Professores e geram o convite deles. `areas` são as Áreas das Funções de quem cadastra. */
export function podeCadastrarProfessor(quem: Pessoa, areas: readonly string[]): boolean {
  return quem.ativo && (quem.nivel === "admin" || (quem.nivel === "lider" && areas.includes(AREA_DO_ENSINO)));
}

/** Só o Admin inativa um Professor (e o reativa): é o `podeMudarAcesso` de uma conta de nível Professor. */
export function podeInativarProfessor(quem: Pessoa, alvo: Pessoa): boolean {
  return alvo.nivel === "professor" && podeMudarAcesso(quem, alvo);
}

type Aula = { campos: Record<string, unknown>; definicoes: readonly Definicao[] };

const daLideranca = (quem: Pessoa) => quem.ativo && (quem.nivel === "admin" || quem.nivel === "lider");

const eProfessorDaAula = (quem: Pessoa, { campos, definicoes }: Aula) =>
  quem.ativo && quem.nivel === "professor" && professoresDaAula(campos, definicoes).includes(quem.id);

/**
 * Quem vê um Evento: a Liderança vê todos; o Professor vê só as aulas em que foi colocado como Professor ou Auxiliar.
 * A política de leitura de `public.eventos` (`e_professor_da_aula`) segue a mesma regra.
 */
export function podeVerEvento(quem: Pessoa, aula: Aula): boolean {
  return daLideranca(quem) || eProfessorDaAula(quem, aula);
}

/** O Professor edita só as observações das aulas dele; não muda Status, data nem Responsável. A Liderança segue `podeEditarEvento`. */
export function podeEditarSoAsObservacoes(quem: Pessoa, aula: Aula): boolean {
  return eProfessorDaAula(quem, aula);
}
