import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conteudoDaNotificacao,
  desfechoDoEnvio,
  eTipoDeNotificacao,
  JANELA_PADRAO,
  planejarEnvio,
  type EventoDaNotificacao,
} from "@/dominio/notificacoes";
import { entregar, type ConteudoDaNotificacao, type Dispositivo, type EnviadorDePush } from "@/dominio/push";

// A rodada do agendador: reserva as Notificações devidas, decide o que fazer com cada uma (src/dominio/notificacoes.ts) e
// executa. Fala com o banco pela chave de serviço que a rota passa e com o envio pelo adaptador `EnviadorDePush`, que os
// testes trocam por um falso. Não importa `server-only` de propósito: nada aqui guarda segredo, e os testes do banco a usam.

type Reservada = {
  id: string;
  pessoa_id: string;
  tipo: string;
  evento_id: string | null;
  titulo: string | null;
  texto: string | null;
  tag: string | null;
  url: string | null;
  urgente: boolean;
  valida_ate: string;
  tentativas: number;
  entregue_a: string[];
};

type DoBanco = {
  preferencias: { pessoa_id: string; tipos_desligados: string[]; janela_inicio: number; janela_fim: number }[];
  dispositivos: (Dispositivo & { pessoa_id: string })[];
  eventos: {
    id: string;
    titulo: string;
    numero_da_ocorrencia: number | null;
    inicio: string;
    dia_inteiro: boolean;
    local: string;
    categorias: { nome: string } | null;
  }[];
};

export type ResumoDaRodada = {
  reservadas: number;
  enviadas: number;
  novaTentativa: number;
  esperando: number;
  dispensadas: number;
  expiradas: number;
  falhas: number;
  /** Notificações que deram erro inesperado na rodada: voltam sozinhas quando a reserva vencer. */
  erros: number;
};

export type OpcoesDaRodada = {
  enviar: EnviadorDePush;
  /** Modo de teste (dry-run): o envio é o falso e cada Notificação vira um Log "simulada", sem sair nada. */
  simulado?: boolean;
  agora?: Date;
  lote?: number;
};

export async function processarFila(db: SupabaseClient, { enviar, simulado = false, agora = new Date(), lote = 50 }: OpcoesDaRodada): Promise<ResumoDaRodada> {
  const resumo: ResumoDaRodada = { reservadas: 0, enviadas: 0, novaTentativa: 0, esperando: 0, dispensadas: 0, expiradas: 0, falhas: 0, erros: 0 };

  const reservadas = await reservar(db, lote);
  resumo.reservadas = reservadas.length;
  if (reservadas.length === 0) return resumo;

  const dados = await carregar(db, reservadas);

  for (const n of reservadas) {
    try {
      await processarUma(db, n, dados, { enviar, simulado, agora }, resumo);
    } catch (erro) {
      // Só a mensagem: o erro de uma chamada pode citar o endpoint do dispositivo.
      resumo.erros++;
      console.error("agendador de notificações:", erro instanceof Error ? erro.message : "erro desconhecido");
    }
  }
  return resumo;
}

async function reservar(db: SupabaseClient, limite: number): Promise<Reservada[]> {
  const { data, error } = await db.rpc("reservar_notificacoes", { limite });
  if (error) throw new Error(`não foi possível reservar a fila (${error.code ?? "sem código"})`);
  return (data ?? []) as Reservada[];
}

/** Preferências, dispositivos e Eventos de todas as reservadas, em poucas consultas. */
async function carregar(db: SupabaseClient, reservadas: Reservada[]) {
  const pessoas = [...new Set(reservadas.map((n) => n.pessoa_id))];
  const eventos = [...new Set(reservadas.filter((n) => n.titulo === null && n.evento_id).map((n) => n.evento_id as string))];

  const [preferencias, dispositivos, eventosLidos] = await Promise.all([
    db.from("preferencias_de_notificacao").select("pessoa_id, tipos_desligados, janela_inicio, janela_fim").in("pessoa_id", pessoas),
    db.from("inscricoes_de_push").select("id, pessoa_id, endpoint, p256dh, auth").in("pessoa_id", pessoas),
    eventos.length > 0
      ? db.from("eventos").select("id, titulo, numero_da_ocorrencia, inicio, dia_inteiro, local, categorias(nome)").in("id", eventos)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const consulta of [preferencias, dispositivos, eventosLidos]) {
    if (consulta.error) throw new Error(`não foi possível ler os dados da fila (${consulta.error.code ?? "sem código"})`);
  }
  return {
    preferencias: (preferencias.data ?? []) as DoBanco["preferencias"],
    dispositivos: (dispositivos.data ?? []) as unknown as DoBanco["dispositivos"],
    eventos: (eventosLidos.data ?? []) as unknown as DoBanco["eventos"],
  } satisfies DoBanco;
}

function eventoDaNotificacao(e: DoBanco["eventos"][number]): EventoDaNotificacao {
  return {
    id: e.id,
    titulo: e.titulo,
    numero: e.numero_da_ocorrencia,
    inicio: new Date(e.inicio),
    diaInteiro: e.dia_inteiro,
    local: e.local,
    categoria: e.categorias?.nome ?? "",
  };
}

async function processarUma(
  db: SupabaseClient,
  n: Reservada,
  dados: DoBanco,
  { enviar, simulado, agora }: { enviar: EnviadorDePush; simulado: boolean; agora: Date },
  resumo: ResumoDaRodada,
) {
  // Conteúdo: o já gravado, ou o montado agora a partir do Evento. Sem Evento nem texto, não há o que enviar.
  let conteudo: ConteudoDaNotificacao | null = n.titulo && n.texto ? { titulo: n.titulo, texto: n.texto, tag: n.tag ?? "mural", url: n.url ?? "/" } : null;
  if (!conteudo && eTipoDeNotificacao(n.tipo)) {
    const evento = dados.eventos.find((e) => e.id === n.evento_id);
    if (evento) conteudo = conteudoDaNotificacao(n.tipo, eventoDaNotificacao(evento));
  }
  const gravarConteudo = conteudo && n.titulo === null ? { titulo: conteudo.titulo, texto: conteudo.texto, tag: conteudo.tag, url: conteudo.url } : {};

  const preferencias = dados.preferencias.find((p) => p.pessoa_id === n.pessoa_id);
  const dispositivos = dados.dispositivos.filter((d) => d.pessoa_id === n.pessoa_id);
  const plano = conteudo
    ? planejarEnvio(
        { urgente: n.urgente, validaAte: new Date(n.valida_ate), tipo: n.tipo },
        {
          agora,
          janela: preferencias ? { inicio: preferencias.janela_inicio, fim: preferencias.janela_fim } : JANELA_PADRAO,
          tiposDesligados: preferencias?.tipos_desligados ?? [],
          dispositivos: dispositivos.length,
        },
      )
    : ({ acao: "expirar" } as const);

  const atualizar = async (mudancas: Record<string, unknown>) => {
    const { error } = await db.from("notificacoes").update({ ...gravarConteudo, ...mudancas, reservada_ate: null }).eq("id", n.id);
    if (error) throw new Error(`não foi possível atualizar a Notificação (${error.code ?? "sem código"})`);
  };

  switch (plano.acao) {
    case "expirar":
      await atualizar({ estado: "expirada" });
      resumo.expiradas++;
      return;
    case "dispensar":
      await atualizar({ estado: "dispensada" });
      resumo.dispensadas++;
      return;
    case "esperar":
      await atualizar({ proxima_tentativa: plano.ate.toISOString() });
      resumo.esperando++;
      return;
  }

  // Enviar: só aos dispositivos que ainda não receberam, cada um por conta própria.
  const faltam = dispositivos.filter((d) => !n.entregue_a.includes(d.id));
  const entrega = await entregar(faltam, conteudo!, enviar, plano.ttl);

  if (entrega.expirados.length > 0) await db.from("inscricoes_de_push").delete().in("id", entrega.expirados);
  if (entrega.enviados.length > 0 && !simulado) {
    await db.from("inscricoes_de_push").update({ usado_em: agora.toISOString() }).in("id", entrega.enviados);
  }

  const desfecho = desfechoDoEnvio({ tentativas: n.tentativas, entregueA: n.entregue_a }, entrega, agora);
  await atualizar({
    estado: desfecho.estado,
    tentativas: desfecho.tentativas,
    entregue_a: desfecho.entregueA,
    ...(desfecho.proximaTentativa ? { proxima_tentativa: desfecho.proximaTentativa.toISOString() } : {}),
    ...(desfecho.estado === "enviada" ? { enviada_em: agora.toISOString() } : {}),
  });

  if (simulado && entrega.enviados.length > 0) {
    await registrar(db, "notificacao.simulada", conteudo!.titulo, { tipo: n.tipo, dispositivos: entrega.enviados.length, texto: conteudo!.texto });
  }
  if (desfecho.falhasDefinitivas.length > 0) {
    // Nunca o endpoint nem as chaves: só o tipo, a contagem e o desfecho.
    await registrar(
      db,
      "notificacao.falhou",
      conteudo!.titulo,
      { tipo: n.tipo, tentativas: desfecho.tentativas, dispositivos: desfecho.falhasDefinitivas.length, desfecho: desfecho.estado },
      "falha",
      "erro",
    );
  }

  if (desfecho.estado === "pendente") resumo.novaTentativa++;
  else if (desfecho.estado === "enviada") resumo.enviadas++;
  else if (desfecho.estado === "falha") resumo.falhas++;
  else resumo.dispensadas++;
}

async function registrar(
  db: SupabaseClient,
  acao: string,
  rotulo: string,
  detalhes: Record<string, unknown>,
  resultado: "sucesso" | "falha" = "sucesso",
  severidade: "info" | "erro" = "info",
) {
  const { error } = await db.rpc("registrar_log_do_agendador", { acao, rotulo, detalhes, resultado, severidade });
  if (error) console.error(`Log ${acao} não gravado (${error.code ?? "sem código"})`);
}
