import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tituloDeExibicao } from "@/dominio/eventos";
import type { AulaComChamada, IconeDeMarcacao, Marcacao, PresencaNaAula } from "@/dominio/presenca";

type MarcacaoDoBanco = {
  id: string;
  nome: string;
  icone: IconeDeMarcacao;
  pontos: number;
  ativa: boolean;
  conta_presenca: boolean;
  pede_visitante: boolean;
  ordem: number;
};

/** As Marcações do cadastro, na ordem da Chamada (ativas e desativadas: o histórico usa as duas). */
export async function marcacoes(supabase: SupabaseClient): Promise<Marcacao[]> {
  const { data } = await supabase
    .from("marcacoes")
    .select("id, nome, icone, pontos, ativa, conta_presenca, pede_visitante, ordem")
    .order("ordem")
    .order("nome")
    .overrideTypes<MarcacaoDoBanco[], { merge: false }>();
  return (data ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    icone: m.icone,
    pontos: m.pontos,
    ativa: m.ativa,
    contaPresenca: m.conta_presenca,
    pedeVisitante: m.pede_visitante,
    ordem: m.ordem,
  }));
}

type PresencaDoBanco = {
  adolescente_id: string;
  marcacoes_das_presencas: { marcacao_id: string; visitante: string | null }[];
};

const daPresenca = (p: PresencaDoBanco): PresencaNaAula => ({
  adolescente: p.adolescente_id,
  marcacoes: p.marcacoes_das_presencas.map((m) => m.marcacao_id),
  visitante: p.marcacoes_das_presencas.find((m) => m.visitante)?.visitante ?? null,
});

/** A Chamada de uma aula: as Marcações de cada Adolescente que já tem alguma. */
export async function chamadaDaAula(supabase: SupabaseClient, eventoId: string): Promise<PresencaNaAula[]> {
  const { data } = await supabase
    .from("presencas")
    .select("adolescente_id, marcacoes_das_presencas(marcacao_id, visitante)")
    .eq("evento_id", eventoId)
    .overrideTypes<PresencaDoBanco[], { merge: false }>();
  return (data ?? []).map(daPresenca);
}

/**
 * Das aulas dadas, as ids com Chamada feita (ao menos uma presença). O banco só responde sobre as aulas cuja Chamada a
 * pessoa pode fazer, sem ler presenças nem Adolescentes: serve ao Professor e ao Auxiliar.
 */
export async function chamadasFeitas(supabase: SupabaseClient, aulas: readonly string[]): Promise<Set<string>> {
  if (aulas.length === 0) return new Set();
  const { data } = await supabase.rpc("chamadas_feitas", { eventos: aulas });
  return new Set((data ?? []) as string[]);
}

/** Os Adolescentes do cadastro (ativos e inativos), com quando foram cadastrados, em ordem de nome. */
export async function adolescentes(supabase: SupabaseClient): Promise<{ id: string; nome: string; ativo: boolean; criadoEm: Date }[]> {
  const { data } = await supabase
    .from("adolescentes")
    .select("id, nome, ativo, criado_em")
    .order("nome")
    .overrideTypes<{ id: string; nome: string; ativo: boolean; criado_em: string }[], { merge: false }>();
  return (data ?? []).map((a) => ({ id: a.id, nome: a.nome, ativo: a.ativo, criadoEm: new Date(a.criado_em) }));
}

type PresencaComAulaDoBanco = PresencaDoBanco & {
  evento_id: string;
  eventos: { id: string; titulo: string; numero_da_ocorrencia: number | null; inicio: string; categorias: { nome: string } };
};

export type PresencasDoPeriodo = {
  /** As aulas com Chamada feita no período (ao menos uma presença), não Canceladas. */
  aulas: (AulaComChamada & { categoria: string })[];
  /** De cada aula, a presença de cada Adolescente. */
  porAula: Map<string, PresencaNaAula[]>;
};

// O PostgREST devolve no máximo 1000 linhas por pedido.
const PAGINA = 1000;

/**
 * As presenças das aulas de um período (`desde` incluído, `ate` excluído), com as aulas, para alertas e histórico. Lê
 * todos os Adolescentes de propósito: quem não tem presença numa aula com Chamada faltou a ela.
 */
export async function presencasDoPeriodo(
  supabase: SupabaseClient,
  periodo: { desde?: Date; ate?: Date } = {},
): Promise<PresencasDoPeriodo> {
  const linhas: PresencaComAulaDoBanco[] = [];
  for (let de = 0; ; de += PAGINA) {
    let consulta = supabase
      .from("presencas")
      .select("id, evento_id, adolescente_id, marcacoes_das_presencas(marcacao_id, visitante), eventos!inner(id, titulo, numero_da_ocorrencia, inicio, status, categorias(nome))")
      .neq("eventos.status", "cancelado");
    if (periodo.desde) consulta = consulta.gte("eventos.inicio", periodo.desde.toISOString());
    if (periodo.ate) consulta = consulta.lt("eventos.inicio", periodo.ate.toISOString());
    const { data, error } = await consulta.order("id").range(de, de + PAGINA - 1).overrideTypes<PresencaComAulaDoBanco[], { merge: false }>();
    if (error || !data) break;
    linhas.push(...data);
    if (data.length < PAGINA) break;
  }

  const aulas = new Map<string, AulaComChamada & { categoria: string }>();
  const porAula = new Map<string, PresencaNaAula[]>();
  for (const linha of linhas) {
    if (!aulas.has(linha.evento_id)) {
      aulas.set(linha.evento_id, {
        id: linha.eventos.id,
        titulo: tituloDeExibicao({ titulo: linha.eventos.titulo, numero: linha.eventos.numero_da_ocorrencia }),
        inicio: new Date(linha.eventos.inicio),
        categoria: linha.eventos.categorias.nome,
      });
      porAula.set(linha.evento_id, []);
    }
    porAula.get(linha.evento_id)!.push(daPresenca(linha));
  }
  return { aulas: [...aulas.values()].sort((a, b) => b.inicio.getTime() - a.inicio.getTime()), porAula };
}

/**
 * O que a Chamada precisa para quem a faz sem ser da Liderança (o Professor e o Auxiliar da aula): os Adolescentes ativos
 * só com nome e identificador, as Marcações ativas sem os pontos e a Chamada já feita. As funções do banco só respondem
 * a quem pode fazer a Chamada daquela aula, no dia dela em diante.
 */
export async function chamadaDoProfessor(
  supabase: SupabaseClient,
  eventoId: string,
): Promise<{ adolescentes: { id: string; nome: string }[]; marcacoes: Marcacao[]; presencas: PresencaNaAula[] }> {
  // Funções que devolvem várias linhas: o cliente sem tipos do banco as trata como uma, então o formato vem daqui.
  const [alunos, marcas, gravadas] = await Promise.all([
    supabase.rpc("adolescentes_da_chamada", { evento: eventoId }),
    supabase.rpc("marcacoes_da_chamada", { evento: eventoId }),
    supabase.rpc("presencas_da_chamada", { evento: eventoId }),
  ]);
  const alunosDoBanco = (alunos.data ?? []) as { id: string; nome: string }[];
  const marcasDoBanco = (marcas.data ?? []) as Omit<MarcacaoDoBanco, "pontos" | "ativa">[];
  const gravadasDoBanco = (gravadas.data ?? []) as { adolescente_id: string; marcacao_id: string; visitante: string | null }[];

  const porAdolescente = new Map<string, PresencaNaAula>();
  for (const linha of gravadasDoBanco) {
    const presenca = porAdolescente.get(linha.adolescente_id) ?? { adolescente: linha.adolescente_id, marcacoes: [], visitante: null };
    presenca.marcacoes.push(linha.marcacao_id);
    presenca.visitante ??= linha.visitante;
    porAdolescente.set(linha.adolescente_id, presenca);
  }

  return {
    adolescentes: alunosDoBanco,
    marcacoes: marcasDoBanco.map((m) => ({
      id: m.id,
      nome: m.nome,
      icone: m.icone,
      pontos: 0,
      ativa: true,
      contaPresenca: m.conta_presenca,
      pedeVisitante: m.pede_visitante,
      ordem: m.ordem,
    })),
    presencas: [...porAdolescente.values()],
  };
}
