"use server";

import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { campoTexto } from "@/lib/campos";
import { origemDoApp } from "@/lib/origem";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { erroDeSenha } from "./senha";

export async function entrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: campoTexto(dados, "email"),
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
  const email = campoTexto(dados, "email");
  if (!email) return { erro: "Informe seu e-mail." };

  const supabase = await supabaseDoServidor();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origemDoApp()}/auth/confirmar?proximo=/redefinir-senha`,
  });
  // A mesma resposta para e-mail cadastrado ou não, para não revelar quem tem conta.
  return { aviso: "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha." };
}

export async function redefinirSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const senha = String(dados.get("senha") ?? "");
  const erro = erroDeSenha(senha);
  if (erro) return { erro };
  if (senha !== String(dados.get("confirmacao") ?? "")) return { erro: "As senhas não conferem." };

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Não foi possível trocar a senha. Peça um novo link." };
  redirect("/");
}
