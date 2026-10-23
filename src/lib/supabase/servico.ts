import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./ambiente";

/**
 * Cliente do Supabase com a chave service-role, que passa por cima das políticas por linha. Existe só para o que roda
 * sem ninguém logado (o feed do calendário, ADR 0007), nunca para uma tela. A chave fica só no servidor
 * (`SUPABASE_SERVICE_ROLE_KEY`, sem o prefixo `NEXT_PUBLIC_`) e nunca vai para o navegador.
 */
export function supabaseDeServico() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.");
  return createClient(SUPABASE_URL, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
