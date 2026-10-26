import { fimDaAula, SEM_CHAMADA } from "./cartao-de-chamada";
import { diaDe, tituloDeExibicao, type Status } from "./eventos";
import { dataLocal, horaLocal, meiaNoite, somarDias } from "./fuso";
import { montarConteudo, type ConteudoDaNotificacao } from "./push";

// Notificações: o que se decide sem rede nem banco. Os tipos, o texto curto de cada um, a janela de horário da pessoa,
// as retentativas e o plano de envio de cada item da fila. O banco grava a fila (supabase/migrations/20261023140000_notificacoes.sql)
// e a rota do agendador executa o plano (src/lib/notificacoes/processar.ts).

const HORA = 3_600_000;

export const TIPOS_DE_NOTIFICACAO = [
  "designacao_responsavel",
  "designacao_aula",
  "lembrete_1d",
  "lembrete_2h",
  "evento_alterado",
  "evento_cancelado",
  "resumo_semanal",
  "chamada_pendente",
  "sem_responsavel",
] as const;
export type TipoDeNotificacao = (typeof TIPOS_DE_NOTIFICACAO)[number];

/** Os tipos que falam de um Evento só (o texto sai dele); o resumo semanal reúne vários e traz o texto pronto. */
export type TipoDeEvento = Exclude<TipoDeNotificacao, "resumo_semanal">;

export const NOMES_DOS_TIPOS: Record<TipoDeNotificacao, string> = {
  designacao_responsavel: "Quando me definirem como Responsável por um Evento",
  designacao_aula: "Quando me escalarem como Professor ou Auxiliar de uma aula",
  lembrete_1d: "Primeiro lembrete dos Eventos de que sou Responsável (na véspera)",
  lembrete_2h: "Segundo lembrete dos Eventos de que sou Responsável (perto do início)",
  evento_alterado: "Quando um Evento meu mudar de data, hora ou local",
  evento_cancelado: "Quando um Evento meu for cancelado",
  resumo_semanal: "Resumo da semana, no domingo à noite",
  chamada_pendente: "Quando a aula passar e a Chamada estiver pendente",
  sem_responsavel: "Eventos dos próximos 7 dias sem Responsável",
};

/** Os mesmos tipos em poucas palavras, para a fila da administração. */
export const NOMES_CURTOS_DOS_TIPOS: Record<TipoDeNotificacao, string> = {
  designacao_responsavel: "Designação de Responsável",
  designacao_aula: "Escala em aula",
  lembrete_1d: "Primeiro lembrete",
  lembrete_2h: "Segundo lembrete",
  evento_alterado: "Evento alterado",
  evento_cancelado: "Evento cancelado",
  resumo_semanal: "Resumo da semana",
  chamada_pendente: "Chamada pendente",
  sem_responsavel: "Evento sem Responsável",
};

export const eTipoDeNotificacao = (valor: unknown): valor is TipoDeNotificacao =>
  typeof valor === "string" && (TIPOS_DE_NOTIFICACAO as readonly string[]).includes(valor);

/** O nome curto de um tipo vindo do banco; um tipo que este código não conhece aparece como está. */
export const nomeCurtoDoTipo = (tipo: string) => (eTipoDeNotificacao(tipo) ? NOMES_CURTOS_DOS_TIPOS[tipo] : tipo);

export const eTipoDeEvento = (valor: unknown): valor is TipoDeEvento => eTipoDeNotificacao(valor) && valor !== "resumo_semanal";

/**
 * Quem pode receber cada tipo, pelo nível de acesso: a Liderança e o Professor (só sobre as próprias aulas); o resumo
 * semanal e os alertas de gestão, só a Liderança; os Eventos sem Responsável, só o Admin.
 */
const NIVEIS_DOS_TIPOS: Record<TipoDeNotificacao, readonly string[]> = {
  designacao_responsavel: ["admin", "lider"],
  designacao_aula: ["admin", "lider", "professor"],
  lembrete_1d: ["admin", "lider"],
  lembrete_2h: ["admin", "lider"],
  evento_alterado: ["admin", "lider", "professor"],
  evento_cancelado: ["admin", "lider", "professor"],
  resumo_semanal: ["admin", "lider"],
  chamada_pendente: ["admin", "lider", "professor"],
  sem_responsavel: ["admin"],
};

/** Uma pessoa deste nível de acesso pode receber este tipo? O gatilho `notificar_mudancas` do banco usa as mesmas listas. */
export const recebe = (tipo: TipoDeNotificacao, nivel: string) => NIVEIS_DOS_TIPOS[tipo].includes(nivel);

/** Os tipos que uma pessoa deste nível pode ligar e desligar em "Minha conta". */
export const tiposDoNivel = (nivel: string) => TIPOS_DE_NOTIFICACAO.filter((tipo) => recebe(tipo, nivel));

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

const textoDoEvento = (e: EventoDaNotificacao) => `${tituloDeExibicao(e)} · ${dataEHora(e.inicio, e.diaInteiro)}${localDe(e)}`;

/** Os modelos de texto de cada tipo, curtos e em pt-BR. O título da Notificação diz o que houve; o texto, de que Evento se trata. */
const MODELOS: Record<TipoDeEvento, { titulo: string; texto: (evento: EventoDaNotificacao) => string; tag: string; url: (evento: EventoDaNotificacao) => string }> = {
  designacao_responsavel: { titulo: "Você foi definido(a) como Responsável", texto: textoDoEvento, tag: "designacao_responsavel", url: (e) => `/eventos/${e.id}` },
  designacao_aula: { titulo: "Você foi escalado(a) em uma aula", texto: textoDoEvento, tag: "designacao_aula", url: (e) => `/eventos/${e.id}` },
  // Os dois lembretes de um Evento compartilham a tag: o que chega depois substitui o anterior na tela do aparelho.
  lembrete_1d: { titulo: "Lembrete de Evento", texto: textoDoEvento, tag: "lembrete", url: (e) => `/eventos/${e.id}` },
  lembrete_2h: { titulo: "Seu Evento começa em breve", texto: textoDoEvento, tag: "lembrete", url: (e) => `/eventos/${e.id}` },
  // O cancelamento também substitui um aviso de mudança que ainda esteja na tela.
  evento_alterado: { titulo: "Evento alterado", texto: textoDoEvento, tag: "mudanca", url: (e) => `/eventos/${e.id}` },
  evento_cancelado: { titulo: "Evento cancelado", texto: textoDoEvento, tag: "mudanca", url: (e) => `/eventos/${e.id}` },
  chamada_pendente: {
    titulo: "Chamada pendente",
    texto: (e) => `${tituloDeExibicao(e)} · ${dataEHora(e.inicio, e.diaInteiro)}`,
    tag: "chamada_pendente",
    url: (e) => `/eventos/${e.id}/chamada`,
  },
  sem_responsavel: { titulo: "Evento sem Responsável", texto: textoDoEvento, tag: "sem_responsavel", url: (e) => `/eventos/${e.id}` },
};

/** A tag de um tipo e de um Evento: um aviso novo do mesmo assunto substitui o anterior na tela do aparelho. */
export const tagDaNotificacao = (tipo: TipoDeEvento, eventoId: string) => `${MODELOS[tipo].tag}:${eventoId}`;

/** O conteúdo mínimo que vai ao aparelho e à central: texto curto, `tag` e o caminho do Evento (ou da Chamada). */
export function conteudoDaNotificacao(tipo: TipoDeEvento, evento: EventoDaNotificacao): ConteudoDaNotificacao {
  const modelo = MODELOS[tipo];
  return montarConteudo({
    titulo: modelo.titulo,
    texto: modelo.texto(evento),
    tag: tagDaNotificacao(tipo, evento.id),
    url: modelo.url(evento),
  });
}

/** O resumo da semana: quantos Eventos e os primeiros, na ordem das datas. `janela` é o domingo do resumo (a tag é uma por semana). */
export function conteudoDoResumo(eventos: readonly EventoDaNotificacao[], janela: string): ConteudoDaNotificacao {
  const ordenados = [...eventos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const primeiros = ordenados.slice(0, 2).map((e) => `${tituloDeExibicao(e)} (${dataEHora(e.inicio, e.diaInteiro)})`);
  const resto = ordenados.length - primeiros.length;
  return montarConteudo({
    titulo: "Seus Eventos da semana",
    texto: `${ordenados.length} ${ordenados.length === 1 ? "Evento" : "Eventos"}: ${primeiros.join("; ")}${resto > 0 ? ` e mais ${resto}` : ""}`,
    tag: `resumo_semanal:${janela}`,
    url: "/",
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

/** Abaixo de quantas horas para o início uma mudança ou cancelamento fura a janela de horário. O banco confere os mesmos limites. */
export const LIMITE_DE_URGENCIA_MINIMO = 1;
export const LIMITE_DE_URGENCIA_MAXIMO = 72;
export const LIMITE_DE_URGENCIA_PADRAO = 12;

/**
 * Uma mudança ou cancelamento é urgente se o Evento ainda não começou e começa em menos de `limiteHoras`: a pessoa precisa
 * saber agora, mesmo fora do horário que escolheu. O gatilho `notificar_mudancas` do banco aplica a mesma regra.
 */
export const ehUrgente = (inicio: Date, agora: Date, limiteHoras: number) => {
  const falta = inicio.getTime() - agora.getTime();
  return falta > 0 && falta < limiteHoras * HORA;
};

/** Quantas horas antes do início saem os lembretes. O banco confere os mesmos limites. */
export const LEMBRETE_LONGO_MINIMO = 3;
export const LEMBRETE_LONGO_MAXIMO = 72;
export const LEMBRETE_LONGO_PADRAO = 24;
export const LEMBRETE_CURTO_MINIMO = 1;
export const LEMBRETE_CURTO_MAXIMO = 12;
export const LEMBRETE_CURTO_PADRAO = 2;

/** A hora do domingo em que sai o resumo da semana. */
export const HORA_DO_RESUMO_MINIMA = 0;
export const HORA_DO_RESUMO_MAXIMA = 23;
export const HORA_DO_RESUMO_PADRAO = 19;

/** O que o Admin configura no canal de Notificações, como o planejador o lê. */
export type LembretesConfigurados = { longoHoras: number; curtoHoras: number };

/** O que a tela de administração das Notificações envia, tudo como texto (a caixa de marcar vem como "on" ou vazia). */
export type EntradaDaConfiguracaoDasNotificacoes = {
  canalLigado: string;
  retencaoDias: string;
  limiteDeUrgenciaHoras: string;
  lembreteLongoHoras: string;
  lembreteCurtoHoras: string;
  horaDoResumo: string;
};

export type ConfiguracaoDasNotificacoes = {
  notificacoes_ligadas: boolean;
  retencao_das_notificacoes_dias: number;
  limite_de_urgencia_horas: number;
  lembrete_longo_horas: number;
  lembrete_curto_horas: number;
  hora_do_resumo_semanal: number;
};

function inteiroEntre(texto: string, minimo: number, maximo: number): number | null {
  const n = Number(texto);
  return texto.trim() === "" || !Number.isInteger(n) || n < minimo || n > maximo ? null : n;
}

/** A configuração das Notificações como o Admin a envia, pronta para gravar, ou o que impede. */
export function lerConfiguracaoDasNotificacoes(entrada: EntradaDaConfiguracaoDasNotificacoes): ConfiguracaoDasNotificacoes | { erro: string } {
  const dias = inteiroEntre(entrada.retencaoDias, RETENCAO_DA_CENTRAL_MINIMA, RETENCAO_DA_CENTRAL_MAXIMA);
  if (dias === null) return { erro: `A central guarda as Notificações por ${RETENCAO_DA_CENTRAL_MINIMA} a ${RETENCAO_DA_CENTRAL_MAXIMA} dias.` };
  const urgencia = inteiroEntre(entrada.limiteDeUrgenciaHoras, LIMITE_DE_URGENCIA_MINIMO, LIMITE_DE_URGENCIA_MAXIMO);
  if (urgencia === null) {
    return { erro: `Uma mudança é urgente quando o Evento começa em ${LIMITE_DE_URGENCIA_MINIMO} a ${LIMITE_DE_URGENCIA_MAXIMO} horas.` };
  }
  const longo = inteiroEntre(entrada.lembreteLongoHoras, LEMBRETE_LONGO_MINIMO, LEMBRETE_LONGO_MAXIMO);
  if (longo === null) return { erro: `O primeiro lembrete sai de ${LEMBRETE_LONGO_MINIMO} a ${LEMBRETE_LONGO_MAXIMO} horas antes do Evento.` };
  const curto = inteiroEntre(entrada.lembreteCurtoHoras, LEMBRETE_CURTO_MINIMO, LEMBRETE_CURTO_MAXIMO);
  if (curto === null) return { erro: `O segundo lembrete sai de ${LEMBRETE_CURTO_MINIMO} a ${LEMBRETE_CURTO_MAXIMO} horas antes do Evento.` };
  if (curto >= longo) return { erro: "O segundo lembrete precisa sair depois do primeiro (menos horas antes do Evento)." };
  const hora = inteiroEntre(entrada.horaDoResumo, HORA_DO_RESUMO_MINIMA, HORA_DO_RESUMO_MAXIMA);
  if (hora === null) return { erro: `O resumo da semana sai de ${HORA_DO_RESUMO_MINIMA}h a ${HORA_DO_RESUMO_MAXIMA}h de domingo.` };
  return {
    notificacoes_ligadas: entrada.canalLigado === "on",
    retencao_das_notificacoes_dias: dias,
    limite_de_urgencia_horas: urgencia,
    lembrete_longo_horas: longo,
    lembrete_curto_horas: curto,
    hora_do_resumo_semanal: hora,
  };
}

// Preferências -----------------------------------------------------------------------------------------------------

export type PreferenciasDeNotificacao = { tiposDesligados: TipoDeNotificacao[]; janela: JanelaDeHorario };

export const PREFERENCIAS_PADRAO: PreferenciasDeNotificacao = { tiposDesligados: [], janela: JANELA_PADRAO };

/**
 * O que o formulário de preferências envia: os tipos marcados (recebidos) e a janela, como texto. Só os tipos que o nível
 * de acesso da pessoa pode receber estão no formulário, então só eles podem ficar desligados.
 */
export function lerPreferencias(entrada: { tiposLigados: readonly string[]; inicio: string; fim: string; nivel: string }): PreferenciasDeNotificacao | { erro: string } {
  const janela = lerJanela(entrada.inicio, entrada.fim);
  if ("erro" in janela) return janela;
  return { tiposDesligados: tiposDoNivel(entrada.nivel).filter((t) => !entrada.tiposLigados.includes(t)), janela };
}

// O que está devido agora ------------------------------------------------------------------------------------------

/** Quem pode receber, como o planejador precisa: o nível, se a conta está ativa e os tipos que a pessoa desligou. */
export type PessoaDoPlano = { id: string; nivel: string; ativo: boolean; tiposDesligados: readonly string[] };

/** O Evento como o planejador o lê: o do texto, mais o que decide quem é avisado e quando. */
export type EventoDoPlano = EventoDaNotificacao & {
  fim: Date | null;
  status: Status;
  responsavelId: string | null;
  /** Os ids do Professor e do Auxiliar da aula. */
  professores: readonly string[];
  temChamada: boolean;
  /** Já tem ao menos uma presença marcada. */
  chamadaFeita: boolean;
};

/** Uma Notificação devida, pronta para entrar na fila: a chave única é (tipo, Evento, pessoa, janela). */
export type NotificacaoDevida = {
  tipo: TipoDeNotificacao;
  eventoId: string | null;
  pessoaId: string;
  janela: string;
  validaAte: Date;
  /** Só onde o texto não sai de um Evento só (o resumo semanal): os demais são montados na hora do envio. */
  conteudo?: ConteudoDaNotificacao;
};

const COM_LEMBRETE: readonly Status[] = ["planejado", "confirmado"];
const SEM_ALERTA_DE_RESPONSAVEL: readonly Status[] = ["cancelado", "realizado", "adiado"];

/** O último domingo à `hora` (no fuso do Mural; às 19h por padrão) que já passou: a hora do resumo da semana. */
export function ultimoResumoSemanal(agora: Date, hora = HORA_DO_RESUMO_PADRAO): Date {
  const { ano, mes, dia, diaDaSemana } = dataLocal(agora);
  const domingo = somarDias(meiaNoite(ano, mes, dia), -diaDaSemana).getTime() + hora * HORA;
  return new Date(domingo > agora.getTime() ? domingo - 7 * 24 * HORA : domingo);
}

/**
 * Tudo o que está devido neste instante; a chave única do banco descarta quem já recebeu. As janelas das chaves: lembretes,
 * o início do Evento (se ele muda de hora, vale um lembrete novo); resumo, o domingo; os demais, uma vez por Evento e
 * pessoa. Cada tipo respeita o nível de acesso e o interruptor da pessoa. A designação e a mudança ou cancelamento não
 * passam por aqui: nascem de gatilhos do banco, no instante da alteração.
 */
export function notificacoesDevidas({
  agora,
  eventos,
  pessoas,
  janelaDaChamadaDias,
  lembretes = { longoHoras: LEMBRETE_LONGO_PADRAO, curtoHoras: LEMBRETE_CURTO_PADRAO },
  horaDoResumo = HORA_DO_RESUMO_PADRAO,
}: {
  agora: Date;
  eventos: readonly EventoDoPlano[];
  pessoas: readonly PessoaDoPlano[];
  janelaDaChamadaDias: number;
  lembretes?: LembretesConfigurados;
  horaDoResumo?: number;
}): NotificacaoDevida[] {
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const devidas: NotificacaoDevida[] = [];
  const agoraMs = agora.getTime();

  const avisar = (
    tipo: TipoDeNotificacao,
    pessoaId: string | null,
    evento: EventoDoPlano | null,
    janela: string,
    validaAte: Date,
    conteudo?: ConteudoDaNotificacao,
  ) => {
    const pessoa = pessoaId ? porId.get(pessoaId) : undefined;
    if (!pessoa || !pessoa.ativo || !recebe(tipo, pessoa.nivel) || pessoa.tiposDesligados.includes(tipo)) return;
    devidas.push({ tipo, eventoId: evento?.id ?? null, pessoaId: pessoa.id, janela, validaAte, ...(conteudo ? { conteudo } : {}) });
  };

  const admins = pessoas.filter((p) => p.nivel === "admin");

  for (const e of eventos) {
    const falta = e.inicio.getTime() - agoraMs;

    // Lembretes, só de quem é Responsável. Um Evento de dia inteiro começa à meia-noite: o lembrete curto cairia na véspera à noite.
    if (COM_LEMBRETE.includes(e.status) && falta > 0) {
      const marca = String(Math.floor(e.inicio.getTime() / 60_000));
      if (!e.diaInteiro && falta <= lembretes.curtoHoras * HORA) {
        avisar("lembrete_2h", e.responsavelId, e, marca, e.inicio);
      } else if (falta <= lembretes.longoHoras * HORA) {
        // Depois do lembrete curto, o longo seria atrasado e enganoso; o curto o substitui.
        avisar("lembrete_1d", e.responsavelId, e, marca, e.diaInteiro ? e.inicio : new Date(e.inicio.getTime() - lembretes.curtoHoras * HORA));
      }
    }

    // Eventos dos próximos 7 dias sem Responsável (nem um Responsável com a conta desativada), para o Admin.
    const responsavel = e.responsavelId ? porId.get(e.responsavelId) : undefined;
    if (!SEM_ALERTA_DE_RESPONSAVEL.includes(e.status) && falta > 0 && falta <= 7 * 24 * HORA && !responsavel?.ativo) {
      for (const admin of admins) avisar("sem_responsavel", admin.id, e, "", e.inicio);
    }

    // Chamada pendente: a aula já passou e ninguém marcou presença, enquanto o cartão ainda está à vista.
    if (
      e.temChamada &&
      !SEM_CHAMADA.includes(e.status) &&
      !e.chamadaFeita &&
      fimDaAula(e).getTime() <= agoraMs &&
      diaDe(e.inicio) >= diaDe(somarDias(agora, -janelaDaChamadaDias))
    ) {
      for (const professor of e.professores) avisar("chamada_pendente", professor, e, "", new Date(agoraMs + 24 * HORA));
    }
  }

  // Resumo semanal: do domingo às 19h até as 19h de segunda, com os Eventos da semana seguinte de cada pessoa.
  const resumoDe = ultimoResumoSemanal(agora, horaDoResumo);
  if (agoraMs - resumoDe.getTime() < 24 * HORA) {
    const { ano, mes, dia } = dataLocal(resumoDe);
    const segunda = somarDias(meiaNoite(ano, mes, dia), 1).getTime();
    const janela = diaDe(resumoDe);
    for (const pessoa of pessoas) {
      const dela = eventos.filter(
        (e) =>
          // Rascunho, Cancelado e Adiado não entram no resumo (os mesmos Status que não pedem Chamada).
          !SEM_CHAMADA.includes(e.status) &&
          e.inicio.getTime() >= segunda &&
          e.inicio.getTime() < segunda + 7 * 24 * HORA &&
          (e.responsavelId === pessoa.id || e.professores.includes(pessoa.id)),
      );
      if (dela.length > 0) avisar("resumo_semanal", pessoa.id, null, janela, new Date(resumoDe.getTime() + 24 * HORA), conteudoDoResumo(dela, janela));
    }
  }

  return devidas;
}

// O motivo do aviso ainda vale? ------------------------------------------------------------------------------------

/** Como o Evento está na hora do envio, o que decide se o motivo de um aviso que esperou (a janela, uma nova tentativa) ainda vale. */
export type SituacaoDoEvento = { status: Status; inicio: Date; responsavelAtivo: boolean; chamadaFeita: boolean };

/**
 * Um aviso pode esperar horas na fila (a janela de horário, uma nova tentativa). Antes de enviar, confere se o motivo ainda
 * vale: um lembrete de Evento cancelado ou uma Chamada pendente que já foi feita seriam avisos enganosos. A designação e o
 * resumo semanal não passam por aqui: o primeiro vale sempre que o Evento existe; o segundo já traz o texto pronto.
 */
export function aindaVale(tipo: TipoDeEvento, e: SituacaoDoEvento, agora: Date): boolean {
  const futuro = e.inicio.getTime() > agora.getTime();
  switch (tipo) {
    case "lembrete_1d":
    case "lembrete_2h":
      return COM_LEMBRETE.includes(e.status) && futuro;
    case "evento_alterado":
      return COM_LEMBRETE.includes(e.status);
    case "evento_cancelado":
      return e.status === "cancelado";
    case "sem_responsavel":
      return !SEM_ALERTA_DE_RESPONSAVEL.includes(e.status) && !e.responsavelAtivo;
    case "chamada_pendente":
      return !SEM_CHAMADA.includes(e.status) && !e.chamadaFeita;
    default:
      return true;
  }
}
