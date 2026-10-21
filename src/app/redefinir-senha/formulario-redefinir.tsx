"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens } from "@/components/formulario";
import { redefinirSenha } from "@/lib/auth/acoes";
import { SENHA_MINIMA } from "@/lib/auth/senha";

export function FormularioRedefinir() {
  const [estado, acao] = useActionState(redefinirSenha, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo rotulo="Nova senha" name="senha" type="password" autoComplete="new-password" minLength={SENHA_MINIMA} required />
      <Campo
        rotulo="Repita a nova senha"
        name="confirmacao"
        type="password"
        autoComplete="new-password"
        minLength={SENHA_MINIMA}
        required
      />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Salvando…">Salvar nova senha</BotaoEnviar>
    </form>
  );
}
