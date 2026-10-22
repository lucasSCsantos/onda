import type { Pessoa } from "./acesso";
import { podeCriarEvento } from "./catalogo";
import { diaDe, type Status } from "./eventos";

// A Chamada das aulas (Categorias com chamada, como a EBD): as Marcações de cada Adolescente, o resumo da aula, o
// histórico de cada um e o alerta de ausência. O banco confere as mesmas regras (`pode_fazer_chamada`,
// `salvar_presenca`, em supabase/migrations/20261022010000_presenca.sql).

/** Os ícones que uma Marcação pode ter (nomes do lucide). O banco aceita a mesma lista. */
export const ICONES_DAS_MARCACOES = [
  "check",
  "book-open",
  "user-plus",
  "pencil",
  "star",
  "music",
  "heart",
  "smile",
  "award",
  "hand-heart",
  "sparkles",
  "flame",
] as const;
export type IconeDeMarcacao = (typeof ICONES_DAS_MARCACOES)[number];

export const NOMES_DOS_ICONES: Record<IconeDeMarcacao, string> = {
  check: "Visto",
  "book-open": "Bíblia",
  "user-plus": "Pessoa com +",
  pencil: "Lápis",
  star: "Estrela",
  music: "Música",
  heart: "Coração",
  smile: "Sorriso",
  award: "Medalha",
  "hand-heart": "Mão com coração",
  sparkles: "Brilho",
  flame: "Chama",
};

export type Marcacao = {
  id: string;
  nome: string;
  icone: IconeDeMarcacao;
  /** Pontos no ranking anual. */
  pontos: number;
  ativa: boolean;
  /** A Marcação que diz que o Adolescente veio; no máximo uma. */
  contaPresenca: boolean;
  /** Pede o nome do visitante (opcional). */
  pedeVisitante: boolean;
  ordem: number;
};

export const PONTOS_MAXIMOS = 100;

/** O que o formulário de Marcação envia, tudo como texto (caixas de marcar como "on" ou vazio). */
export type EntradaDeMarcacao = {
  nome: string;
  icone: string;
  pontos: string;
  ativa: string;
  contaPresenca: string;
  pedeVisitante: string;
};

export type MarcacaoLida = Omit<Marcacao, "id" | "ordem">;

/** A Marcação pronta para gravar, ou o que impede. */
export function lerMarcacao(entrada: EntradaDeMarcacao): MarcacaoLida | { erro: string } {
  const nome = entrada.nome.trim();
  if (!nome) return { erro: "Dê um nome à Marcação." };
  if (nome.length > 40) return { erro: "Use um nome de até 40 letras." };
  const icone = ICONES_DAS_MARCACOES.find((i) => i === entrada.icone);
  if (!icone) return { erro: "Escolha um ícone." };
  const pontos = Number(entrada.pontos);
  if (entrada.pontos.trim() === "" || !Number.isInteger(pontos) || pontos < 0 || pontos > PONTOS_MAXIMOS) {
    return { erro: `Os pontos vão de 0 a ${PONTOS_MAXIMOS}, sem vírgula.` };
  }
  return {
    nome,
    icone,
    pontos,
    ativa: entrada.ativa === "on",
    contaPresenca: entrada.contaPresenca === "on",
    pedeVisitante: entrada.pedeVisitante === "on",
  };
}

/**
 * As Marcações depois de um toque: liga ou desliga a tocada. Ligar qualquer uma liga também a de presença; desligar a
 * de presença desliga todas (quem não veio não trouxe bíblia). O banco aplica a mesma regra ao salvar.
 */
export function alternarMarcacao(atuais: readonly string[], tocada: string, marcacoes: readonly Marcacao[]): string[] {
  const presenca = marcacoes.find((m) => m.contaPresenca && m.ativa)?.id;
  if (atuais.includes(tocada)) {
    return tocada === presenca ? [] : atuais.filter((id) => id !== tocada);
  }
  const ligadas = [...atuais, tocada];
  if (presenca && !ligadas.includes(presenca)) ligadas.push(presenca);
  return ordenarMarcadas(ligadas, marcacoes);
}

/** Na ordem do cadastro, para comparar e mostrar. */
export const ordenarMarcadas = (ids: readonly string[], marcacoes: readonly Marcacao[]) =>
  marcacoes.filter((m) => ids.includes(m.id)).map((m) => m.id);

/** Esteve presente? Com a Marcação de presença; se nenhuma Marcação conta presença, qualquer uma conta. */
export function estevePresente(marcadas: readonly string[], marcacoes: readonly Marcacao[]): boolean {
  const presenca = marcacoes.find((m) => m.contaPresenca);
  return presenca ? marcadas.includes(presenca.id) : marcadas.length > 0;
}

/**
 * Quem faz a Chamada de uma aula: o Admin e quem tem Função na Área da Categoria, numa Categoria com chamada, numa aula
 * não Cancelada que já chegou ao dia (no fuso do Mural). A função `public.pode_fazer_chamada` segue a mesma regra.
 */
export function podeFazerChamada(
  quem: Pessoa,
  areas: readonly string[],
  aula: { categoria: { area: string; temChamada: boolean }; status: Status; inicio: Date },
  agora: Date,
): boolean {
  return (
    aula.categoria.temChamada &&
    podeCriarEvento(quem, areas, aula.categoria) &&
    aula.status !== "cancelado" &&
    diaDe(aula.inicio) <= diaDe(agora)
  );
}

/** A presença de um Adolescente numa aula, como a tela a usa. */
export type PresencaNaAula = { adolescente: string; marcacoes: string[]; visitante: string | null };

export type ResumoDaAula = {
  presentes: number;
  /** Quantos dos ativos não vieram (sem presença), para "12 de 20". */
  ativos: number;
  porMarcacao: { marcacao: Marcacao; quantos: number }[];
  /** Nomes de visitantes anotados. */
  visitantes: string[];
};

/** Presentes, quantos de cada Marcação e os visitantes anotados numa aula. */
export function resumoDaAula(presencas: readonly PresencaNaAula[], marcacoes: readonly Marcacao[], ativos: number): ResumoDaAula {
  return {
    presentes: presencas.filter((p) => estevePresente(p.marcacoes, marcacoes)).length,
    ativos,
    porMarcacao: marcacoes
      .map((marcacao) => ({ marcacao, quantos: presencas.filter((p) => p.marcacoes.includes(marcacao.id)).length }))
      .filter(({ marcacao, quantos }) => marcacao.ativa || quantos > 0),
    visitantes: presencas.map((p) => p.visitante).filter((v): v is string => Boolean(v)),
  };
}

/** Uma aula em que a Chamada foi feita (ao menos uma presença registrada). */
export type AulaComChamada = { id: string; titulo: string; inicio: Date };

/**
 * Quantas aulas seguidas, da mais recente para trás, o Adolescente faltou. Só contam as aulas com Chamada feita e
 * depois do cadastro dele. `presente` tem os ids das aulas em que ele esteve.
 */
export function faltasSeguidas(aulas: readonly AulaComChamada[], presente: ReadonlySet<string>, cadastradoEm: Date): number {
  let faltas = 0;
  for (const aula of [...aulas].sort((a, b) => b.inicio.getTime() - a.inicio.getTime())) {
    if (diaDe(aula.inicio) < diaDe(cadastradoEm)) break;
    if (presente.has(aula.id)) break;
    faltas += 1;
  }
  return faltas;
}

export type AlertaDeAusencia = { adolescente: { id: string; nome: string }; faltas: number; ultimaPresenca: Date | null };

/**
 * Quem está ativo e faltou a `limite` aulas seguidas ou mais, de quem falta há mais tempo para quem falta há menos.
 * `presencas` vai do id do Adolescente às aulas em que ele esteve presente.
 */
export function alertasDeAusencia(
  adolescentes: readonly { id: string; nome: string; ativo: boolean; criadoEm: Date }[],
  aulas: readonly AulaComChamada[],
  presencas: ReadonlyMap<string, ReadonlySet<string>>,
  limite: number,
): AlertaDeAusencia[] {
  return adolescentes
    .filter((a) => a.ativo)
    .map((a) => {
      const presente = presencas.get(a.id) ?? new Set<string>();
      const ultima = aulas.filter((aula) => presente.has(aula.id)).sort((x, y) => y.inicio.getTime() - x.inicio.getTime())[0];
      return { adolescente: { id: a.id, nome: a.nome }, faltas: faltasSeguidas(aulas, presente, a.criadoEm), ultimaPresenca: ultima?.inicio ?? null };
    })
    .filter((a) => a.faltas >= limite)
    .sort((x, y) => y.faltas - x.faltas || x.adolescente.nome.localeCompare(y.adolescente.nome, "pt-BR"));
}

/** O histórico de um Adolescente: cada aula com Chamada desde o cadastro, com as Marcações dele ou a falta. */
export function historicoDoAdolescente(
  aulas: readonly AulaComChamada[],
  presencas: ReadonlyMap<string, readonly string[]>,
  cadastradoEm: Date,
  marcacoes: readonly Marcacao[],
): { aula: AulaComChamada; marcacoes: Marcacao[]; presente: boolean }[] {
  return [...aulas]
    .filter((aula) => diaDe(aula.inicio) >= diaDe(cadastradoEm) || presencas.has(aula.id))
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
    .map((aula) => {
      const marcadas = presencas.get(aula.id) ?? [];
      return { aula, marcacoes: marcacoes.filter((m) => marcadas.includes(m.id)), presente: estevePresente(marcadas, marcacoes) };
    });
}
