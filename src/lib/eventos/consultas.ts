import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opcao } from "@/components/formulario";
import { semResponsavel, statusNoMomento, type CategoriaDoEvento, type Evento, type Status } from "@/dominio/eventos";

/** Áreas das Funções de uma pessoa, para saber de quais Categorias ela cria Eventos. */
export async function areasDaPessoa(supabase: SupabaseClient, pessoa: string): Promise<string[]> {
  const { data } = await supabase
    .from("funcoes_das_pessoas")
    .select("funcoes(areas(nome))")
    .eq("pessoa_id", pessoa)
    .overrideTypes<{ funcoes: { areas: { nome: string } } }[], { merge: false }>();
  return (data ?? []).map((f) => f.funcoes.areas.nome);
}

/** Quem pode ser Responsável: a Liderança ativa. */
export async function opcoesDaLideranca(supabase: SupabaseClient): Promise<Opcao[]> {
  const { data } = await supabase.from("perfis").select("id, nome").in("nivel", ["admin", "lider"]).eq("ativo", true).order("nome");
  return (data ?? []).map((p) => ({ valor: p.id as string, texto: (p.nome as string) || "(sem nome)" }));
}

export type CategoriaComArea = CategoriaDoEvento & { id: string; area: string; cor: string };

type CategoriaDoBanco = {
  id: string;
  nome: string;
  cor: string;
  areas: { nome: string };
  campos_das_categorias: CategoriaDoEvento["campos"];
};

const comArea = ({ areas, campos_das_categorias, ...categoria }: CategoriaDoBanco): CategoriaComArea => ({
  ...categoria,
  area: areas.nome,
  campos: campos_das_categorias,
});

const SELECAO_DA_CATEGORIA = "id, nome, cor, areas(nome), campos_das_categorias(id, nome, tipo, obrigatorio, opcoes, ordem)";

export async function categorias(supabase: SupabaseClient): Promise<CategoriaComArea[]> {
  const { data } = await supabase
    .from("categorias")
    .select(SELECAO_DA_CATEGORIA)
    .order("nome")
    .order("ordem", { referencedTable: "campos_das_categorias" })
    .overrideTypes<CategoriaDoBanco[], { merge: false }>();
  return (data ?? []).map(comArea);
}

export async function categoria(supabase: SupabaseClient, id: string): Promise<CategoriaComArea | null> {
  const { data } = await supabase
    .from("categorias")
    .select(SELECAO_DA_CATEGORIA)
    .eq("id", id)
    .order("ordem", { referencedTable: "campos_das_categorias" })
    .maybeSingle()
    .overrideTypes<CategoriaDoBanco, { merge: false }>();
  return data ? comArea(data) : null;
}

export type EventoListado = {
  id: string;
  titulo: string;
  inicio: Date;
  fim: Date | null;
  diaInteiro: boolean;
  local: string;
  status: Status;
  categoria: { nome: string; cor: string };
  responsavel: string | null;
};

type EventoDoBanco = {
  id: string;
  titulo: string;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  local: string;
  status: Status;
  categorias: { nome: string; cor: string };
  responsavel: { nome: string; ativo: boolean } | null;
};

/**
 * Os Eventos em ordem cronológica: todos, ou os que tocam um período (`fim` exclusivo). As políticas por linha
 * decidem quem lê. O Status é o do momento (um Confirmado que terminou já aparece Realizado), e um Responsável
 * desativado num Evento que não terminou aparece como sem Responsável.
 */
export async function eventos(supabase: SupabaseClient, periodo?: { inicio: Date; fim: Date }): Promise<EventoListado[]> {
  let consulta = supabase
    .from("eventos")
    .select(
      "id, titulo, inicio, fim, dia_inteiro, local, status, categorias(nome, cor), responsavel:perfis!eventos_responsavel_id_fkey(nome, ativo)",
    );
  if (periodo) {
    const inicio = periodo.inicio.toISOString();
    consulta = consulta.lt("inicio", periodo.fim.toISOString()).or(`fim.gte."${inicio}",inicio.gte."${inicio}"`);
  }
  const { data } = await consulta.order("inicio").overrideTypes<EventoDoBanco[], { merge: false }>();
  const agora = new Date();
  return (data ?? []).map((e) => {
    const periodo = { inicio: new Date(e.inicio), fim: e.fim ? new Date(e.fim) : null, diaInteiro: e.dia_inteiro };
    return {
      id: e.id,
      titulo: e.titulo,
      ...periodo,
      local: e.local,
      status: statusNoMomento({ ...periodo, status: e.status }, agora),
      categoria: e.categorias,
      responsavel: semResponsavel({ ...periodo, responsavel: e.responsavel }, agora) ? null : e.responsavel!.nome,
    };
  });
}

type PessoaGravada = { id: string; nome: string; ativo: boolean };

export type EventoCompleto = Evento & {
  id: string;
  categoria: CategoriaComArea;
  /** O Responsável gravado, mesmo desativado; `semResponsavel` decide se ele ainda conta. */
  pessoaResponsavel: PessoaGravada | null;
  criadoPor: string;
  criadoEm: Date;
  editadoPor: string | null;
  editadoEm: Date | null;
};

type EventoCompletoDoBanco = Omit<EventoDoBanco, "categorias" | "responsavel"> & {
  responsavel_id: string | null;
  observacoes: string;
  link: string | null;
  campos: Evento["campos"];
  criado_em: string;
  editado_em: string | null;
  categorias: CategoriaDoBanco;
  responsavel: PessoaGravada | null;
  criador: { nome: string };
  editor: { nome: string } | null;
};

/** Um Evento com tudo o que a tela e a edição mostram. O Status é o gravado. */
export async function evento(supabase: SupabaseClient, id: string): Promise<EventoCompleto | null> {
  const { data: e } = await supabase
    .from("eventos")
    .select(
      `id, titulo, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos, criado_em, editado_em,
      categorias(${SELECAO_DA_CATEGORIA}),
      responsavel:perfis!eventos_responsavel_id_fkey(id, nome, ativo),
      criador:perfis!eventos_criado_por_fkey(nome),
      editor:perfis!eventos_editado_por_fkey(nome)`,
    )
    .eq("id", id)
    .order("ordem", { referencedTable: "categorias.campos_das_categorias" })
    .maybeSingle()
    .overrideTypes<EventoCompletoDoBanco, { merge: false }>();
  if (!e) return null;
  return {
    id: e.id,
    titulo: e.titulo,
    inicio: new Date(e.inicio),
    fim: e.fim ? new Date(e.fim) : null,
    diaInteiro: e.dia_inteiro,
    local: e.local,
    responsavel: e.responsavel_id,
    status: e.status,
    observacoes: e.observacoes,
    link: e.link,
    campos: e.campos,
    categoria: comArea(e.categorias),
    pessoaResponsavel: e.responsavel,
    criadoPor: e.criador.nome,
    criadoEm: new Date(e.criado_em),
    editadoPor: e.editor?.nome ?? null,
    editadoEm: e.editado_em ? new Date(e.editado_em) : null,
  };
}

/** Nome e situação de cada pessoa pelo id, para mostrar os campos pessoa. */
export async function pessoas(supabase: SupabaseClient, ids: string[]): Promise<Map<string, PessoaGravada>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("perfis").select("id, nome, ativo").in("id", ids).overrideTypes<PessoaGravada[], { merge: false }>();
  return new Map((data ?? []).map((p) => [p.id, p]));
}
