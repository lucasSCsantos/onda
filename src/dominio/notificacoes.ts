import { tituloDeExibicao } from "./eventos";
import { dataLocal, horaLocal, meiaNoite } from "./fuso";
import { montarConteudo, type ConteudoDaNotificacao } from "./push";

// Notificações: o que se decide sem rede nem banco. Os tipos, o texto curto de cada um, a janela de horário da pessoa,
// as retentativas e o plano de envio de cada item da fila. O banco grava a fila (supabase/migrations/20261023140000_notificacoes.sql)
// e a rota do agendador executa o plano (src/lib/notificacoes/processar.ts).

export const TIPOS_DE_NOTIFICACAO = ["designacao_responsavel", "designacao_aula"] as const;
export type TipoDeNotificacao = (typeof TIPOS_DE_NOTIFICACAO)[number];

export const NOMES_DOS_TIPOS: Record<TipoDeNotificacao, string> = {
  designacao_responsavel: "Quando me definirem como Responsável por um Evento",
  designacao_aula: "Quando me escalarem como Professor ou Auxiliar de uma aula",
};

export const eTipoDeNotificacao = (valor: unknown): valor is TipoDeNotificacao =>
  typeof valor === "string" && (TIPOS_DE_NOTIFICACAO as readonly string[]).includes(valor);

// Janela de horário ------------------------------------------------------------------------------------------------

/** O intervalo do dia, em horas cheias no fuso do Mural, em que a pessoa aceita receber: das `inicio` até as `fim`. */
export type JanelaDeHorario = { inicio: number; fim: number };

export const JANELA_PADRAO: JanelaDeHorario = { inicio: 8, fim: 21 };

/** A janela que o formulário envia, ou o que impede. O banco confere os mesmos limites. */
export function lerJanela(inicio: string, fim: string): JanelaDeHorario | { erro: string } {
  const i = Number(inicio);
  const f = Number(fim);
  if (inicio.trim() === "" || fim.trim() === "" || !Number.isInteger(i) || !Number.isInteger(f) || i < 0 || i > 23 || f < 1 || f > 24) {
    return { erro: "Escolha horas entre 0h e 24h." };
  }
  if (i >= f) return { erro: "A janela precisa abrir antes de fechar." };
  return { inicio: i, fim: f };
}

const minutosDoDia = (instante: Date) => {
  const [h, m] = horaLocal(instante).split(":").map(Number);
  return h * 60 + m;
};

/** O instante está dentro da janela (abre às `inicio`h em ponto, fecha às `fim`h em ponto)? */
export function dentroDaJanela(instante: Date, janela: JanelaDeHorario): boolean {
  const minutos = minutosDoDia(instante);
  return minutos >= janela.inicio * 60 && minutos < janela.fim * 60;
}

/** Quando a janela abre de novo: agora, se já está aberta; hoje, se ainda não abriu; amanhã, se já fechou. */
export function proximaAbertura(instante: Date, janela: JanelaDeHorario): Date {
  if (dentroDaJanela(instante, janela)) return instante;
  const { ano, mes, dia } = dataLocal(instante);
  const hoje = meiaNoite(ano, mes, dia).getTime() + janela.inicio * 3_600_000;
  return new Date(instante.getTime() < hoje ? hoje : hoje + 24 * 3_600_000);
}

// Texto ------------------------------------------------------------------------------------------------------------

/** O que o texto de uma Notificação pode usar de um Evento: nada além disto (nunca dados de Adolescentes). */
export type EventoDaNotificacao = {
  id: string;
  titulo: string;
  numero?: number | null;
  inicio: Date;
  diaInteiro: boolean;
  local: string;
  categoria: string;
};

/** Categorias cuja Notificação omite o local, para a casa de um Adolescente não aparecer na tela bloqueada. */
const CATEGORIAS_SEM_LOCAL = ["pequeno grupo"];

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "sáb., 24/10 às 19h" (ou "às 19h30"; "dia inteiro" para Evento sem hora). */
export function dataEHora(inicio: Date, diaInteiro: boolean): string {
  const { dia, mes, diaDaSemana } = dataLocal(inicio);
  const data = `${DIAS[diaDaSemana]}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
  if (diaInteiro) return `${data}, dia inteiro`;
  const [h, m] = horaLocal(inicio).split(":");
  return `${data} às ${Number(h)}h${m === "00" ? "" : m}`;
}

const localDe = (evento: EventoDaNotificacao) =>
  CATEGORIAS_SEM_LOCAL.includes(evento.categoria.trim().toLowerCase()) || evento.local.trim() === "" ? "" : ` · ${evento.local.trim()}`;

/** Os modelos de texto de cada tipo, curtos e em pt-BR. O título da Notificação diz o que houve; o texto, de que Evento se trata. */
const MODELOS: Record<TipoDeNotificacao, { titulo: string; texto: (evento: EventoDaNotificacao) => string }> = {
  designacao_responsavel: {
    titulo: "Você foi definido(a) como Responsável",
    texto: (e) => `${tituloDeExibicao(e)} · ${dataEHora(e.inicio, e.diaInteiro)}${localDe(e)}`,
  },
  designacao_aula: {
    titulo: "Você foi escalado(a) em uma aula",
    texto: (e) => `${tituloDeExibicao(e)} · ${dataEHora(e.inicio, e.diaInteiro)}${localDe(e)}`,
  },
};

/** A tag de um tipo e de um Evento: um aviso novo do mesmo assunto substitui o anterior na tela do aparelho. */
export const tagDaNotificacao = (tipo: TipoDeNotificacao, eventoId: string) => `${tipo}:${eventoId}`;

/** O conteúdo mínimo que vai ao aparelho e à central: texto curto, `tag` e o caminho do Evento. */
export function conteudoDaNotificacao(tipo: TipoDeNotificacao, evento: EventoDaNotificacao): ConteudoDaNotificacao {
  const modelo = MODELOS[tipo];
  return montarConteudo({
    titulo: modelo.titulo,
    texto: modelo.texto(evento),
    tag: tagDaNotificacao(tipo, evento.id),
    url: `/eventos/${evento.id}`,
  });
}

// Idempotência -----------------------------------------------------------------------------------------------------

/** A chave única de uma Notificação (a mesma que o índice do banco impõe): tipo, Evento, pessoa e janela. */
export const chaveDaNotificacao = (n: { tipo: string; eventoId: string | null; pessoaId: string; janela: string }) =>
  [n.tipo, n.eventoId ?? "-", n.pessoaId, n.janela].join("|");

// Retentativas -----------------------------------------------------------------------------------------------------

export const LIMITE_DE_TENTATIVAS = 5;
const ESPERA_INICIAL_MS = 5 * 60_000;

/** Depois de `tentativas` falhas: a espera cresce (5, 15, 45 e 135 minutos) até o limite, quando a falha vira definitiva. */
export function depoisDaFalha(tentativas: number, agora: Date): { definitiva: false; proximaTentativa: Date } | { definitiva: true } {
  if (tentativas >= LIMITE_DE_TENTATIVAS) return { definitiva: true };
  return { definitiva: false, proximaTentativa: new Date(agora.getTime() + ESPERA_INICIAL_MS * 3 ** (tentativas - 1)) };
}

// Plano de envio ---------------------------------------------------------------------------------------------------

export type EstadoDaNotificacao = "pendente" | "enviada" | "falha" | "dispensada" | "expirada";

export type PlanoDeEnvio =
  | { acao: "expirar" }
  | { acao: "dispensar"; motivo: "tipo_desligado" | "sem_dispositivo" }
  | { acao: "esperar"; ate: Date }
  | { acao: "enviar"; ttl: number };

/** O tempo máximo que o serviço de push guarda uma Notificação para um aparelho desligado, em segundos. */
const TTL_MAXIMO = 24 * 60 * 60;

/**
 * O que fazer com uma Notificação devida: expirar se venceu, dispensar se a pessoa desligou o tipo ou não tem dispositivo
 * (a central continua mostrando), esperar a janela de horário abrir (as urgentes não esperam) ou enviar.
 */
export function planejarEnvio(
  n: { urgente: boolean; validaAte: Date; tipo: string },
  contexto: { agora: Date; janela: JanelaDeHorario; tiposDesligados: readonly string[]; dispositivos: number },
): PlanoDeEnvio {
  const { agora, janela, tiposDesligados, dispositivos } = contexto;
  if (n.validaAte.getTime() <= agora.getTime()) return { acao: "expirar" };
  if (tiposDesligados.includes(n.tipo)) return { acao: "dispensar", motivo: "tipo_desligado" };
  if (dispositivos === 0) return { acao: "dispensar", motivo: "sem_dispositivo" };
  if (!n.urgente && !dentroDaJanela(agora, janela)) {
    const abertura = proximaAbertura(agora, janela);
    // Se a validade acaba antes de a janela abrir, esperar só adia o inevitável.
    return abertura.getTime() >= n.validaAte.getTime() ? { acao: "expirar" } : { acao: "esperar", ate: abertura };
  }
  const restante = Math.floor((n.validaAte.getTime() - agora.getTime()) / 1000);
  return { acao: "enviar", ttl: Math.max(60, Math.min(restante, TTL_MAXIMO)) };
}

export type DesfechoDoEnvio = {
  estado: EstadoDaNotificacao;
  tentativas: number;
  /** Só quando segue pendente: a próxima tentativa. */
  proximaTentativa?: Date;
  /** Todos os dispositivos que já receberam, os de antes e os desta rodada. */
  entregueA: string[];
  /** Dispositivos que falharam sem volta (esgotaram as tentativas): vão para os Logs. */
  falhasDefinitivas: string[];
};

/**
 * O que sobra de uma rodada de envio. Quem recebeu fica registrado (uma nova tentativa não repete o envio a ele); quem
 * falhou temporariamente volta com espera crescente, até o limite. Inscrições recusadas (404 ou 410) já saíram do banco e
 * não contam como falha. Chegar a ao menos um dispositivo é "enviada"; esgotar sem chegar a nenhum é "falha".
 */
export function desfechoDoEnvio(
  antes: { tentativas: number; entregueA: readonly string[] },
  entrega: { enviados: readonly string[]; expirados: readonly string[]; falhas: readonly string[] },
  agora: Date,
): DesfechoDoEnvio {
  const entregueA = [...new Set([...antes.entregueA, ...entrega.enviados])];
  if (entrega.falhas.length === 0) {
    // Tudo o que dava para entregar foi; se nenhum aparelho respondeu e todos expiraram, só a central tem o aviso.
    return { estado: entregueA.length > 0 ? "enviada" : "dispensada", tentativas: antes.tentativas, entregueA, falhasDefinitivas: [] };
  }
  const tentativas = antes.tentativas + 1;
  const proxima = depoisDaFalha(tentativas, agora);
  if (!proxima.definitiva) {
    return { estado: "pendente", tentativas, proximaTentativa: proxima.proximaTentativa, entregueA, falhasDefinitivas: [] };
  }
  return { estado: entregueA.length > 0 ? "enviada" : "falha", tentativas, entregueA, falhasDefinitivas: [...entrega.falhas] };
}

// Retenção da central ----------------------------------------------------------------------------------------------

/** Por quantos dias a central guarda as Notificações. O banco confere os mesmos limites. */
export const RETENCAO_DA_CENTRAL_MINIMA = 1;
export const RETENCAO_DA_CENTRAL_MAXIMA = 365;
export const RETENCAO_DA_CENTRAL_PADRAO = 30;

/** A configuração das Notificações como o Admin a envia, pronta para gravar, ou o que impede. */
export function lerConfiguracaoDasNotificacoes(entrada: { retencaoDias: string }): { retencao_das_notificacoes_dias: number } | { erro: string } {
  const dias = Number(entrada.retencaoDias);
  if (entrada.retencaoDias.trim() === "" || !Number.isInteger(dias) || dias < RETENCAO_DA_CENTRAL_MINIMA || dias > RETENCAO_DA_CENTRAL_MAXIMA) {
    return { erro: `A central guarda as Notificações por ${RETENCAO_DA_CENTRAL_MINIMA} a ${RETENCAO_DA_CENTRAL_MAXIMA} dias.` };
  }
  return { retencao_das_notificacoes_dias: dias };
}

// Preferências -----------------------------------------------------------------------------------------------------

export type PreferenciasDeNotificacao = { tiposDesligados: TipoDeNotificacao[]; janela: JanelaDeHorario };

export const PREFERENCIAS_PADRAO: PreferenciasDeNotificacao = { tiposDesligados: [], janela: JANELA_PADRAO };

/** O que o formulário de preferências envia: os tipos marcados (recebidos) e a janela, como texto. */
export function lerPreferencias(entrada: { tiposLigados: readonly string[]; inicio: string; fim: string }): PreferenciasDeNotificacao | { erro: string } {
  const janela = lerJanela(entrada.inicio, entrada.fim);
  if ("erro" in janela) return janela;
  return { tiposDesligados: TIPOS_DE_NOTIFICACAO.filter((t) => !entrada.tiposLigados.includes(t)), janela };
}
