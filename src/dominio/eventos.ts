import type { Pessoa } from "./acesso";
import type { ItemDoChecklist } from "./checklist";
import { podeCriarEvento, type CampoCadastrado, type CampoDaCategoria } from "./catalogo";
import { dataLocal, horaLocal, meiaNoite, somarDias } from "./fuso";

/** Os estágios de um Evento. As transições são livres, menos o Realizado manual (podeMarcarRealizado). */
export const STATUS = ["rascunho", "planejado", "confirmado", "realizado", "cancelado", "adiado"] as const;

export type Status = (typeof STATUS)[number];

export const NOMES_DOS_STATUS: Record<Status, string> = {
  rascunho: "Rascunho",
  planejado: "Planejado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  adiado: "Adiado",
};

/** Com que Status um Evento pode nascer. Realizado só vem depois do fim, numa edição. */
export const STATUS_INICIAIS = ["rascunho", "planejado", "confirmado", "cancelado", "adiado"] as const satisfies Status[];

const daLideranca = (quem: Pessoa) => quem.ativo && (quem.nivel === "admin" || quem.nivel === "lider");
const eAdmin = (quem: Pessoa) => quem.ativo && quem.nivel === "admin";

/** O que o formulário de Evento envia, tudo como texto. `campos` vai do id do campo específico ao texto digitado. */
export type EntradaDeEvento = {
  titulo: string;
  data: string;
  hora: string;
  dataFim: string;
  horaFim: string;
  local: string;
  responsavel: string;
  status: string;
  observacoes: string;
  link: string;
  campos: Record<string, string>;
};

export type Evento = {
  titulo: string;
  /** Sem hora, o Evento é de dia inteiro: `inicio` é a meia-noite do dia, e `fim`, a do último dia. */
  inicio: Date;
  fim: Date | null;
  diaInteiro: boolean;
  local: string;
  responsavel: string | null;
  status: Status;
  observacoes: string;
  link: string | null;
  /** Do id do campo específico ao valor; os opcionais vazios ficam de fora. */
  campos: Record<string, ValorDeCampo>;
};

/**
 * Como cada tipo de campo é guardado: textos, links, escolhas e pessoas (o id) como texto; o valor em reais
 * em centavos; a data como `AAAA-MM-DD` e a data e hora como `AAAA-MM-DDTHH:MM`, no fuso do Mural; a lista
 * como lista de textos; o checklist como lista de tarefas (`checklist.ts`).
 */
export type ValorDeCampo = string | number | string[] | ItemDoChecklist[];

export type CategoriaDoEvento = { nome: string; campos: CampoCadastrado[] };

/** Os campos específicos do formulário: todos, menos o checklist, que quem edita o Evento mexe na página dele (`checklist.ts`). */
export function camposDaCriacao(categoria: CategoriaDoEvento): CampoCadastrado[] {
  return categoria.campos.filter((campo) => campo.tipo !== "checklist");
}

/** Os campos checklist da Categoria. */
export const camposChecklist = (categoria: CategoriaDoEvento): CampoCadastrado[] =>
  categoria.campos.filter((campo) => campo.tipo === "checklist");

/**
 * Confere e converte o que veio do formulário num Evento pronto para gravar, ou diz o que impede.
 * `lideranca` são os ids de quem pode ser Responsável.
 */
export function lerEvento(
  entrada: EntradaDeEvento,
  categoria: CategoriaDoEvento,
  lideranca: readonly string[],
): { evento: Evento } | { erro: string } {
  return lerFormulario(entrada, categoria, lideranca, STATUS_INICIAIS, null);
}

/** O que a edição precisa saber: o Evento como está gravado, quem edita e quando. */
export type ContextoDaEdicao = { anterior: Evento; quem: Pessoa; agora: Date };

/**
 * Confere e converte a edição de um Evento, como `lerEvento`, com o que muda numa edição: qualquer Status, com o
 * Realizado manual só para quem pode marcá-lo, e nunca antes do fim; o Responsável e as pessoas dos campos já gravados podem ficar mesmo
 * se foram desativados; o checklist fica como estava (só muda na página do Evento); e remarcar um Adiado (mudar início ou fim) o volta a Planejado.
 * Quem pode editar é `podeEditarEvento`.
 */
export function lerEdicao(
  entrada: EntradaDeEvento,
  categoria: CategoriaDoEvento,
  lideranca: readonly string[],
  { anterior, quem, agora }: ContextoDaEdicao,
): { evento: Evento } | { erro: string } {
  const lido = lerFormulario(entrada, categoria, lideranca, STATUS, anterior);
  if ("erro" in lido) return lido;
  const evento = lido.evento;

  // Um Confirmado que terminou já é Realizado, mesmo que a transição automática ainda não tenha sido gravada.
  const jaRealizado = statusNoMomento(anterior, agora) === "realizado";
  if (
    evento.status === "realizado" &&
    !jaRealizado &&
    !podeMarcarRealizado(quem, { ...evento, responsavel: anterior.responsavel }, agora)
  ) {
    return { erro: "Só o Admin e o Responsável marcam Realizado, e só depois do fim." };
  }
  if (evento.status === "realizado" && !terminou(evento, agora)) return { erro: "Um Evento só fica Realizado depois do fim." };

  const remarcado =
    evento.inicio.getTime() !== anterior.inicio.getTime() ||
    (evento.fim?.getTime() ?? null) !== (anterior.fim?.getTime() ?? null) ||
    evento.diaInteiro !== anterior.diaInteiro;
  if (anterior.status === "adiado" && evento.status === "adiado" && remarcado) evento.status = "planejado";

  for (const c of categoria.campos) {
    if (c.tipo === "checklist" && anterior.campos[c.id] !== undefined) evento.campos[c.id] = anterior.campos[c.id];
  }
  return { evento };
}

/** `anterior` é o Evento já gravado, numa edição; `null` na criação. */
function lerFormulario(
  entrada: EntradaDeEvento,
  categoria: CategoriaDoEvento,
  lideranca: readonly string[],
  statusAceitos: readonly Status[],
  anterior: Evento | null,
): { evento: Evento } | { erro: string } {
  const titulo = entrada.titulo.trim();
  if (!titulo) return { erro: "Dê um título ao Evento." };

  const status = statusAceitos.find((s) => s === entrada.status);
  if (!status) return { erro: "Escolha o Status." };

  const responsavel = entrada.responsavel || null;
  if (!responsavel && status !== "rascunho") return { erro: "Escolha o Responsável, ou salve como Rascunho." };
  if (responsavel && !lideranca.includes(responsavel) && responsavel !== anterior?.responsavel) {
    return { erro: "O Responsável precisa ser da Liderança." };
  }

  const periodo = lerPeriodo(entrada);
  if ("erro" in periodo) return periodo;

  const link = entrada.link.trim() || null;
  if (link && !eLink(link)) return { erro: "O link precisa começar com http:// ou https://." };

  const campos = lerCampos(entrada.campos, categoria, lideranca, anterior?.campos ?? {});
  if ("erro" in campos) return campos;

  return {
    evento: {
      titulo,
      ...periodo,
      local: entrada.local.trim(),
      responsavel,
      status,
      observacoes: entrada.observacoes.trim(),
      link,
      campos: campos.valores,
    },
  };
}

function lerCampos(
  textos: Record<string, string>,
  categoria: CategoriaDoEvento,
  lideranca: readonly string[],
  gravados: Record<string, ValorDeCampo>,
): { valores: Record<string, ValorDeCampo> } | { erro: string } {
  const valores: Record<string, ValorDeCampo> = {};
  for (const campo of camposDaCriacao(categoria)) {
    const lido = lerCampo(campo, textos[campo.id] ?? "", lideranca, gravados[campo.id]);
    if (lido === null) {
      if (campo.obrigatorio) return { erro: `Preencha “${campo.nome}”.` };
      continue;
    }
    if (typeof lido === "object" && "erro" in lido) return lido;
    valores[campo.id] = lido;
  }
  return { valores };
}

const VALOR_EM_REAIS = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const DATA_E_HORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** O valor de um campo a partir do texto digitado; `null` se ficou vazio. Uma pessoa já `gravada` no campo pode ficar. */
function lerCampo(
  campo: CampoDaCategoria,
  texto: string,
  lideranca: readonly string[],
  gravado: ValorDeCampo | undefined,
): ValorDeCampo | null | { erro: string } {
  const limpo = texto.trim();
  if (campo.tipo === "lista") {
    const itens = limpo
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    return itens.length > 0 ? itens : null;
  }
  if (!limpo) return null;

  switch (campo.tipo) {
    case "link":
      return eLink(limpo) ? limpo : { erro: `“${campo.nome}” precisa começar com http:// ou https://.` };
    case "valor": {
      const partes = VALOR_EM_REAIS.exec(limpo);
      if (!partes) return { erro: `“${campo.nome}” precisa ser um valor em reais, como 35,00.` };
      const reais = Number(partes[1].replaceAll(".", ""));
      const centavos = Number((partes[2] ?? "0").padEnd(2, "0"));
      return reais * 100 + centavos;
    }
    case "data":
      return lerData(limpo) ? limpo : { erro: `“${campo.nome}” precisa ser uma data.` };
    case "data_hora": {
      const partes = DATA_E_HORA.exec(limpo);
      return partes && lerData(partes[1]) && lerHora(partes[2]) !== null
        ? limpo
        : { erro: `“${campo.nome}” precisa ser uma data e hora.` };
    }
    case "escolha":
      return campo.opcoes.includes(limpo) ? limpo : { erro: `Escolha uma das opções de “${campo.nome}”.` };
    case "pessoa":
      return lideranca.includes(limpo) || limpo === gravado ? limpo : { erro: `Escolha uma pessoa da Liderança em “${campo.nome}”.` };
    default:
      return limpo;
  }
}

/** Tudo é link (nenhum upload): um endereço http ou https. */
function eLink(texto: string): boolean {
  try {
    const { protocol } = new URL(texto);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const MINUTO_MS = 60 * 1000;

/** Meia-noite (no fuso do Mural) de uma data `AAAA-MM-DD`, ou `null` se a data não existe. */
function lerData(texto: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const instante = meiaNoite(ano, mes, dia);
  const lida = dataLocal(instante);
  return lida.ano === ano && lida.mes === mes && lida.dia === dia ? instante : null;
}

/** Minutos desde a meia-noite de uma hora `HH:MM`, ou `null` se a hora não existe. */
function lerHora(texto: string): number | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(texto);
  if (!partes) return null;
  const [horas, minutos] = partes.slice(1).map(Number);
  return horas < 24 && minutos < 60 ? horas * 60 + minutos : null;
}

const somarMinutos = (instante: Date, minutos: number) => new Date(instante.getTime() + minutos * MINUTO_MS);

function lerPeriodo(entrada: EntradaDeEvento): Pick<Evento, "inicio" | "fim" | "diaInteiro"> | { erro: string } {
  const dia = lerData(entrada.data);
  if (!dia) return { erro: "Informe a data do Evento." };
  const diaInteiro = !entrada.hora;
  const hora = diaInteiro ? 0 : lerHora(entrada.hora);
  const horaFim = entrada.horaFim ? lerHora(entrada.horaFim) : null;
  if (hora === null || (entrada.horaFim && horaFim === null)) return { erro: "Informe uma hora válida." };
  const inicio = somarMinutos(dia, hora);

  let fim: Date | null = null;
  const diaFim = entrada.dataFim ? lerData(entrada.dataFim) : dia;
  if (!diaFim) return { erro: "Informe uma data de fim válida." };
  if (diaInteiro) {
    if (horaFim !== null) return { erro: "Um Evento de dia inteiro termina num dia, sem hora." };
    if (entrada.dataFim) fim = diaFim;
  } else if (horaFim !== null) {
    fim = somarMinutos(diaFim, horaFim);
  } else if (entrada.dataFim) {
    return { erro: "Informe a hora do fim." };
  }

  if (fim && fim < inicio) return { erro: "O fim não pode ser antes do início." };
  return { inicio, fim, diaInteiro };
}

/** A data de uma Postagem é a de publicação: ela não tem um campo extra de data. */
export function rotuloDaData(categoria: { nome: string }): string {
  return categoria.nome === "Postagem" ? "Data de publicação" : "Data";
}

/**
 * Toda a Liderança lê todos os Eventos, de todas as Áreas; Pendente, Professor e desativados não leem.
 * (O Professor lê só as aulas dele, no ticket 11.) A política de leitura de `public.eventos` segue a mesma regra.
 */
export function podeVerTodosOsEventos(quem: Pessoa): boolean {
  return daLideranca(quem);
}

/** Data civil `AAAA-MM-DD` de um instante, no fuso do Mural. */
export function diaDe(instante: Date): string {
  const { ano, mes, dia } = dataLocal(instante);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** A lista cronológica: os Eventos agrupados por dia no fuso do Mural, e os de dia inteiro no topo de cada dia. */
export function agruparPorDia<E extends { inicio: Date; diaInteiro: boolean }>(eventos: E[]): { dia: string; eventos: E[] }[] {
  const ordenados = [...eventos].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime() || Number(b.diaInteiro) - Number(a.diaInteiro),
  );
  const dias: { dia: string; eventos: E[] }[] = [];
  for (const evento of ordenados) {
    const dia = diaDe(evento.inicio);
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, eventos: [] });
    dias.at(-1)!.eventos.push(evento);
  }
  return dias;
}

/** Data, hora e fim de um Evento, como `lerPeriodo` os grava. */
type Periodo = Pick<Evento, "inicio" | "fim" | "diaInteiro">;

/**
 * Quando o Evento termina: no horário de fim; sem fim, ou sendo de dia inteiro, à meia-noite do dia seguinte ao
 * último dia. A função `public.fim_do_evento` no banco segue a mesma regra.
 */
export function fimDoEvento({ inicio, fim, diaInteiro }: Periodo): Date {
  if (fim && !diaInteiro) return fim;
  const { ano, mes, dia } = dataLocal(fim ?? inicio);
  return somarDias(meiaNoite(ano, mes, dia), 1);
}

export const terminou = (periodo: Periodo, agora: Date) => agora >= fimDoEvento(periodo);

/**
 * O Status de um Evento num momento: um Confirmado passa sozinho a Realizado quando termina; Planejado e Rascunho
 * vencidos ficam parados até alguém decidir. O banco aplica a mesma transição (`public.realizar_confirmados`).
 */
export function statusNoMomento(evento: Periodo & { status: Status }, agora: Date): Status {
  return evento.status === "confirmado" && terminou(evento, agora) ? "realizado" : evento.status;
}

/**
 * Quem edita um Evento e muda o seu Status: o Admin, quem tem Função na Área da Categoria (a Geral vale para todas)
 * e o Responsável. Os demais líderes só leem. `areas` são as Áreas das Funções de quem edita.
 * A política de edição de `public.eventos` (`pode_editar_evento`) segue a mesma regra.
 */
export function podeEditarEvento(
  quem: Pessoa,
  areas: readonly string[],
  evento: { categoria: { area: string }; responsavel: string | null },
): boolean {
  return podeCriarEvento(quem, areas, evento.categoria) || (daLideranca(quem) && evento.responsavel === quem.id);
}

/** Só o Admin exclui um Evento; os demais usam Cancelado. */
export function podeExcluirEvento(quem: Pessoa): boolean {
  return eAdmin(quem);
}

/** O Realizado manual: o Admin e o Responsável, depois do fim. O banco confere a mesma regra ao editar. */
export function podeMarcarRealizado(quem: Pessoa, evento: Periodo & { responsavel: string | null }, agora: Date): boolean {
  const pode = eAdmin(quem) || (daLideranca(quem) && evento.responsavel === quem.id);
  return pode && terminou(evento, agora);
}

/**
 * Os Status que o formulário de edição oferece: todos, e o Realizado só a quem pode marcá-lo ou se já é Realizado
 * (um Confirmado que terminou já é). O formulário começa no Status do momento.
 */
export function statusDaEdicao(quem: Pessoa, evento: Periodo & { status: Status; responsavel: string | null }, agora: Date): Status[] {
  const comRealizado = statusNoMomento(evento, agora) === "realizado" || podeMarcarRealizado(quem, evento, agora);
  return STATUS.filter((s) => s !== "realizado" || comRealizado);
}

/**
 * Um Evento conta como "sem Responsável" se não tem um, ou se o dele foi desativado e o Evento ainda não terminou.
 * Depois do fim, o Responsável desativado fica para o histórico.
 */
export function semResponsavel(evento: Periodo & { responsavel: { ativo: boolean } | null }, agora: Date): boolean {
  return !evento.responsavel || (!evento.responsavel.ativo && !terminou(evento, agora));
}

/** O caminho inverso de `lerEvento`: o Evento gravado como o formulário de edição o mostra. */
export function entradaDoEvento(evento: Evento, categoria: CategoriaDoEvento): EntradaDeEvento {
  const textoDoCampo = (campo: CampoCadastrado): string => {
    const valor = evento.campos[campo.id];
    if (valor === undefined) return "";
    if (Array.isArray(valor)) return valor.join("\n");
    if (typeof valor === "number") return `${Math.trunc(valor / 100)},${String(valor % 100).padStart(2, "0")}`;
    return valor;
  };
  return {
    titulo: evento.titulo,
    data: diaDe(evento.inicio),
    hora: evento.diaInteiro ? "" : horaLocal(evento.inicio),
    dataFim: evento.fim ? diaDe(evento.fim) : "",
    horaFim: evento.fim && !evento.diaInteiro ? horaLocal(evento.fim) : "",
    local: evento.local,
    responsavel: evento.responsavel ?? "",
    status: evento.status,
    observacoes: evento.observacoes,
    link: evento.link ?? "",
    campos: Object.fromEntries(camposDaCriacao(categoria).map((c) => [c.id, textoDoCampo(c)])),
  };
}
