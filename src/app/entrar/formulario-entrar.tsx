"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens } from "@/components/formulario";
import { entrar } from "@/lib/auth/acoes";

export function FormularioEntrar({ linkInvalido }: { linkInvalido: boolean }) {
  const [estado, acao] = useActionState(
    entrar,
    linkInvalido ? { erro: "O link expirou ou já foi usado. Peça um novo." } : {},
  );
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Entrando…">Entrar</BotaoEnviar>
      <Link href="/recuperar-senha" className="text-center text-sm text-marca underline-offset-4 hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}
