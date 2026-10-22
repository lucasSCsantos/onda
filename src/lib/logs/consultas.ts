import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { intervaloDosLogs, termoDeBusca, type FiltrosDosLogs, type Log } from "@/dominio/logs";

type LogDoBanco = {
  id: number;
  feito_em: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: string;
  modulo: Log["modulo"];
  objeto_tipo: string | null;
  objeto_id: string | null;
  objeto_rotulo: string | null;
  resultado: Log["resultado"];
  severidade: Log["severidade"];
  detalhes: Record<string, unknown>;
  origem: Log["origem"];
};

const COLUNAS = "id, feito_em, usuario_id, usuario_nome, acao, modulo, objeto_tipo, objeto_id, objeto_rotulo, resultado, severidade, detalhes, origem";

const doBanco = (l: LogDoBanco): Log => ({
  id: l.id,
  feitoEm: new Date(l.feito_em),
  usuarioId: l.usuario_id,
  usuarioNome: l.usuario_nome,
  acao: l.acao,
  modulo: l.modulo,
  objetoTipo: l.objeto_tipo,
  objetoId: l.objeto_id,
  objetoRotulo: l.objeto_rotulo,
  resultado: l.resultado,
  severidade: l.severidade,
  detalhes: l.detalhes ?? {},
  origem: l.origem,
});

/** A consulta com os filtros da tela; as políticas por linha deixam só o Admin ler tudo. */
function consultaFiltrada(supabase: SupabaseClient, filtros: FiltrosDosLogs, agora: Date) {
  let consulta = supabase.from("logs").select(COLUNAS);
  const { desde, ate } = intervaloDosLogs(filtros, agora);
  if (desde) consulta = consulta.gte("feito_em", desde.toISOString());
  if (ate) consulta = consulta.lt("feito_em", ate.toISOString());
  if (filtros.usuario === "sistema") consulta = consulta.is("usuario_id", null);
  else if (filtros.usuario) consulta = consulta.eq("usuario_id", filtros.usuario);
  if (filtros.acao) consulta = consulta.eq("acao", filtros.acao);
  if (filtros.modulo) consulta = consulta.eq("modulo", filtros.modulo);
  if (filtros.resultado) consulta = consulta.eq("resultado", filtros.resultado);
  if (filtros.severidade) consulta = consulta.eq("severidade", filtros.severidade);
  if (filtros.aba === "alertas") consulta = consulta.or("resultado.eq.falha,severidade.neq.info");
  const termo = termoDeBusca(filtros.busca);
  if (termo) consulta = consulta.or(`usuario_nome.ilike.*${termo}*,objeto_rotulo.ilike.*${termo}*`);
  return consulta;
}

export const LOGS_POR_PAGINA = 50;

/** Uma página de logs, do mais novo ao mais antigo, a partir de `antesDe` (o id do último da página anterior). */
export async function paginaDeLogs(
  supabase: SupabaseClient,
  filtros: FiltrosDosLogs,
  agora: Date,
  antesDe: number | null,
): Promise<{ logs: Log[]; proxima: number | null }> {
  let consulta = consultaFiltrada(supabase, filtros, agora);
  if (antesDe) consulta = consulta.lt("id", antesDe);
  const { data } = await consulta
    .order("id", { ascending: false })
    .limit(LOGS_POR_PAGINA + 1)
    .overrideTypes<LogDoBanco[], { merge: false }>();
  const linhas = (data ?? []).map(doBanco);
  const logs = linhas.slice(0, LOGS_POR_PAGINA);
  return { logs, proxima: linhas.length > LOGS_POR_PAGINA ? logs.at(-1)!.id : null };
}

// O PostgREST devolve no máximo 1000 linhas por pedido.
const PAGINA_DA_EXPORTACAO = 1000;

/** Todos os logs do filtro, para exportar. */
export async function todosOsLogs(supabase: SupabaseClient, filtros: FiltrosDosLogs, agora: Date): Promise<Log[]> {
  const logs: Log[] = [];
  let antesDe: number | null = null;
  for (;;) {
    let consulta = consultaFiltrada(supabase, filtros, agora);
    if (antesDe) consulta = consulta.lt("id", antesDe);
    const { data, error } = await consulta
      .order("id", { ascending: false })
      .limit(PAGINA_DA_EXPORTACAO)
      .overrideTypes<LogDoBanco[], { merge: false }>();
    if (error || !data) throw new Error("Não foi possível ler os logs para exportar.");
    logs.push(...data.map(doBanco));
    if (data.length < PAGINA_DA_EXPORTACAO) return logs;
    antesDe = data.at(-1)!.id;
  }
}

/** O histórico de um Evento e da Série dele, como quem olha pode lê-lo (o Admin, ou o líder se o Admin ligar). */
export async function historicoDoEvento(supabase: SupabaseClient, eventoId: string, serieId: string | null): Promise<Log[]> {
  const alvos = [`and(objeto_tipo.eq.evento,objeto_id.eq.${eventoId})`];
  if (serieId) alvos.push(`and(objeto_tipo.eq.serie,objeto_id.eq.${serieId})`);
  const { data } = await supabase
    .from("logs")
    .select(COLUNAS)
    .or(alvos.join(","))
    .order("id", { ascending: false })
    .limit(30)
    .overrideTypes<LogDoBanco[], { merge: false }>();
  return (data ?? []).map(doBanco);
}

/** Quais destes Eventos ainda existem, para os logs levarem só ao que dá para abrir. */
export async function eventosExistentes(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await supabase.from("eventos").select("id").in("id", [...new Set(ids)]);
  return new Set((data ?? []).map((e) => e.id as string));
}

/** Quem aparece no filtro de usuário: todas as contas, em ordem de nome. */
export async function pessoasDoFiltro(supabase: SupabaseClient): Promise<{ valor: string; texto: string }[]> {
  const { data } = await supabase.from("perfis").select("id, nome").order("nome");
  return (data ?? []).map((p) => ({ valor: p.id as string, texto: (p.nome as string) || "(sem nome)" }));
}
