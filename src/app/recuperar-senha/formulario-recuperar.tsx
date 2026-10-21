"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens } from "@/components/formulario";
import { pedirNovaSenha } from "@/lib/auth/acoes";

export function FormularioRecuperar() {
  const [estado, acao] = useActionState(pedirNovaSenha, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <p className="text-sm text-texto-suave">Enviaremos um link para você criar uma nova senha.</p>
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Enviando…">Enviar link</BotaoEnviar>
      <Link href="/entrar" className="text-center text-sm text-marca underline-offset-4 hover:underline">
        Voltar para entrar
      </Link>
    </form>
  );
}
