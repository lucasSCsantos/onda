"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "").trim();

export async function entrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: texto(dados, "email"),
    password: String(dados.get("senha") ?? ""),
  });
  if (error) return { erro: "E-mail ou senha incorretos." };
  redirect("/");
}

export async function sair() {
  const supabase = await supabaseDoServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function pedirNovaSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const email = texto(dados, "email");
  if (!email) return { erro: "Informe seu e-mail." };

  const origem = (await headers()).get("origin") ?? "";
  const supabase = await supabaseDoServidor();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/auth/confirmar?proximo=/redefinir-senha`,
  });
  // A mesma resposta para e-mail cadastrado ou não, para não revelar quem tem conta.
  return { aviso: "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha." };
}

export async function redefinirSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const senha = String(dados.get("senha") ?? "");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== String(dados.get("confirmacao") ?? "")) return { erro: "As senhas não conferem." };

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Não foi possível trocar a senha. Peça um novo link." };
  redirect("/");
}
