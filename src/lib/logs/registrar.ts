import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

/**
 * O que o servidor registra por conta própria: entrar, sair, a senha e as falhas das ações (o banco registra o resto
 * pelos gatilhos). Quem fez é sempre quem está logado no cliente; o banco não deixa registrar em nome de outra pessoa.
 */
export type Registro = {
  acao: string;
  resultado?: "sucesso" | "falha";
  objeto?: { tipo: string; id?: string | null; rotulo?: string | null };
  /** Só para achar a conta numa tentativa de login ou num pedido de senha; não é gravado. */
  email?: string;
  /** O erro devolvido pelo Supabase, numa falha; vai recolhido como detalhe técnico. */
  erro?: { message?: string; code?: string } | null;
};

/** Grava o registro agora. Nunca lança: se não der para registrar, a ação segue e o erro fica no log do servidor. */
export async function registrarLogAgora(supabase: SupabaseClient, registro: Registro): Promise<void> {
  try {
    const { error } = await supabase.rpc("registrar_log", {
      acao: registro.acao,
      resultado: registro.resultado ?? "sucesso",
      objeto_tipo: registro.objeto?.tipo ?? null,
      objeto_id: registro.objeto?.id ?? null,
      objeto_rotulo: registro.objeto?.rotulo ?? null,
      email: registro.email ?? null,
      mensagem: registro.erro?.message ?? null,
      codigo: registro.erro?.code ?? null,
    });
    if (error) console.error(`Log ${registro.acao} não gravado:`, error.message);
  } catch (erro) {
    console.error(`Log ${registro.acao} não gravado:`, erro);
  }
}

/** Registra depois da resposta, para não atrasar nem derrubar a ação de quem está usando. */
export function registrarLog(supabase: SupabaseClient, registro: Registro): void {
  after(() => registrarLogAgora(supabase, registro));
}

/** Atalho para a falha de uma ação que o banco recusou. */
export function registrarFalha(supabase: SupabaseClient, acao: string, objeto: Registro["objeto"], erro: Registro["erro"]): void {
  registrarLog(supabase, { acao, resultado: "falha", objeto, erro });
}
