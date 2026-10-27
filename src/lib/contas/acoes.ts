"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { erroNaConcessao, NIVEIS_CONCEDIVEIS } from "@/dominio/acesso";
import { dataDeNascimentoValida } from "@/dominio/cadastro";
import { VALIDADE_PADRAO_DIAS, vencimentoDoConvite } from "@/dominio/convites";
import { erroNoGenero, lerGenero } from "@/dominio/genero";
import { erroDeSenha } from "@/lib/auth/senha";
import { campoTexto } from "@/lib/campos";
import { registrarFalha } from "@/lib/logs/registrar";
import { origemDoApp } from "@/lib/origem";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Uma escrita que a política por linha barrou não dá erro: só não altera nada. Para o log, é falta de permissão. */
const SEM_LINHA = { code: "42501", message: "nenhuma linha alterada" };

/** Nível e Função escolhidos num convite ou numa aprovação, já conferidos pela regra do domínio. */
function concessao(dados: FormData) {
  const valor = campoTexto(dados, "nivel");
  const nivel = NIVEIS_CONCEDIVEIS.find((n) => n === valor);
  const funcao = campoTexto(dados, "funcao") || null;
  if (!nivel) return { erro: "Escolha o nível de acesso." } as const;
  const erro = erroNaConcessao(nivel, funcao);
  return erro ? ({ erro } as const) : ({ nivel, funcao } as const);
}

export async function cadastrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const nome = campoTexto(dados, "nome");
  const email = campoTexto(dados, "email");
  const senha = String(dados.get("senha") ?? "");
  const dataNascimento = campoTexto(dados, "data_nascimento");
  const convite = campoTexto(dados, "convite");
  const genero = campoTexto(dados, "genero");

  if (!nome) return { erro: "Informe seu nome." };
  if (!email) return { erro: "Informe seu e-mail." };
  if (!dataDeNascimentoValida(dataNascimento, new Date())) return { erro: "Informe uma data de nascimento válida." };
  const erroNoCampo = erroNoGenero(genero);
  if (erroNoCampo) return { erro: erroNoCampo };
  const erroNaSenha = erroDeSenha(senha);
  if (erroNaSenha) return { erro: erroNaSenha };

  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, data_nascimento: dataNascimento, genero, ...(convite ? { convite } : {}) },
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
  const escolha = concessao(dados);
  if ("erro" in escolha) return { erro: escolha.erro };

  let expiraEm: Date;
  try {
    expiraEm = vencimentoDoConvite(new Date(), Number(campoTexto(dados, "validade") || VALIDADE_PADRAO_DIAS));
  } catch (erro) {
    return { erro: (erro as Error).message };
  }

  const supabase = await supabaseDoServidor();
  const { error } = await supabase
    .from("convites")
    .insert({ nivel: escolha.nivel, funcao_id: escolha.funcao, expira_em: expiraEm.toISOString() });
  if (error) {
    registrarFalha(supabase, "convite.criado", { tipo: "convite" }, error);
    return { erro: "Não foi possível gerar o convite." };
  }

  revalidatePath("/admin/convites");
  return { aviso: "Convite gerado. Copie o link na lista abaixo e envie para a pessoa." };
}

export async function revogarConvite(id: string) {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.from("convites").update({ revogado_em: new Date().toISOString() }).eq("id", id).is("usado_em", null);
  if (error) registrarFalha(supabase, "convite.revogado", { tipo: "convite", id }, error);
  revalidatePath("/admin/convites");
}

export async function aprovarPendente(pessoa: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const escolha = concessao(dados);
  if ("erro" in escolha) return { erro: escolha.erro };

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("aprovar_pendente", {
    pessoa,
    novo_nivel: escolha.nivel,
    funcao: escolha.funcao,
  });
  if (error) {
    registrarFalha(supabase, "conta.aprovada", { tipo: "conta", id: pessoa }, error);
    return { erro: "Não foi possível aprovar." };
  }

  revalidatePath("/admin/usuarios");
  return {};
}

export async function recusarPendente(pessoa: string) {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("recusar_pendente", { pessoa });
  if (error) registrarFalha(supabase, "conta.recusada", { tipo: "conta", id: pessoa }, error);
  revalidatePath("/admin/usuarios");
}

export async function mudarAtivo(pessoa: string, ativo: boolean) {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("perfis").update({ ativo }).eq("id", pessoa).select("id");
  if (error || !data?.length) registrarFalha(supabase, ativo ? "conta.reativada" : "conta.desativada", { tipo: "conta", id: pessoa }, error ?? SEM_LINHA);
  revalidatePath("/admin/usuarios");
}

export async function promoverAAdmin(pessoa: string) {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("promover_a_admin", { pessoa });
  if (error) registrarFalha(supabase, "conta.nivel_alterado", { tipo: "conta", id: pessoa }, error);
  revalidatePath("/admin/usuarios");
}

/** Minha conta e a tela de usuários: a própria pessoa ou o Admin completa o Gênero (a função do banco confere quem pode). */
export async function definirGenero(pessoa: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const genero = lerGenero(campoTexto(dados, "genero"));
  if (!genero) return { erro: "Escolha o Gênero." };

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("definir_genero", { pessoa, novo_genero: genero });
  if (error) {
    registrarFalha(supabase, "conta.editada", { tipo: "conta", id: pessoa }, error);
    return { erro: "Não foi possível salvar o Gênero." };
  }

  revalidatePath("/conta");
  revalidatePath("/admin/usuarios");
  return { aviso: "Gênero salvo." };
}
