import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  eventos: { id: string; titulo: string; inicio: string; categorias: { nome: string } };
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
      .select("id, evento_id, adolescente_id, marcacoes_das_presencas(marcacao_id, visitante), eventos!inner(id, titulo, inicio, status, categorias(nome))")
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
        titulo: linha.eventos.titulo,
        inicio: new Date(linha.eventos.inicio),
        categoria: linha.eventos.categorias.nome,
      });
      porAula.set(linha.evento_id, []);
    }
    porAula.get(linha.evento_id)!.push(daPresenca(linha));
  }
  return { aulas: [...aulas.values()].sort((a, b) => b.inicio.getTime() - a.inicio.getTime()), porAula };
}
