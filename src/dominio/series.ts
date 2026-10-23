import type { Pessoa } from "./acesso";
import { diaDe, statusNoMomento, type Evento } from "./eventos";
import { dataLocal, meiaNoite } from "./fuso";

/**
 * Uma Série é o molde recorrente: a regra abaixo gera as Ocorrências, que são Eventos comuns e passam a viver por
 * conta própria. Repete no máximo toda semana, por até 6 meses a partir do primeiro dia. Os dias são datas civis
 * `AAAA-MM-DD` no fuso do Mural; o dia da semana vai de 0 (domingo) a 6.
 */
/** `dias` é uma lista só para manter o formato da regra gravada; a regra aceita no máximo um dia da semana. */
export type Repeticao = { frequencia: "semanal"; dias: number[] };

export type Termino = { data: string } | { ocorrencias: number };

export type RegraDaSerie = Repeticao & { termino: Termino };

/** O que o formulário envia para a regra, tudo como texto. */
export type EntradaDeRegra = {
  frequencia: string;
  dias: string[];
  terminoPor: string;
  terminoData: string;
  terminoOcorrencias: string;
};

/** Teto de segurança de Ocorrências por Série; o limite de 6 meses costuma chegar antes. */
export const MAXIMO_DE_OCORRENCIAS = 52;

/** Quantos meses, a partir do primeiro dia, uma Série pode durar. */
export const MAXIMO_DE_MESES = 6;

/** A mensagem de todo bloqueio de frequência ou de período, a mesma que o formulário mostra de antemão. */
export const LIMITE_DA_SERIE = `A Série repete no máximo toda semana, por até ${MAXIMO_DE_MESES} meses.`;

export const NOMES_DOS_DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const DIA_MS = 24 * 60 * 60 * 1000;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dias civis como contagem de dias desde 1970, para somar e comparar sem fuso. */
function numeroDoDia(dia: string): number | null {
  const partes = DATA.exec(dia);
  if (!partes) return null;
  const [ano, mes, d] = partes.slice(1).map(Number);
  const instante = Date.UTC(ano, mes - 1, d);
  const lida = new Date(instante);
  return lida.getUTCFullYear() === ano && lida.getUTCMonth() === mes - 1 && lida.getUTCDate() === d ? instante / DIA_MS : null;
}

const diaDoNumero = (numero: number) => new Date(numero * DIA_MS).toISOString().slice(0, 10);
const diaDaSemana = (numero: number) => new Date(numero * DIA_MS).getUTCDay();

/** O último dia que a Série pode ter: o mesmo dia, 6 meses depois (num mês mais curto, o último dia dele). */
function ultimoDiaPermitido(primeiro: number): number {
  const inicio = new Date(primeiro * DIA_MS);
  const alvo = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + MAXIMO_DE_MESES, 1));
  const ultimoDoMes = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(inicio.getUTCDate(), ultimoDoMes));
  return alvo.getTime() / DIA_MS;
}

/** Confere o que veio do formulário e monta a regra. `primeiroDia` é a data do Evento modelo. */
export function lerRegra(entrada: EntradaDeRegra, primeiroDia: string): { regra: RegraDaSerie } | { erro: string } {
  if (entrada.frequencia !== "semanal") return { erro: LIMITE_DA_SERIE };

  const termino = lerTermino(entrada, primeiroDia);
  if ("erro" in termino) return termino;

  const dias = [...new Set(entrada.dias.map(Number))];
  if (dias.length > 1) return { erro: LIMITE_DA_SERIE };
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { erro: "Escolha um dia da semana válido." };
  // Sem dia escolhido, repete no dia da semana da data do Evento.
  if (dias.length === 0) {
    const numero = numeroDoDia(primeiroDia);
    if (numero === null) return { erro: "Informe a data do Evento." };
    dias.push(diaDaSemana(numero));
  }
  return { regra: { frequencia: "semanal", dias, termino: termino.termino } };
}

function lerTermino(entrada: EntradaDeRegra, primeiroDia: string): { termino: Termino } | { erro: string } {
  if (entrada.terminoPor === "data") {
    const ate = numeroDoDia(entrada.terminoData);
    if (ate === null) return { erro: "Informe a data em que a Série termina." };
    if (ate < (numeroDoDia(primeiroDia) ?? 0)) return { erro: "A Série não pode terminar antes da primeira data." };
    return { termino: { data: entrada.terminoData } };
  }
  if (entrada.terminoPor === "contagem") {
    const quantas = Number(entrada.terminoOcorrencias);
    if (!Number.isInteger(quantas) || quantas < 1 || quantas > MAXIMO_DE_OCORRENCIAS) {
      return { erro: `Informe de 1 a ${MAXIMO_DE_OCORRENCIAS} Ocorrências.` };
    }
    return { termino: { ocorrencias: quantas } };
  }
  return { erro: "Escolha o término da Série: por data ou por número de Ocorrências." };
}

/** Os dias das Ocorrências, a partir de `primeiroDia` (inclusive) até o término, dentro dos 6 meses. */
export function expandirSerie(regra: RegraDaSerie, primeiroDia: string): { datas: string[] } | { erro: string } {
  const primeiro = numeroDoDia(primeiroDia);
  if (primeiro === null) return { erro: "Informe a data do Evento." };
  const limite = ultimoDiaPermitido(primeiro);
  const ate = "data" in regra.termino ? numeroDoDia(regra.termino.data) : null;
  if (ate !== null && ate > limite) return { erro: LIMITE_DA_SERIE };

  const quantas = "ocorrencias" in regra.termino ? regra.termino.ocorrencias : MAXIMO_DE_OCORRENCIAS;
  const datas: string[] = [];
  for (let dia = primeiro; dia <= (ate ?? limite) && datas.length < quantas; dia++) {
    if (regra.dias.includes(diaDaSemana(dia))) datas.push(diaDoNumero(dia));
  }

  // Contando Ocorrências, o último dia pedido tem de caber nos 6 meses.
  if ("ocorrencias" in regra.termino && datas.length < quantas) return { erro: LIMITE_DA_SERIE };
  if (datas.length === 0) return { erro: "Nenhuma data cai nessa regra." };
  return { datas };
}

/** Um Evento modelo levado para outro dia: o mesmo horário e a mesma duração em dias. */
function noDia(modelo: Evento, dia: string): Evento {
  const [ano, mes, d] = dia.split("-").map(Number);
  const deslocamento = meiaNoite(ano, mes, d).getTime() - meiaNoite(...diaCivil(modelo.inicio)).getTime();
  return {
    ...modelo,
    inicio: new Date(modelo.inicio.getTime() + deslocamento),
    fim: modelo.fim ? new Date(modelo.fim.getTime() + deslocamento) : null,
  };
}

function diaCivil(instante: Date): [number, number, number] {
  const { ano, mes, dia } = dataLocal(instante);
  return [ano, mes, dia];
}

/** Uma Ocorrência por dia, a partir do Evento modelo, numeradas de 1 na ordem das datas. */
export function ocorrenciasDe(modelo: Evento, dias: string[]): Evento[] {
  return [...dias]
    .sort()
    .map((dia, i) => ({ ...noDia(modelo, dia), numero: i + 1 }));
}

/**
 * Uma Série nova a partir do Evento lido do formulário: a regra e as Ocorrências, a partir da data do Evento.
 * A primeira Ocorrência é o primeiro dia, daquela data em diante, que cai na regra.
 */
export function lerSerie(modelo: Evento, entrada: EntradaDeRegra): { regra: RegraDaSerie; primeiroDia: string; ocorrencias: Evento[] } | { erro: string } {
  const primeiroDia = diaDe(modelo.inicio);
  const lida = lerRegra(entrada, primeiroDia);
  if ("erro" in lida) return lida;
  const dias = expandirSerie(lida.regra, primeiroDia);
  if ("erro" in dias) return dias;
  return { regra: lida.regra, primeiroDia, ocorrencias: ocorrenciasDe(modelo, dias.datas) };
}

const NOMES_NO_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

/** A regra em português, para a tela: "Toda semana, domingos, por 8 Ocorrências". */
export function descreverRegra(regra: RegraDaSerie): string {
  const termino = "data" in regra.termino ? `até ${formatarDia(regra.termino.data)}` : `por ${regra.termino.ocorrencias} Ocorrências`;
  return `Toda semana, ${regra.dias.map((d) => NOMES_NO_PLURAL[d]).join(", ")}, ${termino}`;
}

// Edição ---------------------------------------------------------------------

/** Uma Ocorrência como está gravada. `editada` marca as que foram alteradas individualmente. */
export type OcorrenciaGravada = { id: string; evento: Evento; editada: boolean };

/** O que gravar numa Ocorrência. `editada` ausente deixa a marca como está. */
export type Alteracao = { id: string; evento: Evento; editada?: boolean };

export type EscopoDeEdicao = "esta" | "esta_e_seguintes" | "toda";

export const NOMES_DOS_ESCOPOS: Record<EscopoDeEdicao, string> = {
  esta: "Só esta",
  esta_e_seguintes: "Esta e as seguintes",
  toda: "Toda a série",
};

/**
 * Quem edita a Categoria (o Admin e quem tem Função na Área) escolhe qualquer escopo; quem só é Responsável da
 * Ocorrência edita só ela. O banco confere a permissão sobre cada Ocorrência afetada.
 */
export function escoposDeEdicao(editaACategoria: boolean): EscopoDeEdicao[] {
  return editaACategoria ? ["esta", "esta_e_seguintes", "toda"] : ["esta"];
}

/** Realizada ou Cancelada (um Confirmado que já terminou conta como Realizado) fica congelada diante da Série. */
const congelada = (evento: Evento, agora: Date) => ["realizado", "cancelado"].includes(statusNoMomento(evento, agora));

/** Compara por valor, sem depender da ordem das chaves (o banco devolve os `campos` na ordem dele). */
const ordenado = (valor: unknown): unknown => {
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map(ordenado);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([chave, v]) => [chave, ordenado(v)]),
    );
  }
  return valor;
};
const igual = (a: unknown, b: unknown) => JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b));

/** Tudo o que é de uma Ocorrência, menos o Status, que é de cada uma. */
const CAMPOS_ALEM_DO_STATUS = ["titulo", "inicio", "fim", "diaInteiro", "local", "responsavel", "observacoes", "link", "campos"] as const;

/** O horário de um Evento relativo ao seu primeiro dia: quando começa, quando termina (passando de dia, se for o caso) e se é de dia inteiro. */
const horario = (e: Evento) => {
  const meiaNoiteDoInicio = meiaNoite(...diaCivil(e.inicio)).getTime();
  return { diaInteiro: e.diaInteiro, inicio: e.inicio.getTime() - meiaNoiteDoInicio, fim: e.fim ? e.fim.getTime() - meiaNoiteDoInicio : null };
};

/**
 * Aplica uma edição de Ocorrência: `anterior` é a escolhida como estava e `novo`, como ficou no formulário.
 * - "só esta" muda a escolhida e a marca como editada (mudar só o Status não conta); uma Realizada ou Cancelada só
 *   o Admin edita;
 * - "esta e as seguintes" e "toda a série" levam às outras só o que mudou, menos Status e data, em cada dia delas,
 *   e deixam de fora as editadas individualmente, as Realizadas e as Canceladas. A escolhida sempre leva o que
 *   foi digitado, inclusive o Status, e não ganha a marca de editada.
 */
export function editarSerie({
  ocorrencias,
  alvo,
  escopo,
  anterior,
  novo,
  quem,
  agora,
}: {
  ocorrencias: OcorrenciaGravada[];
  alvo: string;
  escopo: EscopoDeEdicao;
  anterior: Evento;
  novo: Evento;
  quem: Pessoa;
  agora: Date;
}): { alteracoes: Alteracao[] } | { erro: string } {
  const anteriorCongelada = congelada(anterior, agora);

  if (escopo === "esta") {
    if (anteriorCongelada && !(quem.ativo && quem.nivel === "admin")) {
      return { erro: "Uma Ocorrência Realizada ou Cancelada só o Admin edita." };
    }
    const mudouAlgoAlemDoStatus = CAMPOS_ALEM_DO_STATUS.some((campo) => !igual(anterior[campo], novo[campo]));
    return { alteracoes: [{ id: alvo, evento: novo, ...(mudouAlgoAlemDoStatus && { editada: true }) }] };
  }

  if (anteriorCongelada) return { erro: "Esta Ocorrência está Realizada ou Cancelada: só o Admin a edita, e só ela (“Só esta”)." };
  if (diaDe(novo.inicio) !== diaDe(anterior.inicio)) {
    return { erro: "Mudar a data vale só para uma Ocorrência: escolha “Só esta”." };
  }

  const inicioDoAlvo = anterior.inicio.getTime();
  const afetadas = ocorrencias
    .filter((o) => {
      if (o.id === alvo) return true;
      if (o.editada || congelada(o.evento, agora)) return false;
      return escopo === "toda" || o.evento.inicio.getTime() > inicioDoAlvo;
    })
    .sort((a, b) => a.evento.inicio.getTime() - b.evento.inicio.getTime());

  const horarioMudou = !igual(horario(anterior), horario(novo));
  const alteracoes = afetadas.map(({ id, evento }): Alteracao => {
    if (id === alvo) return { id, evento: novo };
    const mudado: Evento = { ...evento, campos: { ...evento.campos } };
    if (anterior.titulo !== novo.titulo) mudado.titulo = novo.titulo;
    if (anterior.local !== novo.local) mudado.local = novo.local;
    if (anterior.responsavel !== novo.responsavel) mudado.responsavel = novo.responsavel;
    if (anterior.observacoes !== novo.observacoes) mudado.observacoes = novo.observacoes;
    if (anterior.link !== novo.link) mudado.link = novo.link;
    for (const chave of new Set([...Object.keys(anterior.campos), ...Object.keys(novo.campos)])) {
      if (igual(anterior.campos[chave], novo.campos[chave])) continue;
      if (novo.campos[chave] === undefined) delete mudado.campos[chave];
      else mudado.campos[chave] = novo.campos[chave];
    }
    if (horarioMudou) {
      const noHorario = noDia(novo, diaDe(evento.inicio));
      Object.assign(mudado, { inicio: noHorario.inicio, fim: noHorario.fim, diaInteiro: novo.diaInteiro });
    }
    return { id, evento: mudado };
  });
  return { alteracoes };
}

/** Um dia `AAAA-MM-DD` como o Mural o mostra: `DD/MM/AAAA`. */
export const formatarDia = (dia: string) => dia.split("-").reverse().join("/");

/** "3 Ocorrências canceladas", "1 Ocorrência cancelada" ou "Nenhuma Ocorrência foi cancelada". */
export function resumoDosCancelamentos(quantas: number): string {
  if (quantas === 0) return "Nenhuma Ocorrência foi cancelada.";
  return quantas === 1 ? "1 Ocorrência cancelada." : `${quantas} Ocorrências canceladas.`;
}

/** O último dia da Série: uma data que existe e que não vem antes da primeira Ocorrência. */
export function lerDiaDeEncerramento(texto: string, ocorrencias: OcorrenciaGravada[]): { dia: string } | { erro: string } {
  if (numeroDoDia(texto) === null) return { erro: "Informe o último dia da Série." };
  const primeira = ocorrencias.map((o) => diaDe(o.evento.inicio)).sort()[0];
  if (primeira && texto < primeira) return { erro: "A Série não pode terminar antes da primeira Ocorrência." };
  return { dia: texto };
}

/** Encerrar a Série em `ate` (inclusive): as Ocorrências depois dele que ainda estão abertas viram Canceladas. */
export function encerrarSerie(ocorrencias: OcorrenciaGravada[], ate: string, agora: Date): Alteracao[] {
  return cancelar(ocorrencias.filter((o) => diaDe(o.evento.inicio) > ate), agora);
}

/** Cancelar todas as futuras: as que ainda não começaram e estão abertas. */
export function cancelarFuturas(ocorrencias: OcorrenciaGravada[], agora: Date): Alteracao[] {
  return cancelar(ocorrencias.filter((o) => o.evento.inicio > agora), agora);
}

function cancelar(ocorrencias: OcorrenciaGravada[], agora: Date): Alteracao[] {
  return ocorrencias
    .filter((o) => !congelada(o.evento, agora))
    .sort((a, b) => a.evento.inicio.getTime() - b.evento.inicio.getTime())
    .map(({ id, evento }) => ({ id, evento: { ...evento, status: "cancelado" } }));
}
