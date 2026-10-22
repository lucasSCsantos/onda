import { diaValido, ultimoDia, type NoCalendario } from "./calendario";
import { diaDe, STATUS, terminou, type Status } from "./eventos";
import { professoresDaAula } from "./professores";
import { semanaDe } from "./semana";

/** O que os filtros precisam saber de um Evento. `envolvidos` são os ids do Responsável, do Professor e do Auxiliar. */
export type EventoFiltravel = NoCalendario & {
  status: Status;
  categoriaId: string;
  area: string;
  envolvidos: string[];
  /** Nulo quando o Evento conta como sem Responsável (ver `semResponsavel`). */
  responsavel: string | null;
  /** A Categoria tem a vaga de Professor e ela está vazia. */
  semProfessor?: boolean;
};

/** Os filtros combináveis de Eventos; um filtro vazio não restringe nada. */
export type Filtros = {
  meus: boolean;
  /** Eventos que cobrem o dia de hoje. */
  hoje: boolean;
  semana: boolean;
  /** Esconde o que já terminou (só no Calendário; a Home já mostra só o que vem). */
  proximos: boolean;
  /** Os três a seguir são as regras dos `alertas`, aplicadas como filtro. */
  semResponsavel: boolean;
  semProfessor: boolean;
  atrasados: boolean;
  /** Um dia `AAAA-MM-DD`. */
  dia: string | null;
  categorias: string[];
  area: string | null;
  status: Status | null;
};

export const SEM_FILTROS: Filtros = {
  meus: false,
  hoje: false,
  semana: false,
  proximos: false,
  semResponsavel: false,
  semProfessor: false,
  atrasados: false,
  dia: null,
  categorias: [],
  area: null,
  status: null,
};

/** Os filtros que são só ligado ou desligado, com o parâmetro de URL de cada um. */
const ATALHOS = [
  ["meus", "meus"],
  ["hoje", "hoje"],
  ["semana", "semana"],
  ["proximos", "proximos"],
  ["semResponsavel", "sem-responsavel"],
  ["semProfessor", "sem-professor"],
  ["atrasados", "atrasados"],
] as const satisfies readonly (readonly [keyof Filtros, string])[];

/** Quem está envolvido num Evento: o Responsável e as pessoas escolhidas como Professor e Auxiliar. */
export function envolvidosDoEvento(
  responsavel: string | null,
  campos: Record<string, unknown>,
  definicoes: readonly { id: string; nome: string; tipo: string }[],
): string[] {
  return [...new Set([...(responsavel ? [responsavel] : []), ...professoresDaAula(campos, definicoes)])];
}

type Parametros = Record<string, string | string[] | undefined>;

const lista = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor : valor ? [valor] : []);

/** Os filtros pedidos na URL; o que não é reconhecido é ignorado. */
export function lerFiltros(parametros: Parametros): Filtros {
  const [dia, area, status] = [parametros.data, parametros.area, parametros.status].map((valor) => lista(valor)[0]);
  return {
    ...(Object.fromEntries(ATALHOS.map(([chave, parametro]) => [chave, lista(parametros[parametro])[0] === "1"])) as Pick<
      Filtros,
      (typeof ATALHOS)[number][0]
    >),
    dia: diaValido(dia) ? dia : null,
    categorias: lista(parametros.categoria),
    area: area || null,
    status: STATUS.find((s) => s === status) ?? null,
  };
}

export const haFiltros = (filtros: Filtros) =>
  ATALHOS.some(([chave]) => filtros[chave]) || filtros.dia !== null || filtros.categorias.length > 0 || filtros.area !== null || filtros.status !== null;

/** Primeiro e último dia (segunda e domingo) da semana de um instante. */
function diasDaSemana(agora: Date): { segunda: string; domingo: string } {
  const { inicio, fim } = semanaDe(agora);
  return { segunda: diaDe(inicio), domingo: diaDe(new Date(fim.getTime() - 1)) };
}

/**
 * Os Eventos que passam por todos os filtros ligados. `eu` é o id de quem olha. Um Evento de vários dias conta
 * em cada dia que cobre.
 */
export function filtrar<E extends EventoFiltravel>(eventos: E[], filtros: Filtros, { eu, agora }: { eu: string; agora: Date }): E[] {
  const { segunda, domingo } = diasDaSemana(agora);
  const hoje = diaDe(agora);
  return eventos.filter((e) => {
    const situacao = situacaoDoEvento(e, agora);
    return (
      (!filtros.meus || e.envolvidos.includes(eu)) &&
      (!filtros.hoje || (diaDe(e.inicio) <= hoje && hoje <= ultimoDia(e))) &&
      (!filtros.proximos || ultimoDia(e) >= hoje) &&
      (!filtros.semResponsavel || situacao.semResponsavel) &&
      (!filtros.semProfessor || situacao.semProfessor) &&
      (!filtros.atrasados || situacao.vencido) &&
      (!filtros.semana || (diaDe(e.inicio) <= domingo && segunda <= ultimoDia(e))) &&
      (filtros.dia === null || (diaDe(e.inicio) <= filtros.dia && filtros.dia <= ultimoDia(e))) &&
      (filtros.categorias.length === 0 || filtros.categorias.includes(e.categoriaId)) &&
      (filtros.area === null || e.area === filtros.area) &&
      (filtros.status === null || e.status === filtros.status)
    );
  });
}

export type Proximos<E> = { hoje: E[]; semana: E[]; depois: E[] };

/**
 * Os Eventos de hoje em diante em ordem cronológica, em três grupos: os que cobrem hoje, os que começam depois
 * de hoje até domingo, e os que começam depois da semana. O que já passou fica de fora.
 */
export function proximosEventos<E extends NoCalendario>(eventos: E[], agora: Date): Proximos<E> {
  const hoje = diaDe(agora);
  const { domingo } = diasDaSemana(agora);
  const grupos: Proximos<E> = { hoje: [], semana: [], depois: [] };
  const ordenados = [...eventos].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime() || Number(b.diaInteiro) - Number(a.diaInteiro),
  );
  for (const evento of ordenados) {
    if (ultimoDia(evento) < hoje) continue;
    const comeca = diaDe(evento.inicio);
    (comeca <= hoje ? grupos.hoje : comeca <= domingo ? grupos.semana : grupos.depois).push(evento);
  }
  return grupos;
}

/**
 * As situações que pedem ação, numa só fonte de verdade: os alertas da Home e os atalhos de filtro as usam.
 * Ver `alertas` para o que cada uma significa.
 */
function situacaoDoEvento(
  e: NoCalendario & { status: Status; responsavel: string | null; semProfessor?: boolean },
  agora: Date,
) {
  const parado = e.status === "rascunho" || e.status === "planejado";
  const venceu = terminou(e, agora);
  const ativo = (parado || e.status === "confirmado") && !venceu;
  return {
    rascunho: e.status === "rascunho",
    vencido: parado && venceu,
    semResponsavel: ativo && !e.responsavel,
    semProfessor: ativo && !!e.semProfessor,
  };
}

export type TipoDeAlerta = "sem-responsavel" | "aula-sem-professor" | "rascunho" | "vencido";

export const NOMES_DOS_ALERTAS: Record<TipoDeAlerta, string> = {
  "sem-responsavel": "Sem Responsável",
  "aula-sem-professor": "Aula sem Professor",
  rascunho: "Em Rascunho",
  vencido: "Planejado ou Rascunho que já passou da data",
};

/**
 * Os alertas da tela inicial, só os que têm Eventos. Sem Responsável vale para Rascunho, Planejado e Confirmado
 * que ainda não terminaram; Rascunho, para todos; vencido, para Planejado e Rascunho que já terminaram.
 * Aula sem Professor (`semProfessor` ligado) vale para os mesmos Status e também só antes do fim; não impede sair de Rascunho.
 * Adiado, Cancelado e Realizado não alertam. Um Evento pode estar em mais de um alerta.
 * `responsavel` é nulo quando o Evento conta como sem Responsável (ver `semResponsavel`).
 */
export function alertas<E extends NoCalendario & { status: Status; responsavel: string | null; semProfessor?: boolean }>(
  eventos: E[],
  agora: Date,
): { tipo: TipoDeAlerta; eventos: E[] }[] {
  const porTipo: Record<TipoDeAlerta, E[]> = { "sem-responsavel": [], "aula-sem-professor": [], rascunho: [], vencido: [] };
  for (const e of [...eventos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    const situacao = situacaoDoEvento(e, agora);
    if (situacao.rascunho) porTipo.rascunho.push(e);
    if (situacao.vencido) porTipo.vencido.push(e);
    if (situacao.semResponsavel) porTipo["sem-responsavel"].push(e);
    if (situacao.semProfessor) porTipo["aula-sem-professor"].push(e);
  }
  return (Object.keys(porTipo) as TipoDeAlerta[]).filter((tipo) => porTipo[tipo].length > 0).map((tipo) => ({ tipo, eventos: porTipo[tipo] }));
}

/** O que cada alerta da Home liga ao abrir a tela de Eventos: o mesmo conjunto de Eventos que o alerta lista. */
export const FILTRO_DO_ALERTA: Record<TipoDeAlerta, Partial<Filtros>> = {
  "sem-responsavel": { semResponsavel: true },
  "aula-sem-professor": { semProfessor: true },
  rascunho: { status: "rascunho" },
  vencido: { atrasados: true },
};

/** Todos os parâmetros de URL que são filtros; os demais (a visão e o dia do calendário) não são tocados ao filtrar. */
export const PARAMETROS_DE_FILTRO = [...ATALHOS.map(([, parametro]) => parametro), "data", "categoria", "area", "status"];

/** O caminho inverso de `lerFiltros`: os parâmetros de URL que os filtros ligados geram. */
export function parametrosDosFiltros(filtros: Filtros): [string, string][] {
  return [
    ...ATALHOS.filter(([chave]) => filtros[chave]).map(([, parametro]) => [parametro, "1"] as [string, string]),
    ...(filtros.dia ? [["data", filtros.dia] as [string, string]] : []),
    ...filtros.categorias.map((id) => ["categoria", id] as [string, string]),
    ...(filtros.area ? [["area", filtros.area] as [string, string]] : []),
    ...(filtros.status ? [["status", filtros.status] as [string, string]] : []),
  ];
}
