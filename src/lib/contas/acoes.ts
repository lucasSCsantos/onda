"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { NIVEIS_CONCEDIVEIS } from "@/dominio/acesso";
import { VALIDADE_PADRAO_DIAS, vencimentoDoConvite } from "@/dominio/convites";
import { SENHA_MINIMA } from "@/lib/auth/senha";
import { origemDoApp } from "@/lib/origem";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

const campoTexto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "").trim();

const nivelConcedivel = (valor: string) =>
  (NIVEIS_CONCEDIVEIS as readonly string[]).includes(valor) ? (valor as (typeof NIVEIS_CONCEDIVEIS)[number]) : null;

/** Data no formato do campo `date` (aaaa-mm-dd), existente e não futura. */
function dataDeNascimentoValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(valor) && data <= new Date();
}

export async function cadastrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const nome = campoTexto(dados, "nome");
  const email = campoTexto(dados, "email");
  const senha = String(dados.get("senha") ?? "");
  const dataNascimento = campoTexto(dados, "data_nascimento");
  const convite = campoTexto(dados, "convite");

  if (!nome) return { erro: "Informe seu nome." };
  if (!email) return { erro: "Informe seu e-mail." };
  if (!dataDeNascimentoValida(dataNascimento)) return { erro: "Informe uma data de nascimento válida." };
  if (senha.length < SENHA_MINIMA) return { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };

  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, data_nascimento: dataNascimento, ...(convite ? { convite } : {}) },
      emailRedirectTo: `${await origemDoApp()}/auth/confirmar`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") return { erro: "Já existe uma conta com esse e-mail. Entre ou recupere a senha." };
    // O banco recusa o cadastro quando o convite foi usado, venceu ou foi revogado no meio do caminho.
    if (convite) return { erro: "Este convite não vale mais. Peça um novo ao Admin." };
    return { erro: "Não foi possível criar a conta. Tente de novo." };
  }

  // Com confirmação de e-mail ligada, a sessão só existe depois do clique no link.
  if (!data.session) return { aviso: "Conta criada. Confira seu e-mail para confirmar o cadastro." };
  redirect("/");
}

export async function gerarConvite(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const nivel = nivelConcedivel(campoTexto(dados, "nivel"));
  const funcao = campoTexto(dados, "funcao") || null;
  const dias = Number(campoTexto(dados, "validade") || VALIDADE_PADRAO_DIAS);

  if (!nivel) return { erro: "Escolha o nível de acesso." };
  if (nivel === "lider" && !funcao) return { erro: "Um Líder precisa de uma Função." };

  let expiraEm: Date;
  try {
    expiraEm = vencimentoDoConvite(new Date(), dias);
  } catch (erro) {
    return { erro: (erro as Error).message };
  }

  const supabase = await supabaseDoServidor();
  const { error } = await supabase
    .from("convites")
    .insert({ nivel, funcao_id: funcao, expira_em: expiraEm.toISOString() });
  if (error) return { erro: "Não foi possível gerar o convite." };

  revalidatePath("/admin/convites");
  return { aviso: "Convite gerado. Copie o link na lista abaixo e envie para a pessoa." };
}

export async function revogarConvite(id: string) {
  const supabase = await supabaseDoServidor();
  await supabase.from("convites").update({ revogado_em: new Date().toISOString() }).eq("id", id).is("usado_em", null);
  revalidatePath("/admin/convites");
}

export async function aprovarPendente(pessoa: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const nivel = nivelConcedivel(campoTexto(dados, "nivel"));
  const funcao = campoTexto(dados, "funcao") || null;
  if (!nivel) return { erro: "Escolha o nível de acesso." };
  if (nivel === "lider" && !funcao) return { erro: "Um Líder precisa de uma Função." };

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("aprovar_pendente", { pessoa, novo_nivel: nivel, funcao });
  if (error) return { erro: "Não foi possível aprovar." };

  revalidatePath("/admin/usuarios");
  return {};
}

export async function recusarPendente(pessoa: string) {
  const supabase = await supabaseDoServidor();
  await supabase.rpc("recusar_pendente", { pessoa });
  revalidatePath("/admin/usuarios");
}

export async function mudarAtivo(pessoa: string, ativo: boolean) {
  const supabase = await supabaseDoServidor();
  await supabase.from("perfis").update({ ativo }).eq("id", pessoa);
  revalidatePath("/admin/usuarios");
}

export async function promoverAAdmin(pessoa: string) {
  const supabase = await supabaseDoServidor();
  await supabase.from("perfis").update({ nivel: "admin" }).eq("id", pessoa).neq("nivel", "pendente");
  revalidatePath("/admin/usuarios");
}
