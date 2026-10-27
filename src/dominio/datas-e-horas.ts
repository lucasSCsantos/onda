/** Datas e horas dos seletores: lógica sem interface (grade do mês em pt-BR, intervalo, hora), sem fuso e sem relógio. */

export const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** A semana começa na segunda-feira, como o calendário principal. */
export const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

export type Dia = { ano: number; mes: number; dia: number };

const pad = (n: number, tamanho = 2) => String(n).padStart(tamanho, "0");

/** `AAAA-MM-DD` válido (dia que existe no mês), ou `null`. */
export function lerData(texto: string): Dia | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDoMes(ano, mes)) return null;
  return { ano, mes, dia };
}

export const formatarData = ({ ano, mes, dia }: Dia) => `${pad(ano, 4)}-${pad(mes)}-${pad(dia)}`;

/** `AAAA-MM-DD` como `DD/MM/AAAA`; texto inválido ou vazio vira "". */
export function dataParaExibir(texto: string): string {
  const d = lerData(texto);
  return d ? `${pad(d.dia)}/${pad(d.mes)}/${pad(d.ano, 4)}` : "";
}

/** O que a pessoa digita (`DD/MM/AAAA`, `DDMMAAAA` ou já `AAAA-MM-DD`) como `AAAA-MM-DD`; `null` se não for uma data. Vazio vale "". */
export function lerDataDigitada(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return lerData(limpo) ? limpo : null;
  const partes = /^(\d{1,2})\D?(\d{1,2})\D?(\d{4})$/.exec(limpo);
  if (!partes) return null;
  const dia = lerData(`${partes[3]}-${pad(Number(partes[2]))}-${pad(Number(partes[1]))}`);
  return dia ? formatarData(dia) : null;
}

export function diasDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Posição do dia na semana que começa na segunda: 0 é segunda e 6, domingo. */
function colunaDaSemana(ano: number, mes: number, dia: number): number {
  return (new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() + 6) % 7;
}

export type CelulaDaGrade = { data: string; dia: number; doMes: boolean };

/** O mês em semanas inteiras de segunda a domingo; dias dos meses vizinhos completam as pontas (`doMes: false`). */
export function montarGrade(ano: number, mes: number): CelulaDaGrade[][] {
  const antes = colunaDaSemana(ano, mes, 1);
  const total = Math.ceil((antes + diasDoMes(ano, mes)) / 7) * 7;
  const celulas: CelulaDaGrade[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(ano, mes - 1, 1 - antes + i));
    const dia = { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
    celulas.push({ data: formatarData(dia), dia: dia.dia, doMes: dia.mes === mes && dia.ano === ano });
  }
  const semanas: CelulaDaGrade[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** O mês `delta` meses adiante (ou atrás), virando o ano quando precisa. */
export function mudarMes(ano: number, mes: number, delta: number): { ano: number; mes: number } {
  const indice = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(indice / 12), mes: (((indice % 12) + 12) % 12) + 1 };
}

/** `AAAA-MM-DD` deslocado em `dias` dias (para as setas do teclado). */
export function somarDiasA(data: string, dias: number): string {
  const d = lerData(data);
  if (!d) return data;
  const novo = new Date(Date.UTC(d.ano, d.mes - 1, d.dia + dias));
  return formatarData({ ano: novo.getUTCFullYear(), mes: novo.getUTCMonth() + 1, dia: novo.getUTCDate() });
}

/** O mesmo dia do mês `delta` meses adiante, ficando no último dia quando o mês é mais curto (31/01 + 1 → 28/02). */
export function somarMesesA(data: string, delta: number): string {
  const d = lerData(data);
  if (!d) return data;
  const { ano, mes } = mudarMes(d.ano, d.mes, delta);
  return formatarData({ ano, mes, dia: Math.min(d.dia, diasDoMes(ano, mes)) });
}

/**
 * Para onde vai o foco do calendário com uma tecla: setas andam um dia ou uma semana, Home e End vão às pontas da semana,
 * PageUp e PageDown mudam o mês (com Shift, o ano). `null` para qualquer outra tecla.
 */
export function destinoDoTeclado(grade: CelulaDaGrade[][], atual: string, tecla: string, comShift: boolean): string | null {
  const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (tecla in passos) return somarDiasA(atual, passos[tecla]);
  const semana = grade.find((s) => s.some((c) => c.data === atual)) ?? grade[0];
  if (tecla === "Home") return semana[0].data;
  if (tecla === "End") return semana[6].data;
  if (tecla === "PageUp") return somarMesesA(atual, comShift ? -12 : -1);
  if (tecla === "PageDown") return somarMesesA(atual, comShift ? 12 : 1);
  return null;
}

/** Doze anos por página, para chegar a uma data de nascimento antiga sem rolar mês a mês. */
export function paginaDeAnos(ano: number): number[] {
  const inicio = ano - (((ano % 12) + 12) % 12);
  return Array.from({ length: 12 }, (_, i) => inicio + i);
}

export type Intervalo = { inicio: string; fim: string };

/**
 * O que um toque num dia faz no calendário de intervalo: o primeiro toque define o início; o segundo, o fim (um dia
 * antes do início vira o novo início); com o intervalo completo, o toque recomeça.
 */
export function escolherNoIntervalo(atual: Intervalo, tocado: string): Intervalo {
  if (!atual.inicio || atual.fim) return { inicio: tocado, fim: "" };
  if (tocado < atual.inicio) return { inicio: tocado, fim: "" };
  return { inicio: atual.inicio, fim: tocado };
}

/** O dia está no intervalo (inclusive as pontas)? Com só o início, vale só ele. */
export function estaNoIntervalo(data: string, { inicio, fim }: Intervalo): boolean {
  if (!inicio) return false;
  return data >= inicio && data <= (fim || inicio);
}

/** Minutos desde a meia-noite de uma hora `HH:MM`; vazio ("sem horário", dia inteiro) e hora inexistente dão `null`. */
export function lerHora(texto: string): number | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(texto);
  if (!partes) return null;
  const [horas, minutos] = partes.slice(1).map(Number);
  return horas < 24 && minutos < 60 ? horas * 60 + minutos : null;
}

export const formatarHora = (minutos: number) => `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`;

/** Arredonda ao passo mais próximo (23:58 em passos de 15 fica em 23:45; nunca passa do fim do dia). */
export function arredondarHora(minutos: number, passo: number): number {
  const arredondado = Math.round(minutos / passo) * passo;
  const ultimo = Math.floor((24 * 60 - 1) / passo) * passo;
  return Math.min(arredondado, ultimo);
}

/** Todas as horas do dia, de passo em passo, como `HH:MM`. */
export function horasDoDia(passo: 5 | 15 | 30 | 60): string[] {
  return Array.from({ length: Math.floor((24 * 60) / passo) }, (_, i) => formatarHora(i * passo));
}

/**
 * O que a pessoa digita no campo de hora como `HH:MM`: "9", "09", "930", "0930", "9:30", "9h30". Vazio é "" (sem
 * horário); o que não é hora dá `null`.
 */
export function lerHoraDigitada(texto: string): string | null {
  const limpo = texto.trim().toLowerCase();
  if (!limpo) return "";
  const partes = /^(\d{1,2})[:h.]?(\d{2})?$/.exec(limpo) ?? /^(\d{1,2})(\d{2})$/.exec(limpo);
  if (!partes) return null;
  let horas = Number(partes[1]);
  let minutos = Number(partes[2] ?? 0);
  // "930" e "0930" sem separador: os dois últimos dígitos são os minutos.
  if (partes[2] === undefined && /^\d{3,4}$/.test(limpo)) {
    horas = Number(limpo.slice(0, -2));
    minutos = Number(limpo.slice(-2));
  }
  if (horas > 23 || minutos > 59) return null;
  return formatarHora(horas * 60 + minutos);
}

/** `AAAA-MM-DDTHH:MM` em data e hora; sem a parte da hora, a hora volta vazia. */
export function dividirDataEHora(texto: string): { data: string; hora: string } {
  const [data = "", hora = ""] = texto.split("T");
  return { data, hora };
}

/** Data e hora de volta no formato do campo; sem data não há valor, e sem hora vale meia-noite. */
export function juntarDataEHora(data: string, hora: string): string {
  if (!data) return "";
  return `${data}T${hora || "00:00"}`;
}
