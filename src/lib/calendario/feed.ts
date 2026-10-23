import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivelDeAcesso } from "@/dominio/acesso";
import {
  gerarFeed,
  inicioDaJanela,
  type AniversarianteDoFeed,
  type EventoDoFeed,
  type OpcoesDaAssinatura,
} from "@/dominio/assinatura-de-calendario";
import { podeVerAniversarios } from "@/dominio/aniversarios";
import type { Status } from "@/dominio/eventos";
import { envolvidosDoEvento } from "@/dominio/filtros";
import { professoresDaAula } from "@/dominio/professores";
import { nativosDoBanco } from "@/lib/eventos/consultas";
import { hashDoToken } from "./token";

/** Quantas consultas por hora cada endereço aceita, se `FEED_LIMITE_POR_HORA` não disser outro número. */
const LIMITE_PADRAO = 60;

const limiteDeConsultas = () => {
  const configurado = Number(process.env.FEED_LIMITE_POR_HORA);
  return Number.isInteger(configurado) && configurado > 0 ? configurado : LIMITE_PADRAO;
};

export type ResultadoDoFeed = { estado: "ok"; texto: string } | { estado: "invalido" } | { estado: "limite"; espera: number };

type Aberto = { estado: "ok" | "limite" | "invalido"; pessoa_id: string | null; escopo: string | null; categorias: string[] | null; aniversarios: boolean | null; espera: number | null };

/**
 * O feed de um token: o banco confere o hash, a conta e o limite de consultas (`abrir_feed`), e este código busca os
 * Eventos e entrega o texto pronto. Com o cliente de serviço, as políticas por linha não valem; por isso o que cada
 * pessoa pode receber é decidido por `gerarFeed` (o Professor só as aulas dele, aniversários só da Liderança).
 */
export async function montarFeed(servico: SupabaseClient, token: string, agora: Date): Promise<ResultadoDoFeed> {
  const { data, error } = await servico.rpc("abrir_feed", { hash: hashDoToken(token), limite: limiteDeConsultas() });
  if (error) throw new Error(`Não foi possível abrir o feed: ${error.message}`);
  const aberto = (data as Aberto[])[0];
  if (aberto.estado === "limite") return { estado: "limite", espera: aberto.espera ?? 60 };
  if (aberto.estado !== "ok" || !aberto.pessoa_id) return { estado: "invalido" };

  const { data: perfil } = await servico.from("perfis").select("id, nivel, ativo").eq("id", aberto.pessoa_id).single();
  if (!perfil) return { estado: "invalido" };
  const quem = { id: perfil.id as string, nivel: perfil.nivel as NivelDeAcesso, ativo: perfil.ativo as boolean };
  const opcoes: OpcoesDaAssinatura = {
    escopo: aberto.escopo === "meus" ? "meus" : "todos",
    categorias: aberto.categorias ?? [],
    aniversarios: aberto.aniversarios === true,
  };

  const [eventos, aniversariantes] = await Promise.all([
    eventosDoFeed(servico, agora),
    opcoes.aniversarios && podeVerAniversarios(quem) ? aniversariantesDoFeed(servico) : [],
  ]);
  return { estado: "ok", texto: gerarFeed({ quem, opcoes, eventos, aniversariantes, agora }) };
}

type EventoDoBanco = {
  id: string;
  titulo: string;
  numero_da_ocorrencia: number | null;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  local: string;
  status: Status;
  link: string | null;
  responsavel_id: string | null;
  campos: Record<string, unknown>;
  categorias: {
    id: string;
    nativo_local: string;
    nativo_fim: string;
    nativo_observacoes: string;
    nativo_link: string;
    campos_das_categorias: { id: string; nome: string; tipo: string }[];
  };
};

const TAMANHO_DA_PAGINA = 1000;

/**
 * Todas as linhas de uma consulta ordenada, em páginas: o PostgREST devolve no máximo mil por resposta, e cortar o feed
 * em silêncio perderia justamente os Eventos mais futuros.
 */
async function todasAsLinhas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_DA_PAGINA) {
    const { data } = await pagina(de, de + TAMANHO_DA_PAGINA - 1);
    linhas.push(...(data ?? []));
    if ((data?.length ?? 0) < TAMANHO_DA_PAGINA) return linhas;
  }
}

/** Os Eventos que o feed pode mostrar, dos últimos 90 dias em diante; o filtro por pessoa fica com `gerarFeed`. */
async function eventosDoFeed(servico: SupabaseClient, agora: Date): Promise<EventoDoFeed[]> {
  const desde = inicioDaJanela(agora).toISOString();
  const eventos = await todasAsLinhas<EventoDoBanco>((de, ate) =>
    servico
      .from("eventos")
      .select(
        `id, titulo, numero_da_ocorrencia, inicio, fim, dia_inteiro, local, status, link, responsavel_id, campos,
        categorias(id, nativo_local, nativo_fim, nativo_observacoes, nativo_link, campos_das_categorias(id, nome, tipo))`,
      )
      .in("status", ["planejado", "confirmado", "realizado", "adiado"])
      .or(`fim.gte."${desde}",inicio.gte."${desde}"`)
      .order("inicio")
      .order("id")
      .range(de, ate)
      .overrideTypes<EventoDoBanco[], { merge: false }>()
      .throwOnError(),
  );

  return eventos.map((e) => {
    const nativos = nativosDoBanco(e.categorias as Parameters<typeof nativosDoBanco>[0]);
    const definicoes = e.categorias.campos_das_categorias;
    return {
      id: e.id,
      titulo: e.titulo,
      numero: e.numero_da_ocorrencia,
      inicio: new Date(e.inicio),
      // O que a Categoria oculta não vai para o calendário, mesmo que o Evento ainda guarde o valor (ADR 0008).
      fim: e.fim && nativos.fim !== "oculto" ? new Date(e.fim) : null,
      diaInteiro: e.dia_inteiro,
      local: nativos.local === "oculto" ? "" : e.local,
      status: e.status,
      link: nativos.link === "oculto" ? null : e.link,
      categoriaId: e.categorias.id,
      envolvidos: envolvidosDoEvento(e.responsavel_id, e.campos, definicoes),
      professores: professoresDaAula(e.campos, definicoes),
    };
  });
}

/** Adolescentes e líderes ativos com data de nascimento. O feed só usa o primeiro nome e o dia. */
async function aniversariantesDoFeed(servico: SupabaseClient): Promise<AniversarianteDoFeed[]> {
  const [adolescentes, lideres] = await Promise.all([
    todasAsLinhas<{ id: string; nome: string; nascimento: string }>((de, ate) =>
      servico.from("adolescentes").select("id, nome, nascimento").eq("ativo", true).order("id").range(de, ate).throwOnError(),
    ),
    todasAsLinhas<{ id: string; nome: string; data_nascimento: string | null }>((de, ate) =>
      servico.from("perfis").select("id, nome, data_nascimento").in("nivel", ["admin", "lider"]).eq("ativo", true).order("id").range(de, ate).throwOnError(),
    ),
  ]);
  return [
    ...adolescentes,
    ...lideres.flatMap((l) => (l.data_nascimento ? [{ id: l.id, nome: l.nome, nascimento: l.data_nascimento }] : [])),
  ].filter((p) => p.nome.trim() !== "");
}
