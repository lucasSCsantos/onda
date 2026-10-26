import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SituacaoDaFila = "pendente" | "enviada" | "falha";
export const SITUACOES_DA_FILA: readonly SituacaoDaFila[] = ["pendente", "enviada", "falha"];

/** Uma Notificação da fila como o Admin a vê: o tipo, para quem e os tempos. Nunca o texto, o endpoint nem as chaves. */
export type ItemDaFila = {
  id: string;
  tipo: string;
  pessoa: string;
  urgente: boolean;
  tentativas: number;
  criadaEm: Date;
  proximaTentativa: Date;
  enviadaEm: Date | null;
};

export type FilaDeNotificacoes = {
  totais: Record<SituacaoDaFila, number>;
  itens: Record<SituacaoDaFila, ItemDaFila[]>;
  pessoasComDispositivo: number;
};

type LinhaDaFila = {
  id: string;
  tipo: string;
  pessoa: string;
  urgente: boolean;
  tentativas: number;
  criada_em: string;
  proxima_tentativa: string;
  enviada_em: string | null;
};

/** A fila inteira para a tela do Admin; as funções do banco recusam quem não é Admin. */
export async function filaDeNotificacoes(supabase: SupabaseClient): Promise<FilaDeNotificacoes> {
  const [resumo, pessoas, ...listas] = await Promise.all([
    supabase.rpc("resumo_da_fila_de_notificacoes"),
    supabase.rpc("pessoas_com_dispositivo"),
    ...SITUACOES_DA_FILA.map((situacao) => supabase.rpc("fila_de_notificacoes", { situacao, limite: 20 })),
  ]);
  const totais = { pendente: 0, enviada: 0, falha: 0 };
  for (const linha of (resumo.data ?? []) as { estado: string; total: number | string }[]) {
    if (linha.estado in totais) totais[linha.estado as SituacaoDaFila] = Number(linha.total);
  }
  const itens = { pendente: [], enviada: [], falha: [] } as FilaDeNotificacoes["itens"];
  SITUACOES_DA_FILA.forEach((situacao, i) => {
    itens[situacao] = ((listas[i].data ?? []) as LinhaDaFila[]).map((l) => ({
      id: l.id,
      tipo: l.tipo,
      pessoa: l.pessoa,
      urgente: l.urgente,
      tentativas: l.tentativas,
      criadaEm: new Date(l.criada_em),
      proximaTentativa: new Date(l.proxima_tentativa),
      enviadaEm: l.enviada_em ? new Date(l.enviada_em) : null,
    }));
  });
  return { totais, itens, pessoasComDispositivo: typeof pessoas.data === "number" ? pessoas.data : 0 };
}
