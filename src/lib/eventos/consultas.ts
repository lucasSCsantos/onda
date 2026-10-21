import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opcao } from "@/components/formulario";
import type { CategoriaDoEvento, Status } from "@/dominio/eventos";

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
  responsavel: { nome: string } | null;
};

/**
 * Os Eventos em ordem cronológica: todos, ou os que tocam um período (`fim` exclusivo). As políticas por linha
 * decidem quem lê.
 */
export async function eventos(supabase: SupabaseClient, periodo?: { inicio: Date; fim: Date }): Promise<EventoListado[]> {
  let consulta = supabase
    .from("eventos")
    .select(
      "id, titulo, inicio, fim, dia_inteiro, local, status, categorias(nome, cor), responsavel:perfis!eventos_responsavel_id_fkey(nome)",
    );
  if (periodo) {
    const inicio = periodo.inicio.toISOString();
    consulta = consulta.lt("inicio", periodo.fim.toISOString()).or(`fim.gte."${inicio}",inicio.gte."${inicio}"`);
  }
  const { data } = await consulta.order("inicio").overrideTypes<EventoDoBanco[], { merge: false }>();
  return (data ?? []).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    inicio: new Date(e.inicio),
    fim: e.fim ? new Date(e.fim) : null,
    diaInteiro: e.dia_inteiro,
    local: e.local,
    status: e.status,
    categoria: e.categorias,
    responsavel: e.responsavel?.nome ?? null,
  }));
}
