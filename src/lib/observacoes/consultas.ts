import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ordenarObservacoes, type Observacao } from "@/dominio/observacoes";

type Linha = { id: string; texto: string; autor_id: string | null; criado_em: string; editado_em: string; autor: { nome: string } | null };

/** As Observações de um Adolescente, da mais antiga para a mais nova (o banco só mostra à Liderança). */
export async function observacoesDoAdolescente(supabase: SupabaseClient, adolescenteId: string): Promise<Observacao[]> {
  const { data } = await supabase
    .from("observacoes")
    .select("id, texto, autor_id, criado_em, editado_em, autor:perfis(nome)")
    .eq("adolescente_id", adolescenteId)
    .order("criado_em")
    .order("id")
    .overrideTypes<Linha[], { merge: false }>();
  return ordenarObservacoes(
    (data ?? []).map((o) => ({
      id: o.id,
      texto: o.texto,
      autorId: o.autor_id,
      autorNome: o.autor?.nome ?? null,
      criadoEm: new Date(o.criado_em),
      editadoEm: new Date(o.editado_em),
    })),
  );
}
