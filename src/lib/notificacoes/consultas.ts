import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  conteudoDaNotificacao,
  eTipoDeEvento,
  PREFERENCIAS_PADRAO,
  TIPOS_DE_NOTIFICACAO,
  type EstadoDaNotificacao,
  type PreferenciasDeNotificacao,
} from "@/dominio/notificacoes";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** As preferências de quem está logado; sem linha, o padrão (todos os tipos, das 8h às 21h). */
export async function preferenciasDe(supabase: SupabaseClient, pessoa: string): Promise<PreferenciasDeNotificacao> {
  const { data } = await supabase
    .from("preferencias_de_notificacao")
    .select("tipos_desligados, janela_inicio, janela_fim")
    .eq("pessoa_id", pessoa)
    .maybeSingle();
  if (!data) return PREFERENCIAS_PADRAO;
  return {
    tiposDesligados: TIPOS_DE_NOTIFICACAO.filter((t) => (data.tipos_desligados as string[]).includes(t)),
    janela: { inicio: data.janela_inicio, fim: data.janela_fim },
  };
}

/** Quantas Notificações de quem está logado ainda não foram lidas, para o indicador do menu. Sem sessão ou com erro, zero. */
export async function naoLidasDeQuemEstaLogado(): Promise<number> {
  try {
    const supabase = await supabaseDoServidor();
    const { count } = await supabase.from("notificacoes").select("id", { count: "exact", head: true }).is("lida_em", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type ItemDaCentral = {
  id: string;
  titulo: string;
  texto: string;
  /** O Evento, ou a página que a Notificação abre. */
  url: string | null;
  lida: boolean;
  criadaEm: Date;
  estado: EstadoDaNotificacao;
};

type LinhaDaCentral = {
  id: string;
  tipo: string;
  titulo: string | null;
  texto: string | null;
  url: string | null;
  estado: EstadoDaNotificacao;
  lida_em: string | null;
  criada_em: string;
  eventos: {
    id: string;
    titulo: string;
    numero_da_ocorrencia: number | null;
    inicio: string;
    dia_inteiro: boolean;
    local: string;
    categorias: { nome: string } | null;
  } | null;
};

/**
 * As Notificações da pessoa, da mais nova à mais antiga. Enquanto o agendador não gravou o texto, ele é montado aqui com o
 * mesmo modelo, a partir do Evento: a central nunca fica vazia só porque o envio ainda não rodou.
 */
export async function notificacoesDaPessoa(supabase: SupabaseClient, limite = 100): Promise<ItemDaCentral[]> {
  const { data } = await supabase
    .from("notificacoes")
    .select(
      "id, tipo, titulo, texto, url, estado, lida_em, criada_em, eventos(id, titulo, numero_da_ocorrencia, inicio, dia_inteiro, local, categorias(nome))",
    )
    .order("criada_em", { ascending: false })
    .limit(limite)
    .overrideTypes<LinhaDaCentral[], { merge: false }>();
  return (data ?? []).map((n) => {
    const evento = n.eventos;
    const montado =
      n.titulo === null && evento && eTipoDeEvento(n.tipo)
        ? conteudoDaNotificacao(n.tipo, {
            id: evento.id,
            titulo: evento.titulo,
            numero: evento.numero_da_ocorrencia,
            inicio: new Date(evento.inicio),
            diaInteiro: evento.dia_inteiro,
            local: evento.local,
            categoria: evento.categorias?.nome ?? "",
          })
        : null;
    return {
      id: n.id,
      titulo: n.titulo ?? montado?.titulo ?? "Notificação",
      texto: n.texto ?? montado?.texto ?? "",
      url: n.url ?? montado?.url ?? null,
      lida: n.lida_em !== null,
      criadaEm: new Date(n.criada_em),
      estado: n.estado,
    };
  });
}
