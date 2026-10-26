import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarNotificacoes } from "./gerar";
import { processarFila, type OpcoesDaRodada, type ResumoDaRodada } from "./processar";

// A rodada inteira do agendador. Não importa `server-only` de propósito, como `processar.ts`: os testes do banco a usam.

export type ResultadoDaRodada = { processado: false; motivo: string } | ({ processado: true; geradas: number } & ResumoDaRodada);

/**
 * O Admin pode desligar o canal: desligado, nada é gerado nem enviado e nada é reservado na fila. Ligado, primeiro o que
 * ficou devido com o passar do tempo vira fila; em seguida a fila é enviada.
 */
export async function rodarAgendador(db: SupabaseClient, opcoes: OpcoesDaRodada): Promise<ResultadoDaRodada> {
  const { data, error } = await db.from("configuracoes").select("notificacoes_ligadas").maybeSingle();
  if (error) throw new Error(`não foi possível ler as configurações (${error.code ?? "sem código"})`);
  if (data && !data.notificacoes_ligadas) return { processado: false, motivo: "o canal de Notificações está desligado" };

  const geradas = await gerarNotificacoes(db, opcoes.agora);
  const resumo = await processarFila(db, opcoes);
  return { processado: true, geradas, ...resumo };
}
