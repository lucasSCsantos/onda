import { diaDe } from "./eventos";
import { meiaNoite } from "./fuso";

/** As visões do calendário. A lista é a padrão no celular. */
export const VISOES = ["lista", "mes", "semana"] as const;

export type Visao = (typeof VISOES)[number];

export type DiaDaGrade = {
  /** Data civil `AAAA-MM-DD` no fuso do Mural. */
  dia: string;
  /** Falso para os dias de outro mês que completam as semanas da visão mensal. */
  doPeriodo: boolean;
};

/** Um dia civil como data UTC ao meio-dia: só para contar dias, sem fuso no meio. */
const civil = (dia: string) => new Date(`${dia}T12:00:00Z`);
const texto = (data: Date) => data.toISOString().slice(0, 10);
const somar = (dia: string, dias: number) => texto(new Date(civil(dia).getTime() + dias * 24 * 60 * 60 * 1000));
const segundaDe = (dia: string) => somar(dia, -((civil(dia).getUTCDay() + 6) % 7));
const meiaNoiteDe = (dia: string) => {
  const [ano, mes, d] = dia.split("-").map(Number);
  return meiaNoite(ano, mes, d);
};

/**
 * Os dias que uma visão mostra a partir de um dia de referência, em semanas de segunda a domingo, e o
 * período que eles cobrem (`fim` exclusivo), no fuso do Mural. A lista usa o mês, sem completar as semanas.
 */
export function periodoDaVisao(visao: Visao, dia: string): { semanas: DiaDaGrade[][]; inicio: Date; fim: Date } {
  const mes = dia.slice(0, 7);
  const primeiro = visao === "semana" ? segundaDe(dia) : segundaDe(`${mes}-01`);
  const semanas: DiaDaGrade[][] = [];
  let atual = primeiro;
  do {
    const semana: DiaDaGrade[] = [];
    for (let i = 0; i < 7; i++, atual = somar(atual, 1)) {
      semana.push({ dia: atual, doPeriodo: visao === "semana" || atual.startsWith(mes) });
    }
    semanas.push(semana);
  } while (visao !== "semana" && atual.startsWith(mes));
  if (visao === "lista") {
    const doMes = semanas.flat().filter((d) => d.doPeriodo);
    return { semanas: [doMes], inicio: meiaNoiteDe(doMes[0].dia), fim: meiaNoiteDe(somar(doMes.at(-1)!.dia, 1)) };
  }
  return { semanas, inicio: meiaNoiteDe(primeiro), fim: meiaNoiteDe(atual) };
}

/** O dia de referência do período anterior (`-1`) ou do seguinte (`1`): o primeiro do mês ou a segunda-feira. */
export function navegar(visao: Visao, dia: string, passo: 1 | -1): string {
  if (visao === "semana") return somar(segundaDe(dia), 7 * passo);
  const data = civil(`${dia.slice(0, 7)}-01`);
  data.setUTCMonth(data.getUTCMonth() + passo);
  return texto(data);
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Se o texto é uma data civil `AAAA-MM-DD` que existe. */
export const diaValido = (dia: unknown): dia is string =>
  typeof dia === "string" && DIA.test(dia) && !Number.isNaN(civil(dia).getTime()) && texto(civil(dia)) === dia;

/**
 * A visão e o dia de referência pedidos na URL. Sem dia (ou com um que não existe), é hoje no fuso do Mural.
 * Sem visão, ela fica em aberto: a tela mostra a lista no celular e o mês em telas maiores.
 */
export function lerPosicao(
  parametros: { visao?: string | string[]; dia?: string | string[] },
  agora: Date,
): { visao: Visao | null; dia: string } {
  const visao = VISOES.find((v) => v === parametros.visao) ?? null;
  const { dia } = parametros;
  return { visao, dia: diaValido(dia) ? dia : diaDe(agora) };
}

/** O dia do Painel do dia aberto na URL (`abrir`), ou `null` com o painel fechado. Independe de `dia`, a âncora do mês. */
export const lerAbrir = (parametros: { abrir?: string | string[]; dia?: string | string[] }): string | null =>
  diaValido(parametros.abrir) ? parametros.abrir : null;

/**
 * Onde se cria um Evento já num dia (`data`), com ou sem a Categoria escolhida. A data é civil, no fuso do Mural,
 * e vale igual para Eventos de dia inteiro e com hora. Sem data, é a criação de sempre.
 */
export function enderecoDoNovoEvento(data: string | null, categoria?: string): string {
  const caminho = categoria ? `/eventos/novo/${categoria}` : "/eventos/novo";
  return data ? `${caminho}?${new URLSearchParams({ data })}` : caminho;
}

/** A data pré-preenchida da criação na URL (`data`), ou `null` se ela falta ou não existe. */
export const lerDataDoNovoEvento = (parametros: { data?: string | string[] }): string | null =>
  diaValido(parametros.data) ? parametros.data : null;

export type NoCalendario = { inicio: Date; fim: Date | null; diaInteiro: boolean };

/** O último dia que um Evento ocupa: o do fim, ou o anterior quando um Evento com hora acaba à meia-noite. */
export function ultimoDia(evento: NoCalendario): string {
  const primeiro = diaDe(evento.inicio);
  if (!evento.fim) return primeiro;
  const ultimo = diaDe(evento.diaInteiro ? evento.fim : new Date(evento.fim.getTime() - 1));
  return ultimo > primeiro ? ultimo : primeiro;
}

/**
 * Os Eventos de cada dia da grade, no fuso do Mural: os de dia inteiro no topo, depois por hora de início.
 * Um Evento de vários dias aparece em cada dia que cobre.
 */
export function eventosPorDia<E extends NoCalendario>(eventos: E[], dias: string[]): Record<string, E[]> {
  const ordenados = eventos
    .map((evento) => ({ evento, primeiro: diaDe(evento.inicio), ultimo: ultimoDia(evento) }))
    .sort((a, b) => Number(b.evento.diaInteiro) - Number(a.evento.diaInteiro) || a.evento.inicio.getTime() - b.evento.inicio.getTime());
  return Object.fromEntries(
    dias.map((dia) => [dia, ordenados.filter(({ primeiro, ultimo }) => primeiro <= dia && dia <= ultimo).map(({ evento }) => evento)]),
  );
}

/**
 * A lista de um período: só os dias que têm Evento, cada um com os seus, na mesma ordem e cobertura da grade.
 * `ocupado` mantém também dias sem Evento que têm outra coisa a mostrar, como aniversários.
 */
export function diasComEventos<E extends NoCalendario>(
  eventos: E[],
  dias: string[],
  ocupado: (dia: string) => boolean = () => false,
): { dia: string; eventos: E[] }[] {
  const porDia = eventosPorDia(eventos, dias);
  return dias.filter((dia) => porDia[dia].length > 0 || ocupado(dia)).map((dia) => ({ dia, eventos: porDia[dia] }));
}
