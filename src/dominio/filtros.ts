import { diaValido, ultimoDia } from "./calendario";
import { diaDe, STATUS, terminou, type Status } from "./eventos";
import { semanaDe } from "./semana";

type NoCalendario = { inicio: Date; fim: Date | null; diaInteiro: boolean };

/** O que os filtros precisam saber de um Evento. `envolvidos` são os ids do Responsável, do Professor e do Auxiliar. */
export type EventoFiltravel = NoCalendario & {
  status: Status;
  categoriaId: string;
  area: string;
  envolvidos: string[];
};

/** Os filtros combináveis de Eventos; um filtro vazio não restringe nada. */
export type Filtros = {
  meus: boolean;
  semana: boolean;
  /** Um dia `AAAA-MM-DD`. */
  dia: string | null;
  categorias: string[];
  area: string | null;
  status: Status | null;
};

export const SEM_FILTROS: Filtros = { meus: false, semana: false, dia: null, categorias: [], area: null, status: null };

/** Os papéis de uma aula de EBD: os campos pessoa da Categoria com esses nomes contam como envolvidos no Evento. */
const PAPEIS_DE_AULA = ["Professor", "Auxiliar"];

/** Quem está envolvido num Evento: o Responsável e as pessoas escolhidas como Professor e Auxiliar. */
export function envolvidosDoEvento(
  responsavel: string | null,
  campos: Record<string, unknown>,
  definicoes: readonly { id: string; nome: string; tipo: string }[],
): string[] {
  const aula = definicoes
    .filter((d) => d.tipo === "pessoa" && PAPEIS_DE_AULA.includes(d.nome))
    .map((d) => campos[d.id])
    .filter((valor): valor is string => typeof valor === "string");
  return [...new Set([...(responsavel ? [responsavel] : []), ...aula])];
}

type Parametros = Record<string, string | string[] | undefined>;

const lista = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor : valor ? [valor] : []);

/** Os filtros pedidos na URL; o que não é reconhecido é ignorado. */
export function lerFiltros(parametros: Parametros): Filtros {
  const [dia, area, status] = [parametros.data, parametros.area, parametros.status].map((valor) => lista(valor)[0]);
  return {
    meus: lista(parametros.meus)[0] === "1",
    semana: lista(parametros.semana)[0] === "1",
    dia: diaValido(dia) ? dia : null,
    categorias: lista(parametros.categoria),
    area: area || null,
    status: STATUS.find((s) => s === status) ?? null,
  };
}

export const haFiltros = (filtros: Filtros) =>
  filtros.meus || filtros.semana || filtros.dia !== null || filtros.categorias.length > 0 || filtros.area !== null || filtros.status !== null;

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
  return eventos.filter(
    (e) =>
      (!filtros.meus || e.envolvidos.includes(eu)) &&
      (!filtros.semana || (diaDe(e.inicio) <= domingo && segunda <= ultimoDia(e))) &&
      (filtros.dia === null || (diaDe(e.inicio) <= filtros.dia && filtros.dia <= ultimoDia(e))) &&
      (filtros.categorias.length === 0 || filtros.categorias.includes(e.categoriaId)) &&
      (filtros.area === null || e.area === filtros.area) &&
      (filtros.status === null || e.status === filtros.status),
  );
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

export type TipoDeAlerta = "sem-responsavel" | "rascunho" | "vencido";

export const NOMES_DOS_ALERTAS: Record<TipoDeAlerta, string> = {
  "sem-responsavel": "Sem Responsável",
  rascunho: "Em Rascunho",
  vencido: "Planejado ou Rascunho que já passou da data",
};

/**
 * Os alertas da tela inicial, só os que têm Eventos. Sem Responsável vale para Rascunho, Planejado e Confirmado
 * que ainda não terminaram; Rascunho, para todos; vencido, para Planejado e Rascunho que já terminaram.
 * Adiado, Cancelado e Realizado não alertam. Um Evento pode estar em mais de um alerta.
 * `responsavel` é nulo quando o Evento conta como sem Responsável (ver `semResponsavel`).
 */
export function alertas<E extends NoCalendario & { status: Status; responsavel: string | null }>(
  eventos: E[],
  agora: Date,
): { tipo: TipoDeAlerta; eventos: E[] }[] {
  const porTipo: Record<TipoDeAlerta, E[]> = { "sem-responsavel": [], rascunho: [], vencido: [] };
  for (const e of [...eventos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    const parado = e.status === "rascunho" || e.status === "planejado";
    const venceu = terminou(e, agora);
    if (e.status === "rascunho") porTipo.rascunho.push(e);
    if (parado && venceu) porTipo.vencido.push(e);
    if ((parado || e.status === "confirmado") && !venceu && !e.responsavel) porTipo["sem-responsavel"].push(e);
  }
  return (Object.keys(porTipo) as TipoDeAlerta[]).filter((tipo) => porTipo[tipo].length > 0).map((tipo) => ({ tipo, eventos: porTipo[tipo] }));
}

/** O caminho inverso de `lerFiltros`: os parâmetros de URL que os filtros ligados geram. */
export function parametrosDosFiltros(filtros: Filtros): [string, string][] {
  return [
    ...(filtros.meus ? [["meus", "1"] as [string, string]] : []),
    ...(filtros.semana ? [["semana", "1"] as [string, string]] : []),
    ...(filtros.dia ? [["data", filtros.dia] as [string, string]] : []),
    ...filtros.categorias.map((id) => ["categoria", id] as [string, string]),
    ...(filtros.area ? [["area", filtros.area] as [string, string]] : []),
    ...(filtros.status ? [["status", filtros.status] as [string, string]] : []),
  ];
}
