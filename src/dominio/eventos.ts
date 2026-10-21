import type { Pessoa } from "./acesso";
import type { CampoCadastrado, CampoDaCategoria } from "./catalogo";
import { dataLocal, meiaNoite } from "./fuso";

/** Os estágios de um Evento. As transições são livres (ticket 05). */
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

/** Com que Status um Evento pode nascer. Realizado só vem depois do fim (ticket 05). */
export const STATUS_INICIAIS = ["rascunho", "planejado", "confirmado", "cancelado", "adiado"] as const satisfies Status[];

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
 * como lista de textos. O checklist só ganha comportamento no ticket 12.
 */
export type ValorDeCampo = string | number | string[];

export type CategoriaDoEvento = { nome: string; campos: CampoCadastrado[] };

/** Os campos específicos preenchidos ao criar um Evento: todos, menos o checklist, que só ganha comportamento no ticket 12. */
export function camposDaCriacao(categoria: CategoriaDoEvento): CampoCadastrado[] {
  return categoria.campos.filter((campo) => campo.tipo !== "checklist");
}

/**
 * Confere e converte o que veio do formulário num Evento pronto para gravar, ou diz o que impede.
 * `lideranca` são os ids de quem pode ser Responsável.
 */
export function lerEvento(
  entrada: EntradaDeEvento,
  categoria: CategoriaDoEvento,
  lideranca: readonly string[],
): { evento: Evento } | { erro: string } {
  const titulo = entrada.titulo.trim();
  if (!titulo) return { erro: "Dê um título ao Evento." };

  const status = STATUS_INICIAIS.find((s) => s === entrada.status);
  if (!status) return { erro: "Escolha o Status." };

  const responsavel = entrada.responsavel || null;
  if (!responsavel && status !== "rascunho") return { erro: "Escolha o Responsável, ou salve como Rascunho." };
  if (responsavel && !lideranca.includes(responsavel)) return { erro: "O Responsável precisa ser da Liderança." };

  const periodo = lerPeriodo(entrada);
  if ("erro" in periodo) return periodo;

  const link = entrada.link.trim() || null;
  if (link && !eLink(link)) return { erro: "O link precisa começar com http:// ou https://." };

  const campos = lerCampos(entrada.campos, categoria, lideranca);
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
): { valores: Record<string, ValorDeCampo> } | { erro: string } {
  const valores: Record<string, ValorDeCampo> = {};
  for (const campo of camposDaCriacao(categoria)) {
    const lido = lerCampo(campo, textos[campo.id] ?? "", lideranca);
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

/** O valor de um campo a partir do texto digitado; `null` se ficou vazio. */
function lerCampo(campo: CampoDaCategoria, texto: string, lideranca: readonly string[]): ValorDeCampo | null | { erro: string } {
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
      return lideranca.includes(limpo) ? limpo : { erro: `Escolha uma pessoa da Liderança em “${campo.nome}”.` };
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
  return quem.ativo && (quem.nivel === "admin" || quem.nivel === "lider");
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
