import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opcao } from "@/components/formulario";
import type { NativosDaCategoria } from "@/dominio/campos-nativos";
import { envolvidosDoEvento } from "@/dominio/filtros";
import { semResponsavel, statusNoMomento, tituloDeExibicao, type CategoriaDoEvento, type Evento, type Status } from "@/dominio/eventos";
import { professoresDaAula, semProfessor } from "@/dominio/professores";
import type { OcorrenciaGravada, RegraDaSerie } from "@/dominio/series";

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

/** Quem pode ser Professor ou Auxiliar além da Liderança: os Professores ativos. */
export async function opcoesDeProfessores(supabase: SupabaseClient): Promise<Opcao[]> {
  const { data } = await supabase.from("perfis").select("id, nome").eq("nivel", "professor").eq("ativo", true).order("nome");
  return (data ?? []).map((p) => ({ valor: p.id as string, texto: `${(p.nome as string) || "(sem nome)"} (Professor)` }));
}

export type CategoriaComArea = CategoriaDoEvento & { id: string; area: string; cor: string; temChamada: boolean };

/** As colunas da configuração dos campos comuns, como o banco as devolve. */
type NativosDoBanco = {
  nativo_local: NativosDaCategoria["local"];
  nativo_fim: NativosDaCategoria["fim"];
  nativo_observacoes: NativosDaCategoria["observacoes"];
  nativo_link: NativosDaCategoria["link"];
};

/** A configuração dos campos comuns de uma linha de `categorias`. */
export const nativosDoBanco = (c: NativosDoBanco): NativosDaCategoria => ({
  local: c.nativo_local,
  fim: c.nativo_fim,
  observacoes: c.nativo_observacoes,
  link: c.nativo_link,
});

const COLUNAS_DOS_NATIVOS = "nativo_local, nativo_fim, nativo_observacoes, nativo_link";

type CategoriaDoBanco = NativosDoBanco & {
  id: string;
  nome: string;
  cor: string;
  tem_chamada: boolean;
  areas: { nome: string };
  campos_das_categorias: CategoriaDoEvento["campos"];
};

const comArea = ({ areas, campos_das_categorias, tem_chamada, ...categoria }: CategoriaDoBanco): CategoriaComArea => ({
  id: categoria.id,
  nome: categoria.nome,
  cor: categoria.cor,
  temChamada: tem_chamada,
  area: areas.nome,
  campos: campos_das_categorias,
  nativos: nativosDoBanco(categoria),
});

const SELECAO_DA_CATEGORIA = `id, nome, cor, tem_chamada, ${COLUNAS_DOS_NATIVOS}, areas(nome), campos_das_categorias(id, nome, tipo, obrigatorio, opcoes, ordem)`;

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
  categoriaId: string;
  area: string;
  /** Ids do Responsável, do Professor e do Auxiliar, para o filtro "meus eventos". */
  envolvidos: string[];
  /** A Categoria tem a vaga de Professor e ela está vazia (alerta de aula sem Professor). */
  semProfessor: boolean;
  /** Ids do Professor e do Auxiliar da aula (os campos pessoa com esses nomes). */
  professores: string[];
  /** A Categoria faz Chamada (como a EBD). */
  temChamada: boolean;
};

type EventoDoBanco = {
  id: string;
  titulo: string;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  local: string;
  status: Status;
  responsavel_id: string | null;
  numero_da_ocorrencia: number | null;
  campos: Evento["campos"];
  categorias: NativosDoBanco & {
    id: string;
    nome: string;
    cor: string;
    tem_chamada: boolean;
    areas: { nome: string };
    campos_das_categorias: { id: string; nome: string; tipo: string }[];
  };
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
      `id, titulo, numero_da_ocorrencia, inicio, fim, dia_inteiro, local, status, responsavel_id, campos,
      categorias(id, nome, cor, tem_chamada, ${COLUNAS_DOS_NATIVOS}, areas(nome), campos_das_categorias(id, nome, tipo)),
      responsavel:perfis!eventos_responsavel_id_fkey(nome, ativo)`,
    );
  if (periodo) {
    const inicio = periodo.inicio.toISOString();
    consulta = consulta.lt("inicio", periodo.fim.toISOString()).or(`fim.gte."${inicio}",inicio.gte."${inicio}"`);
  }
  const { data } = await consulta.order("inicio").overrideTypes<EventoDoBanco[], { merge: false }>();
  const agora = new Date();
  return (data ?? []).map((e) => {
    const periodo = { inicio: new Date(e.inicio), fim: e.fim ? new Date(e.fim) : null, diaInteiro: e.dia_inteiro };
    const nativos = nativosDoBanco(e.categorias);
    return {
      id: e.id,
      titulo: tituloDeExibicao({ titulo: e.titulo, numero: e.numero_da_ocorrencia }),
      // O que a Categoria oculta não aparece em cartão nenhum, mesmo que o Evento ainda guarde o valor (ADR 0008);
      // o Status continua pelo período gravado.
      ...periodo,
      fim: nativos.fim === "oculto" ? null : periodo.fim,
      local: nativos.local === "oculto" ? "" : e.local,
      status: statusNoMomento({ ...periodo, status: e.status }, agora),
      categoria: { nome: e.categorias.nome, cor: e.categorias.cor },
      responsavel: semResponsavel({ ...periodo, responsavel: e.responsavel }, agora) ? null : e.responsavel!.nome,
      categoriaId: e.categorias.id,
      area: e.categorias.areas.nome,
      envolvidos: envolvidosDoEvento(e.responsavel_id, e.campos, e.categorias.campos_das_categorias),
      semProfessor: semProfessor(e.campos, e.categorias.campos_das_categorias),
      professores: professoresDaAula(e.campos, e.categorias.campos_das_categorias),
      temChamada: e.categorias.tem_chamada,
    };
  });
}

type PessoaGravada = { id: string; nome: string; ativo: boolean };

export type EventoCompleto = Evento & {
  id: string;
  /** "Título · número" nas Ocorrências de Série; o `titulo` é o digitado, para a edição. */
  tituloDeExibicao: string;
  categoria: CategoriaComArea;
  /** O Responsável gravado, mesmo desativado; `semResponsavel` decide se ele ainda conta. */
  pessoaResponsavel: PessoaGravada | null;
  /** A Série de que o Evento é Ocorrência, e se foi editado individualmente. */
  serieId: string | null;
  editada: boolean;
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
  serie_id: string | null;
  editada: boolean;
  categorias: CategoriaDoBanco;
  responsavel: PessoaGravada | null;
  /** Nulo para o Professor, que não lê as outras contas. */
  criador: { nome: string } | null;
  editor: { nome: string } | null;
};

/** Um Evento com tudo o que a tela e a edição mostram. O Status é o gravado. */
export async function evento(supabase: SupabaseClient, id: string): Promise<EventoCompleto | null> {
  const { data: e } = await supabase
    .from("eventos")
    .select(
      `id, titulo, numero_da_ocorrencia, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos, criado_em, editado_em, serie_id, editada,
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
    numero: e.numero_da_ocorrencia,
    tituloDeExibicao: tituloDeExibicao({ titulo: e.titulo, numero: e.numero_da_ocorrencia }),
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
    serieId: e.serie_id,
    editada: e.editada,
    pessoaResponsavel: e.responsavel,
    criadoPor: e.criador?.nome ?? "",
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

/**
 * Nome e situação do Responsável, do Professor e do Auxiliar de um Evento que quem olha enxerga. É o caminho do
 * Professor, que não lê as outras contas (e-mail e data de nascimento são da Liderança).
 */
export async function pessoasDaAula(supabase: SupabaseClient, eventoId: string): Promise<Map<string, PessoaGravada>> {
  const { data } = await supabase.rpc("pessoas_da_aula", { evento: eventoId });
  return new Map(((data ?? []) as PessoaGravada[]).map((p) => [p.id, p]));
}

export type SerieCompleta = {
  id: string;
  regra: RegraDaSerie;
  /** Dia em que a Série foi encerrada, `AAAA-MM-DD`. */
  encerradaEm: string | null;
  ocorrencias: OcorrenciaGravada[];
};

type OcorrenciaDoBanco = Omit<EventoCompletoDoBanco, "categorias" | "responsavel" | "criador" | "editor" | "criado_em" | "editado_em"> & {
  responsavel_id: string | null;
};

/** Uma Série com todas as Ocorrências, em ordem cronológica, para a edição em série. */
export async function serie(supabase: SupabaseClient, id: string): Promise<SerieCompleta | null> {
  const { data: s } = await supabase
    .from("series")
    .select("id, regra, encerrada_em")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<{ id: string; regra: RegraDaSerie; encerrada_em: string | null }, { merge: false }>();
  if (!s) return null;

  const { data } = await supabase
    .from("eventos")
    .select("id, titulo, numero_da_ocorrencia, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos, editada")
    .eq("serie_id", id)
    .order("inicio")
    .overrideTypes<OcorrenciaDoBanco[], { merge: false }>();

  return {
    id: s.id,
    regra: s.regra,
    encerradaEm: s.encerrada_em,
    ocorrencias: (data ?? []).map((e) => ({
      id: e.id,
      editada: e.editada,
      evento: {
        titulo: e.titulo,
        numero: e.numero_da_ocorrencia,
        inicio: new Date(e.inicio),
        fim: e.fim ? new Date(e.fim) : null,
        diaInteiro: e.dia_inteiro,
        local: e.local,
        responsavel: e.responsavel_id,
        status: e.status,
        observacoes: e.observacoes,
        link: e.link,
        campos: e.campos,
      },
    })),
  };
}
