import "server-only";
import { redirect } from "next/navigation";
import { podeGerenciarContas, telaInicial, type NivelDeAcesso, type Pessoa } from "@/dominio/acesso";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export type PerfilAtual = Pessoa & { nome: string };

/** Perfil de quem está logado, ou `null` se ninguém entrou. */
export async function perfilAtual(): Promise<PerfilAtual | null> {
  const supabase = await supabaseDoServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const id = sessao?.claims.sub;
  if (!id) return null;

  const { data } = await supabase.from("perfis").select("id, nome, nivel, ativo").eq("id", id).maybeSingle();
  if (!data) return null;
  return { id: data.id, nome: data.nome, nivel: data.nivel as NivelDeAcesso, ativo: data.ativo };
}

/** Para as telas de administração: quem não é Admin volta para o início. */
export async function exigirAdmin(): Promise<PerfilAtual> {
  const perfil = await perfilAtual();
  if (!perfil || !podeGerenciarContas(perfil)) redirect("/");
  return perfil;
}

/** Para o calendário e o Evento: a Liderança ativa e o Professor ativo (que lê só as aulas dele); os demais voltam para o início. */
export async function exigirMural(): Promise<PerfilAtual> {
  const perfil = await perfilAtual();
  if (!perfil || telaInicial(perfil) !== "mural") redirect("/");
  return perfil;
}

/** Para as telas de Eventos: quem não é da Liderança ativa volta para o início. */
export async function exigirLideranca(): Promise<PerfilAtual> {
  const perfil = await perfilAtual();
  if (!perfil || !podeVerTodosOsEventos(perfil)) redirect("/");
  return perfil;
}
