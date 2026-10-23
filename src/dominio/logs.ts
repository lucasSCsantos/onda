import { NOMES_DOS_NIVEIS, type NivelDeAcesso, type Pessoa } from "./acesso";
import type { Celula } from "./csv";
import { diaDe, NOMES_DOS_STATUS, podeEditarEvento, type Status } from "./eventos";
import { dataLocal, horaLocal, meiaNoite, somarDias } from "./fuso";
import { descreverRegra, formatarDia, type RegraDaSerie } from "./series";

// Os logs como a tela de Logs e a exportação os mostram: frases em português, mudanças em linguagem de gente,
// agrupamento por dia, filtros e alertas. O banco grava (supabase/migrations/20261022000000_logs.sql); aqui só se lê.

export const MODULOS = ["contas", "eventos", "adolescentes", "presenca", "ranking", "drive", "administracao"] as const;
export type Modulo = (typeof MODULOS)[number];

export const NOMES_DOS_MODULOS: Record<Modulo, string> = {
  contas: "Contas e acesso",
  eventos: "Eventos",
  adolescentes: "Adolescentes",
  presenca: "Presença",
  ranking: "Ranking",
  drive: "Drive",
  administracao: "Administração",
};

export const RESULTADOS = ["sucesso", "falha"] as const;
export type Resultado = (typeof RESULTADOS)[number];
export const NOMES_DOS_RESULTADOS: Record<Resultado, string> = { sucesso: "Sucesso", falha: "Falha" };

export const SEVERIDADES = ["info", "aviso", "erro"] as const;
export type Severidade = (typeof SEVERIDADES)[number];
export const NOMES_DAS_SEVERIDADES: Record<Severidade, string> = { info: "Informação", aviso: "Aviso", erro: "Erro" };

export type Log = {
  id: number;
  feitoEm: Date;
  /** Nulo: o próprio Mural (agendamento, banco) ou alguém que não entrou. */
  usuarioId: string | null;
  usuarioNome: string | null;
  acao: string;
  modulo: Modulo;
  objetoTipo: string | null;
  objetoId: string | null;
  objetoRotulo: string | null;
  resultado: Resultado;
  severidade: Severidade;
  detalhes: Record<string, unknown>;
  origem: "interface" | "sistema";
};

/** A família visual de um log, que dá o ícone e a cor na linha do tempo. */
export type Visual = "criacao" | "edicao" | "exclusao" | "aprovacao" | "acesso" | "alerta" | "erro";

/** Um pedaço da frase: texto comum ou o objeto da ação, em destaque. */
export type Trecho = string | { destaque: string };

// Valores ----------------------------------------------------------------------

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** "9h" ou "9h30", no fuso do Mural. */
export function horaCurta(instante: Date): string {
  const [h, m] = horaLocal(instante).split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

/** "25/10", ou "25/10/2027" quando o ano não é o de referência. */
function diaCurto(instante: Date, anoDeReferencia: number): string {
  const { ano, mes, dia } = dataLocal(instante);
  return `${doisDigitos(dia)}/${doisDigitos(mes)}${ano === anoDeReferencia ? "" : `/${ano}`}`;
}

/** "25/10, 9h" (ou só "25/10", de dia inteiro): quando é o Evento, para a frase do log. */
export function quandoDoEvento(inicio: Date, diaInteiro: boolean, anoDeReferencia: number): string {
  return diaInteiro ? diaCurto(inicio, anoDeReferencia) : `${diaCurto(inicio, anoDeReferencia)}, ${horaCurta(inicio)}`;
}

const reais = (centavos: number) =>
  `R$ ${Math.trunc(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${doisDigitos(Math.abs(centavos % 100))}`;

const VAZIO = "(vazio)";
const encurtar = (texto: string, limite = 80) => (texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto);

/**
 * Um valor gravado num log, como texto para gente. `tipo` vem do banco: os das colunas do Evento (`instante`,
 * `status`, `booleano`, `pessoa`…) e os dos campos específicos (os de TipoDeCampo).
 */
export function formatarValor(tipo: string, valor: unknown, { diaInteiro = false, ano = 0 } = {}): string {
  if (valor === null || valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0)) return VAZIO;
  switch (tipo) {
    case "instante": {
      const instante = new Date(String(valor));
      if (Number.isNaN(instante.getTime())) return VAZIO;
      return quandoDoEvento(instante, diaInteiro, ano);
    }
    case "status":
      return NOMES_DOS_STATUS[valor as Status] ?? String(valor);
    case "nivel":
      return NOMES_DOS_NIVEIS[valor as NivelDeAcesso] ?? String(valor);
    case "booleano":
      return valor ? "sim" : "não";
    case "valor":
      return typeof valor === "number" ? reais(valor) : String(valor);
    case "data":
      return formatarDia(String(valor));
    case "data_hora": {
      const [dia, hora] = String(valor).split("T");
      return `${formatarDia(dia)} ${hora ?? ""}`.trim();
    }
    case "lista":
      return Array.isArray(valor) ? encurtar(valor.join(", ")) : String(valor);
    case "checklist": {
      if (!Array.isArray(valor)) return String(valor);
      const feitas = valor.filter((item) => typeof item === "object" && item !== null && (item as { feito?: unknown }).feito === true).length;
      return `${valor.length} ${valor.length === 1 ? "tarefa" : "tarefas"}, ${feitas} ${feitas === 1 ? "feita" : "feitas"}`;
    }
    default:
      return typeof valor === "string" ? encurtar(valor.replace(/\s+/g, " ")) : encurtar(JSON.stringify(valor));
  }
}

/** Uma mudança como o banco a grava: rótulo, tipo e os valores; `oculto` diz só que mudou (data de nascimento, e-mail). */
export type Mudanca = { rotulo: string; tipo: string; antes?: unknown; depois?: unknown };

const eMudanca = (m: unknown): m is Mudanca =>
  typeof m === "object" && m !== null && typeof (m as Mudanca).rotulo === "string" && typeof (m as Mudanca).tipo === "string";

/**
 * "Responsável: Mariana → Denize". Um dado oculto só diz que mudou ("Data de nascimento: alterada"). Se o início
 * mudou só de hora, mostra só as horas ("Horário: 9h → 10h").
 */
export function descreverMudanca(mudanca: Mudanca, contexto: { diaInteiro?: boolean; ano?: number } = {}): string {
  if (mudanca.tipo === "oculto") return `${mudanca.rotulo}: alterada`;
  if (mudanca.tipo === "instante" && typeof mudanca.antes === "string" && typeof mudanca.depois === "string") {
    const antes = new Date(mudanca.antes);
    const depois = new Date(mudanca.depois);
    if (!contexto.diaInteiro && diaDe(antes) === diaDe(depois)) {
      const rotulo = mudanca.rotulo === "Início" ? "Horário" : `${mudanca.rotulo} (horário)`;
      return `${rotulo}: ${horaCurta(antes)} → ${horaCurta(depois)}`;
    }
  }
  const formatar = (v: unknown) => formatarValor(mudanca.tipo, v, contexto);
  return `${mudanca.rotulo}: ${formatar(mudanca.antes)} → ${formatar(mudanca.depois)}`;
}

// Ações ---------------------------------------------------------------------------

type Definicao = {
  /** Para o filtro de tipo de ação. */
  nome: string;
  visual: Visual;
  /** O que foi feito, depois do nome de quem fez ("criou o evento …"). */
  feito: (log: Log) => Trecho[];
  /** O que se tentou fazer, para as falhas ("criar o evento"). */
  tentativa: string;
};

const texto = (d: Record<string, unknown>, chave: string) => (typeof d[chave] === "string" ? (d[chave] as string) : "");
const numero = (d: Record<string, unknown>, chave: string) => (typeof d[chave] === "number" ? (d[chave] as number) : 0);
const objeto = (log: Log): Trecho => ({ destaque: log.objetoRotulo || "(sem nome)" });

/** "EBD · A parábola do semeador". */
function eventoDoLog(log: Log): Trecho {
  const categoria = texto(log.detalhes, "categoria");
  const titulo = log.objetoRotulo || "(sem título)";
  return { destaque: categoria ? `${categoria} · ${titulo}` : titulo };
}

/** " (25/10, 9h)", quando o log sabe quando é o Evento. */
function quandoDoLog(log: Log): string {
  const inicio = texto(log.detalhes, "inicio");
  if (!inicio) return "";
  return ` (${quandoDoEvento(new Date(inicio), log.detalhes.dia_inteiro === true, dataLocal(log.feitoEm).ano)})`;
}

/** "Líder (Líder do louvor)" ou só "Professor". */
function acessoDoLog(d: Record<string, unknown>): string {
  const nivel = formatarValor("nivel", d.nivel);
  const funcoes = Array.isArray(d.funcoes) ? (d.funcoes as string[]) : texto(d, "funcao") ? [texto(d, "funcao")] : [];
  return funcoes.length > 0 ? `${nivel} (${funcoes.join(", ")})` : nivel;
}

const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`;

/** Nome legível de cada configuração do Admin; as próximas fases acrescentam as suas. */
export const NOMES_DAS_CONFIGURACOES: Record<string, string> = {
  retencao_dos_logs_meses: "Por quanto tempo guardar os logs",
  lideres_veem_historico_do_evento: "Líderes veem o histórico dos Eventos",
  faltas_para_alerta: "Faltas seguidas para o alerta de ausência",
  retencao_das_notificacoes_dias: "Por quanto tempo guardar as Notificações",
  drive_ligado: "Drive ligado",
  drive_pasta_raiz_id: "Pasta do ministério no Drive",
  drive_categorias: "Categorias com pasta no Drive",
};

const UNIDADES_DAS_CONFIGURACOES: Record<string, [string, string]> = {
  retencao_dos_logs_meses: ["mês", "meses"],
  faltas_para_alerta: ["aula", "aulas"],
  retencao_das_notificacoes_dias: ["dia", "dias"],
};

function valorDaConfiguracao(chave: string, valor: unknown): string {
  const unidade = UNIDADES_DAS_CONFIGURACOES[chave];
  if (typeof valor === "number" && unidade) return plural(valor, unidade[0], unidade[1]);
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (Array.isArray(valor)) return valor.length > 0 ? valor.join(", ") : VAZIO;
  return valor === null || valor === undefined ? VAZIO : String(valor);
}

/** "quem tem mais “Presente”", ou "nenhum" quando o empate divide a posição. */
const desempateDoLog = (marcacao: unknown) =>
  typeof marcacao === "string" && marcacao ? `quem tem mais “${marcacao}”` : "nenhum (o empate divide a posição)";

const NOMES_DAS_TABELAS: Record<string, string> = { eventos: "Eventos", adolescentes: "Adolescentes", usuarios: "Usuários", logs: "Logs" };

const ESCOPOS_DA_SERIE: Record<string, (serie: Trecho, n: number) => Trecho[]> = {
  esta: (s) => ["editou só uma Ocorrência da série ", s],
  esta_e_seguintes: (s, n) => ["editou uma Ocorrência e as seguintes da série ", s, ` (${plural(n, "Ocorrência", "Ocorrências")})`],
  toda: (s, n) => ["editou toda a série ", s, ` (${plural(n, "Ocorrência", "Ocorrências")})`],
  cancelar_futuras: (s, n) => ["cancelou as Ocorrências futuras da série ", s, ` (${plural(n, "Ocorrência", "Ocorrências")})`],
};

export const ACOES: Record<string, Definicao> = {
  // Contas e acesso
  "acesso.login": { nome: "Entrou no Mural", visual: "acesso", feito: () => ["entrou no Mural"], tentativa: "entrar no Mural" },
  "acesso.logout": { nome: "Saiu do Mural", visual: "acesso", feito: () => ["saiu do Mural"], tentativa: "sair do Mural" },
  "acesso.login_falhou": {
    nome: "Tentativa de login com falha",
    visual: "alerta",
    feito: (log) =>
      log.detalhes.conta_existe === false
        ? ["tentou entrar com um e-mail que não tem conta (", objeto(log), ")"]
        : ["tentou entrar na conta de ", objeto(log), " e não conseguiu"],
    tentativa: "entrar no Mural",
  },
  "acesso.senha_pedida": {
    nome: "Recuperação de senha pedida",
    visual: "acesso",
    feito: (log) =>
      log.detalhes.conta_existe === false
        ? ["pediu um link de nova senha para um e-mail que não tem conta (", objeto(log), ")"]
        : ["pediu um link de nova senha para a conta de ", objeto(log)],
    tentativa: "pedir uma nova senha",
  },
  "acesso.senha_redefinida": { nome: "Senha trocada", visual: "acesso", feito: () => ["trocou a própria senha"], tentativa: "trocar a senha" },
  "conta.cadastrada": {
    nome: "Conta cadastrada",
    visual: "criacao",
    feito: (log) => (log.detalhes.nivel === "pendente" ? ["criou uma conta e aguarda aprovação"] : [`criou uma conta como ${acessoDoLog(log.detalhes)}`]),
    tentativa: "criar uma conta",
  },
  "convite.usado": {
    nome: "Convite usado",
    visual: "criacao",
    feito: (log) => [`criou uma conta com um convite, como ${acessoDoLog(log.detalhes)}`],
    tentativa: "criar uma conta com convite",
  },
  "conta.aprovada": {
    nome: "Conta aprovada",
    visual: "aprovacao",
    feito: (log) => ["aprovou a conta de ", objeto(log), ` como ${acessoDoLog(log.detalhes)}`],
    tentativa: "aprovar a conta de",
  },
  "conta.recusada": { nome: "Cadastro recusado", visual: "exclusao", feito: (log) => ["recusou o cadastro de ", objeto(log)], tentativa: "recusar o cadastro de" },
  "conta.nivel_alterado": {
    nome: "Nível de acesso alterado",
    visual: "edicao",
    feito: (log) => [
      "mudou o nível de acesso de ",
      objeto(log),
      ` de ${formatarValor("nivel", log.detalhes.antes)} para ${formatarValor("nivel", log.detalhes.depois)}`,
    ],
    tentativa: "mudar o nível de acesso de",
  },
  "conta.desativada": { nome: "Conta desativada", visual: "exclusao", feito: (log) => ["desativou a conta de ", objeto(log)], tentativa: "desativar a conta de" },
  "conta.reativada": { nome: "Conta reativada", visual: "aprovacao", feito: (log) => ["reativou a conta de ", objeto(log)], tentativa: "reativar a conta de" },
  "conta.editada": { nome: "Dados da conta alterados", visual: "edicao", feito: (log) => ["alterou os dados da conta de ", objeto(log)], tentativa: "alterar a conta de" },
  "conta.excluida": { nome: "Conta apagada", visual: "exclusao", feito: (log) => ["apagou a conta de ", objeto(log)], tentativa: "apagar a conta de" },
  "conta.funcao_adicionada": {
    nome: "Função dada a uma pessoa",
    visual: "edicao",
    feito: (log) => [`deu a Função ${texto(log.detalhes, "funcao")} a `, objeto(log)],
    tentativa: "mudar as Funções de",
  },
  "conta.funcao_removida": {
    nome: "Função tirada de uma pessoa",
    visual: "edicao",
    feito: (log) => [`tirou a Função ${texto(log.detalhes, "funcao")} de `, objeto(log)],
    tentativa: "mudar as Funções de",
  },
  "convite.criado": {
    nome: "Convite gerado",
    visual: "criacao",
    feito: (log) => [`gerou um convite de ${acessoDoLog(log.detalhes)}`],
    tentativa: "gerar um convite",
  },
  "convite.revogado": {
    nome: "Convite revogado",
    visual: "exclusao",
    feito: (log) => [`revogou um convite de ${acessoDoLog(log.detalhes)}`],
    tentativa: "revogar um convite",
  },
  "convite.expirado": {
    nome: "Convite vencido",
    visual: "edicao",
    feito: (log) => [`registrou que um convite de ${acessoDoLog(log.detalhes)} venceu sem ser usado`],
    tentativa: "registrar um convite vencido",
  },

  // Eventos
  "evento.criado": { nome: "Evento criado", visual: "criacao", feito: (log) => ["criou o evento ", eventoDoLog(log), quandoDoLog(log)], tentativa: "criar o evento" },
  "evento.editado": { nome: "Evento editado", visual: "edicao", feito: (log) => ["editou o evento ", eventoDoLog(log), quandoDoLog(log)], tentativa: "editar o evento" },
  "evento.status_alterado": {
    nome: "Status de evento alterado",
    visual: "edicao",
    feito: (log) => {
      const status = (log.detalhes.mudancas as Mudanca[] | undefined)?.find((m) => m.tipo === "status");
      return ["mudou o Status do evento ", eventoDoLog(log), quandoDoLog(log), status ? ` para ${formatarValor("status", status.depois)}` : ""];
    },
    tentativa: "mudar o Status do evento",
  },
  "evento.cancelado": { nome: "Evento cancelado", visual: "exclusao", feito: (log) => ["cancelou o evento ", eventoDoLog(log), quandoDoLog(log)], tentativa: "cancelar o evento" },
  "evento.excluido": { nome: "Evento excluído", visual: "exclusao", feito: (log) => ["excluiu o evento ", eventoDoLog(log), quandoDoLog(log)], tentativa: "excluir o evento" },
  "serie.criada": {
    nome: "Série criada",
    visual: "criacao",
    feito: (log) => ["criou a série ", eventoDoLog(log), `, com ${plural(numero(log.detalhes, "ocorrencias"), "Ocorrência", "Ocorrências")}`],
    tentativa: "criar a série",
  },
  "serie.editada": {
    nome: "Série editada",
    visual: "edicao",
    feito: (log) => (ESCOPOS_DA_SERIE[texto(log.detalhes, "escopo")] ?? ESCOPOS_DA_SERIE.toda)(eventoDoLog(log), numero(log.detalhes, "ocorrencias")),
    tentativa: "editar a série",
  },
  "serie.encerrada": {
    nome: "Série encerrada",
    visual: "exclusao",
    feito: (log) => ["encerrou a série ", eventoDoLog(log), texto(log.detalhes, "encerrada_em") ? ` em ${formatarDia(texto(log.detalhes, "encerrada_em"))}` : ""],
    tentativa: "encerrar a série",
  },
  "serie.excluida": {
    nome: "Série excluída",
    visual: "exclusao",
    feito: (log) => ["excluiu a série ", eventoDoLog(log), ` e as ${plural(numero(log.detalhes, "ocorrencias"), "Ocorrência", "Ocorrências")} dela`],
    tentativa: "excluir a série",
  },

  // Adolescentes
  "adolescente.cadastrado": { nome: "Adolescente cadastrado", visual: "criacao", feito: (log) => ["cadastrou o Adolescente ", objeto(log)], tentativa: "cadastrar o Adolescente" },
  "adolescente.editado": { nome: "Adolescente editado", visual: "edicao", feito: (log) => ["editou o cadastro de ", objeto(log)], tentativa: "editar o cadastro de" },
  "adolescente.inativado": { nome: "Adolescente inativado", visual: "exclusao", feito: (log) => ["inativou o Adolescente ", objeto(log)], tentativa: "inativar o Adolescente" },
  "adolescente.reativado": { nome: "Adolescente reativado", visual: "aprovacao", feito: (log) => ["reativou o Adolescente ", objeto(log)], tentativa: "reativar o Adolescente" },

  // Presença
  "presenca.chamada_registrada": {
    nome: "Chamada registrada",
    visual: "criacao",
    feito: (log) => ["fez a chamada da aula ", eventoDoLog(log), quandoDoLog(log)],
    tentativa: "fazer a chamada da aula",
  },
  "presenca.chamada_corrigida": {
    nome: "Chamada corrigida",
    visual: "edicao",
    feito: (log) => ["corrigiu a chamada de ", { destaque: texto(log.detalhes, "adolescente") || "(sem nome)" }, " na aula ", eventoDoLog(log), quandoDoLog(log)],
    tentativa: "corrigir a chamada da aula",
  },
  "marcacao.criada": {
    nome: "Marcação criada",
    visual: "criacao",
    feito: (log) => ["criou a Marcação ", objeto(log), `, que vale ${plural(numero(log.detalhes, "pontos"), "ponto", "pontos")}`],
    tentativa: "criar a Marcação",
  },
  "marcacao.editada": { nome: "Marcação editada", visual: "edicao", feito: (log) => ["editou a Marcação ", objeto(log)], tentativa: "editar a Marcação" },
  "marcacao.desativada": { nome: "Marcação desativada", visual: "exclusao", feito: (log) => ["desativou a Marcação ", objeto(log)], tentativa: "desativar a Marcação" },
  "marcacao.reativada": { nome: "Marcação reativada", visual: "aprovacao", feito: (log) => ["reativou a Marcação ", objeto(log)], tentativa: "reativar a Marcação" },

  // Ranking
  "ranking.pontuacao_alterada": {
    nome: "Pontuação de Marcação alterada",
    visual: "edicao",
    feito: (log) => [
      "mudou os pontos da Marcação ",
      objeto(log),
      ` de ${plural(numero(log.detalhes, "antes"), "ponto", "pontos")} para ${plural(numero(log.detalhes, "depois"), "ponto", "pontos")}`,
    ],
    tentativa: "mudar os pontos da Marcação",
  },
  "ranking.desempate_alterado": {
    nome: "Desempate do ranking alterado",
    visual: "edicao",
    feito: (log) => [
      `mudou o desempate do ranking de ${desempateDoLog(log.detalhes.antes)} para ${desempateDoLog(log.detalhes.depois)}`,
    ],
    tentativa: "mudar o desempate do ranking",
  },

  // Drive
  "drive.pasta_criada": {
    nome: "Pasta do Evento criada",
    visual: "criacao",
    feito: (log) => ["criou a pasta no Drive do Evento ", eventoDoLog(log)],
    tentativa: "criar a pasta no Drive do Evento",
  },
  "drive.pasta_falhou": {
    nome: "Pasta do Evento não criada",
    visual: "erro",
    feito: (log) => ["não conseguiu criar a pasta no Drive do Evento ", eventoDoLog(log)],
    tentativa: "criar a pasta no Drive do Evento",
  },
  "drive.configuracao_alterada": {
    nome: "Configuração do Drive alterada",
    visual: "edicao",
    feito: (log) => {
      const chave = texto(log.detalhes, "chave");
      return [
        "mudou a configuração ",
        { destaque: NOMES_DAS_CONFIGURACOES[chave] ?? chave },
        ` de ${valorDaConfiguracao(chave, log.detalhes.antes)} para ${valorDaConfiguracao(chave, log.detalhes.depois)}`,
      ];
    },
    tentativa: "mudar a configuração do Drive",
  },

  // Administração
  "funcao.criada": {
    nome: "Função criada",
    visual: "criacao",
    feito: (log) => ["criou a Função ", objeto(log), texto(log.detalhes, "area") ? ` (${texto(log.detalhes, "area")})` : ""],
    tentativa: "criar a Função",
  },
  "funcao.editada": { nome: "Função editada", visual: "edicao", feito: (log) => ["editou a Função ", objeto(log)], tentativa: "editar a Função" },
  "categoria.criada": { nome: "Categoria criada", visual: "criacao", feito: (log) => ["criou a Categoria ", objeto(log)], tentativa: "criar a Categoria" },
  "categoria.editada": { nome: "Categoria editada", visual: "edicao", feito: (log) => ["editou a Categoria ", objeto(log)], tentativa: "editar a Categoria" },
  "categoria.campo_adicionado": {
    nome: "Campo adicionado a uma Categoria",
    visual: "criacao",
    feito: (log) => [`adicionou o campo “${texto(log.detalhes, "campo")}” à Categoria `, objeto(log)],
    tentativa: "adicionar um campo à Categoria",
  },
  "categoria.campo_editado": {
    nome: "Campo de Categoria editado",
    visual: "edicao",
    feito: (log) => [`editou o campo “${texto(log.detalhes, "campo")}” da Categoria `, objeto(log)],
    tentativa: "editar um campo da Categoria",
  },
  "categoria.campo_removido": {
    nome: "Campo removido de uma Categoria",
    visual: "exclusao",
    feito: (log) => [`removeu o campo “${texto(log.detalhes, "campo")}” da Categoria `, objeto(log)],
    tentativa: "remover um campo da Categoria",
  },
  "configuracao.alterada": {
    nome: "Configuração alterada",
    visual: "edicao",
    feito: (log) => {
      const chave = texto(log.detalhes, "chave");
      return [
        "mudou a configuração ",
        { destaque: NOMES_DAS_CONFIGURACOES[chave] ?? chave },
        ` de ${valorDaConfiguracao(chave, log.detalhes.antes)} para ${valorDaConfiguracao(chave, log.detalhes.depois)}`,
      ];
    },
    tentativa: "mudar as configurações",
  },
  "logs.retencao_alterada": {
    nome: "Retenção dos logs alterada",
    visual: "edicao",
    feito: (log) => [
      `mudou por quanto tempo os logs são guardados, de ${valorDaConfiguracao("retencao_dos_logs_meses", log.detalhes.antes)} para ${valorDaConfiguracao("retencao_dos_logs_meses", log.detalhes.depois)}`,
    ],
    tentativa: "mudar a retenção dos logs",
  },
  "logs.limpeza": {
    nome: "Limpeza de logs antigos",
    visual: "exclusao",
    feito: (log) => [
      `apagou ${plural(numero(log.detalhes, "removidos"), "log antigo", "logs antigos")}, com mais de ${valorDaConfiguracao("retencao_dos_logs_meses", log.detalhes.meses)}`,
    ],
    tentativa: "apagar os logs antigos",
  },
  "calendario.gerado": {
    nome: "Assinatura de calendário gerada",
    visual: "criacao",
    feito: () => ["gerou o endereço da própria Assinatura de calendário"],
    tentativa: "gerar a Assinatura de calendário",
  },
  "calendario.regerado": {
    nome: "Assinatura de calendário regerada",
    visual: "edicao",
    feito: () => ["regerou o endereço da própria Assinatura de calendário (o anterior deixou de valer)"],
    tentativa: "regerar a Assinatura de calendário",
  },
  "calendario.opcoes_alteradas": {
    nome: "Opções da Assinatura de calendário alteradas",
    visual: "edicao",
    feito: () => ["mudou as opções da própria Assinatura de calendário"],
    tentativa: "mudar as opções da Assinatura de calendário",
  },
  "calendario.revogado": {
    nome: "Assinatura de calendário revogada",
    visual: "exclusao",
    feito: () => ["revogou a própria Assinatura de calendário"],
    tentativa: "revogar a Assinatura de calendário",
  },
  "push.ativado": {
    nome: "Notificações ativadas em um dispositivo",
    visual: "criacao",
    feito: (log) => ["ativou as Notificações no dispositivo ", { destaque: log.objetoRotulo ?? "sem nome" }],
    tentativa: "ativar as Notificações neste dispositivo",
  },
  "push.desativado": {
    nome: "Notificações desativadas em um dispositivo",
    visual: "exclusao",
    feito: (log) => ["desativou as Notificações no dispositivo ", { destaque: log.objetoRotulo ?? "sem nome" }],
    tentativa: "desativar as Notificações neste dispositivo",
  },
  "push.expirado": {
    nome: "Inscrição de Notificações expirada",
    visual: "exclusao",
    feito: (log) => ["removeu a inscrição expirada do dispositivo ", { destaque: log.objetoRotulo ?? "sem nome" }, " (o serviço de push a recusou)"],
    tentativa: "remover uma inscrição expirada",
  },
  "push.teste_enviado": {
    nome: "Notificação de teste enviada",
    visual: "acesso",
    feito: (log) => [
      `enviou uma Notificação de teste para si mesmo (${plural(numero(log.detalhes, "enviados"), "dispositivo recebeu", "dispositivos receberam")}${numero(log.detalhes, "falhas") > 0 ? `, ${plural(numero(log.detalhes, "falhas"), "falhou", "falharam")}` : ""})`,
    ],
    tentativa: "enviar uma Notificação de teste",
  },
  "notificacao.preferencias_alteradas": {
    nome: "Preferências de Notificações alteradas",
    visual: "edicao",
    feito: (log) => [
      `mudou as próprias preferências de Notificações (janela das ${numero(log.detalhes, "janela_inicio")}h às ${numero(log.detalhes, "janela_fim")}h${Array.isArray(log.detalhes.tipos_desligados) && log.detalhes.tipos_desligados.length > 0 ? `, ${plural(log.detalhes.tipos_desligados.length, "tipo desligado", "tipos desligados")}` : ""})`,
    ],
    tentativa: "mudar as preferências de Notificações",
  },
  "notificacao.simulada": {
    nome: "Notificação simulada (modo de teste)",
    visual: "acesso",
    feito: (log) => [
      `simulou o envio de uma Notificação a ${plural(numero(log.detalhes, "dispositivos"), "dispositivo", "dispositivos")} (modo de teste, nada saiu): `,
      objeto(log),
    ],
    tentativa: "simular o envio de uma Notificação",
  },
  "notificacao.falhou": {
    nome: "Notificação não enviada",
    visual: "acesso",
    feito: (log) => [
      `não conseguiu enviar a Notificação `,
      objeto(log),
      ` a ${plural(numero(log.detalhes, "dispositivos"), "dispositivo", "dispositivos")}, depois de ${plural(numero(log.detalhes, "tentativas"), "tentativa", "tentativas")}`,
    ],
    tentativa: "enviar a Notificação",
  },
  "dados.exportados": {
    nome: "Dados exportados",
    visual: "acesso",
    feito: (log) => ["exportou a tabela ", { destaque: NOMES_DAS_TABELAS[texto(log.detalhes, "tabela")] ?? texto(log.detalhes, "tabela") }, " em CSV"],
    tentativa: "exportar dados",
  },
};

const desconhecida = (acao: string): Definicao => ({
  nome: acao,
  visual: "edicao",
  feito: (log) => [`fez uma ação (${acao})`, ...(log.objetoRotulo ? [" em ", objeto(log)] : [])],
  tentativa: `fazer uma ação (${acao})`,
});

export const definicaoDaAcao = (acao: string): Definicao => ACOES[acao] ?? desconhecida(acao);

/** As ações de um módulo, para o filtro de tipo de ação. */
export const acoesDoModulo = (modulo: Modulo) => Object.keys(ACOES).filter((acao) => moduloDaAcao(acao) === modulo);

/** O módulo pelo prefixo do código. O banco segue a mesma regra (`public.modulo_da_acao`). */
export function moduloDaAcao(acao: string): Modulo {
  const prefixo = acao.split(".")[0];
  if (prefixo === "acesso" || prefixo === "conta" || prefixo === "convite") return "contas";
  if (prefixo === "evento" || prefixo === "serie") return "eventos";
  if (prefixo === "adolescente") return "adolescentes";
  if (prefixo === "presenca" || prefixo === "marcacao") return "presenca";
  if (prefixo === "ranking") return "ranking";
  if (prefixo === "drive") return "drive";
  return "administracao";
}

// Frase, detalhes e alertas ------------------------------------------------------------

/** Quem fez: o nome no momento da ação; "Sistema" para o que o próprio Mural fez; "Alguém" para quem não entrou. */
export function quemFez(log: Log): string {
  if (log.usuarioNome) return log.usuarioNome;
  if (log.usuarioId) return "(sem nome)";
  return log.origem === "sistema" ? "Sistema" : "Alguém";
}

/** A frase do log: "Carol Leal criou o evento *EBD · A parábola do semeador* (25/10, 9h)". */
export function fraseDoLog(log: Log): Trecho[] {
  const definicao = definicaoDaAcao(log.acao);
  // A tentativa de login já é uma falha por natureza: a frase dela diz isso.
  if (log.resultado === "falha" && log.acao !== "acesso.login_falhou") {
    const alvo = log.objetoRotulo ? [" ", log.objetoTipo === "evento" || log.objetoTipo === "serie" ? eventoDoLog(log) : objeto(log)] : [];
    return [quemFez(log), ` tentou ${definicao.tentativa}`, ...alvo, ", mas não conseguiu"];
  }
  return [quemFez(log), " ", ...definicao.feito(log)];
}

/** A frase sem destaques, para o CSV e a busca. */
export const textoDaFrase = (trechos: Trecho[]) => trechos.map((t) => (typeof t === "string" ? t : t.destaque)).join("");

/** O que mudou e o contexto, em linguagem de gente, uma linha por item. Nada de JSON. */
export function detalhesDoLog(log: Log): string[] {
  const d = log.detalhes;
  const linhas: string[] = [];
  const contexto = { diaInteiro: d.dia_inteiro === true, ano: dataLocal(log.feitoEm).ano };
  if (Array.isArray(d.mudancas)) linhas.push(...d.mudancas.filter(eMudanca).map((m) => descreverMudanca(m, contexto)));
  if (log.acao === "serie.criada" && typeof d.regra === "object" && d.regra !== null) {
    try {
      linhas.push(`Repetição: ${descreverRegra(d.regra as RegraDaSerie)}`);
    } catch {
      // Uma regra incompleta (gravada fora da interface) não tem descrição; o resto do log continua legível.
    }
  }
  if (log.acao === "acesso.login_falhou" && numero(d, "tentativas") > 1) {
    linhas.push(`Tentativas na última hora: ${numero(d, "tentativas")}`);
  }
  if (log.acao === "drive.pasta_falhou") {
    linhas.push(`Tentativa ${numero(d, "tentativa")}: ${d.definitiva === true ? "não será refeita" : "será refeita"}`);
    if (texto(d, "erro")) linhas.push(`Motivo: ${texto(d, "erro")}`);
  }
  if (log.acao === "drive.pasta_criada" && d.link_manual === true) {
    linhas.push("O link digitado à mão no Evento foi mantido");
  }
  if (log.acao.startsWith("convite.") && typeof d.expira_em === "string") {
    linhas.push(`Validade: até ${formatarDia(diaDe(new Date(d.expira_em)))}`);
  }
  return linhas;
}

/** Quantas tentativas de login falhas na mesma conta, em uma hora, viram alerta. */
export const TENTATIVAS_PARA_ALERTA = 3;

/** Para a aba "Alertas e erros": o que aconteceu e o que fazer, sem linguagem técnica. `null` para logs comuns. */
export function alertaDoLog(log: Log): { titulo: string; oQueFazer: string } | null {
  if (log.resultado === "sucesso" && log.severidade === "info") return null;
  const d = log.detalhes;
  if (log.acao === "acesso.login_falhou") {
    if (d.conta_existe === false) {
      return {
        titulo: "Alguém tentou entrar com um e-mail que não tem conta no Mural.",
        oQueFazer: "Costuma ser engano de digitação. Se acontecer muitas vezes, pode ser alguém tentando adivinhar contas.",
      };
    }
    if (numero(d, "tentativas") >= TENTATIVAS_PARA_ALERTA) {
      return {
        titulo: `Várias tentativas de login falharam para esta conta (${numero(d, "tentativas")} na última hora).`,
        oQueFazer: "Confirme se é a própria pessoa tentando entrar. Se não for, desative a conta em Usuários e peça para ela trocar a senha.",
      };
    }
    return {
      titulo: "Uma tentativa de entrar com senha errada.",
      oQueFazer: "Costuma ser só erro de digitação. Só merece atenção se repetir muitas vezes.",
    };
  }
  const tentativa = definicaoDaAcao(log.acao).tentativa;
  const alvo = log.objetoRotulo ? ` “${log.objetoRotulo}”` : "";
  if (log.resultado === "falha" && d.codigo === "42501") {
    return {
      titulo: `${quemFez(log)} tentou ${tentativa}${alvo}, mas não tem permissão para isso.`,
      oQueFazer: "Se essa pessoa precisa fazer isso, ajuste o nível de acesso ou as Funções dela em Usuários. Se não precisa, não há nada a fazer.",
    };
  }
  if (log.resultado === "falha") {
    return {
      titulo: `O Mural não conseguiu ${tentativa}${alvo} para ${quemFez(log)}.`,
      oQueFazer: "Peça para a pessoa tentar de novo. Se continuar falhando, avise quem cuida do sistema e mostre o detalhe técnico abaixo.",
    };
  }
  return { titulo: textoDaFrase(fraseDoLog(log)), oQueFazer: "Confira se foi isso mesmo que a pessoa quis fazer." };
}

/** A família visual: falha é erro; aviso é alerta; o resto vem da ação. */
export function visualDoLog(log: Log): Visual {
  if (log.resultado === "falha" && log.acao !== "acesso.login_falhou") return "erro";
  if (log.severidade !== "info") return log.severidade === "erro" ? "erro" : "alerta";
  return definicaoDaAcao(log.acao).visual;
}

/** Para onde o log leva, se o objeto ainda existir (quem chama confere a existência dos Eventos). */
export function linkDoObjeto(log: Log): string | null {
  if (!log.objetoId) return null;
  switch (log.objetoTipo) {
    case "evento":
      return `/eventos/${log.objetoId}`;
    case "adolescente":
      return `/adolescentes/${log.objetoId}`;
    case "conta":
      return "/admin/usuarios";
    case "convite":
      return "/admin/convites";
    case "categoria":
      return `/admin/catalogo/${log.objetoId}`;
    case "funcao":
      return "/admin/catalogo";
    case "configuracao":
      return "/admin/configuracoes";
    case "exportacao":
      return "/admin/exportar";
    case "marcacao":
      return "/admin/marcacoes";
    default:
      return null;
  }
}

/**
 * Quem vê o histórico de um Evento, dentro dele: o Admin, e o líder que pode editá-lo se o Admin ligar a opção.
 * A política de leitura de `public.logs` (`pode_ver_historico`) segue a mesma regra.
 */
export function podeVerHistoricoDoEvento(
  quem: Pessoa,
  areas: readonly string[],
  evento: { categoria: { area: string }; responsavel: string | null },
  lideresVeemHistorico: boolean,
): boolean {
  if (!quem.ativo) return false;
  if (quem.nivel === "admin") return true;
  return lideresVeemHistorico && podeEditarEvento(quem, areas, evento);
}

// Linha do tempo ----------------------------------------------------------------------

/** "Hoje", "Ontem", "20 de outubro" (com o ano, se não for o atual), no fuso do Mural. `dia` é `AAAA-MM-DD`. */
export function rotuloDoDia(dia: string, agora: Date): string {
  const hoje = diaDe(agora);
  if (dia === hoje) return "Hoje";
  if (dia === diaDe(somarDias(agora, -1))) return "Ontem";
  const [ano, mes, d] = dia.split("-").map(Number);
  return `${d} de ${MESES[mes - 1]}${ano === dataLocal(agora).ano ? "" : ` de ${ano}`}`;
}

/** Os logs (já do mais novo ao mais antigo) agrupados por dia no fuso do Mural. */
export function agruparLogsPorDia<L extends { feitoEm: Date }>(logs: L[], agora: Date): { dia: string; rotulo: string; logs: L[] }[] {
  const dias: { dia: string; rotulo: string; logs: L[] }[] = [];
  for (const log of logs) {
    const dia = diaDe(log.feitoEm);
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, rotulo: rotuloDoDia(dia, agora), logs: [] });
    dias.at(-1)!.logs.push(log);
  }
  return dias;
}

// Filtros ----------------------------------------------------------------------------

export const PERIODOS = ["hoje", "7d", "30d", "intervalo"] as const;
export type Periodo = (typeof PERIODOS)[number];
export const NOMES_DOS_PERIODOS: Record<Periodo, string> = { hoje: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", intervalo: "Escolher datas" };

export type FiltrosDosLogs = {
  aba: "atividade" | "alertas";
  periodo: Periodo;
  /** `AAAA-MM-DD`, só no intervalo. */
  de: string;
  ate: string;
  /** Id da conta, ou `sistema` para o que o próprio Mural fez. */
  usuario: string;
  acao: string;
  modulo: Modulo | "";
  resultado: Resultado | "";
  severidade: Severidade | "";
  busca: string;
};

export const FILTROS_PADRAO: FiltrosDosLogs = {
  aba: "atividade",
  periodo: "30d",
  de: "",
  ate: "",
  usuario: "",
  acao: "",
  modulo: "",
  resultado: "",
  severidade: "",
  busca: "",
};

type Parametros = Record<string, string | string[] | undefined>;
const um = (valor: string | string[] | undefined) => (typeof valor === "string" ? valor.trim() : "");
const entre = <T extends string>(valor: string, opcoes: readonly T[]): T | "" => ((opcoes as readonly string[]).includes(valor) ? (valor as T) : "");
const eDia = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T12:00:00Z`));
const eId = (valor: string) => valor === "sistema" || /^[0-9a-f-]{36}$/i.test(valor);

/** Os filtros a partir da URL; o que não for válido é ignorado. */
export function lerFiltrosDosLogs(parametros: Parametros): FiltrosDosLogs {
  const periodo = entre(um(parametros.periodo), PERIODOS) || FILTROS_PADRAO.periodo;
  const de = eDia(um(parametros.de)) ? um(parametros.de) : "";
  const ate = eDia(um(parametros.ate)) ? um(parametros.ate) : "";
  return {
    aba: um(parametros.aba) === "alertas" ? "alertas" : "atividade",
    periodo,
    de: periodo === "intervalo" ? de : "",
    ate: periodo === "intervalo" ? ate : "",
    usuario: eId(um(parametros.usuario)) ? um(parametros.usuario) : "",
    acao: /^[a-z_]+\.[a-z_]+$/.test(um(parametros.acao)) ? um(parametros.acao) : "",
    modulo: entre(um(parametros.modulo), MODULOS),
    resultado: entre(um(parametros.resultado), RESULTADOS),
    severidade: entre(um(parametros.severidade), SEVERIDADES),
    busca: um(parametros.busca).slice(0, 80),
  };
}

/** O intervalo de tempo do filtro: `desde` incluído, `ate` excluído; nulo é sem limite. */
export function intervaloDosLogs(filtros: FiltrosDosLogs, agora: Date): { desde: Date | null; ate: Date | null } {
  const { ano, mes, dia } = dataLocal(agora);
  const hoje = meiaNoite(ano, mes, dia);
  const meiaNoiteDe = (texto: string) => {
    const [a, m, d] = texto.split("-").map(Number);
    return meiaNoite(a, m, d);
  };
  switch (filtros.periodo) {
    case "hoje":
      return { desde: hoje, ate: null };
    case "7d":
      return { desde: somarDias(hoje, -6), ate: null };
    case "30d":
      return { desde: somarDias(hoje, -29), ate: null };
    case "intervalo": {
      const [de, ate] = filtros.de && filtros.ate && filtros.de > filtros.ate ? [filtros.ate, filtros.de] : [filtros.de, filtros.ate];
      return { desde: de ? meiaNoiteDe(de) : null, ate: ate ? somarDias(meiaNoiteDe(ate), 1) : null };
    }
  }
}

/** Os filtros na URL, sem os que estão no padrão. */
export function parametrosDosLogs(filtros: FiltrosDosLogs): [string, string][] {
  return (Object.keys(FILTROS_PADRAO) as (keyof FiltrosDosLogs)[])
    .filter((chave) => filtros[chave] !== FILTROS_PADRAO[chave])
    .map((chave) => [chave, filtros[chave]]);
}

/** Quantos filtros, além do período e da aba, estão ligados (o número no botão de filtros). */
export const contarFiltrosDosLogs = (filtros: FiltrosDosLogs) =>
  (["usuario", "acao", "modulo", "resultado", "severidade"] as const).filter((chave) => filtros[chave] !== "").length;

/** O texto da busca sem os caracteres que a consulta usa como sintaxe; vazio se não sobrar nada. */
export const termoDeBusca = (busca: string) => busca.replace(/[,()*%\\:."']/g, " ").replace(/\s+/g, " ").trim();

// Exportação --------------------------------------------------------------------------

/** O CSV dos logs filtrados, com os mesmos textos da tela; os detalhes vão em linguagem de gente, nunca em JSON. */
export function tabelaDosLogs(logs: Log[]): { cabecalho: string[]; linhas: Celula[][] } {
  return {
    cabecalho: ["Data", "Hora", "Quem", "O que aconteceu", "Detalhes", "Módulo", "Resultado", "Severidade", "Origem"],
    linhas: logs.map((log) => {
      const { ano, mes, dia } = dataLocal(log.feitoEm);
      return [
        `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano}`,
        horaLocal(log.feitoEm),
        quemFez(log),
        textoDaFrase(fraseDoLog(log)),
        detalhesDoLog(log).join(" · "),
        NOMES_DOS_MODULOS[log.modulo] ?? log.modulo,
        NOMES_DOS_RESULTADOS[log.resultado],
        NOMES_DAS_SEVERIDADES[log.severidade],
        log.origem === "sistema" ? "Sistema" : "Interface",
      ];
    }),
  };
}

/** `onda-logs-2026-10-22.csv`. */
export function nomeDoArquivoDosLogs(agora: Date) {
  return `onda-logs-${diaDe(agora)}.csv`;
}
