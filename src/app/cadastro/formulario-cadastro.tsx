"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar, Campo, CampoDeData, GrupoDeRadio, Mensagens } from "@/components/formulario";
import { GENEROS, NOMES_DOS_GENEROS } from "@/dominio/genero";
import { SENHA_MINIMA } from "@/lib/auth/senha";
import { cadastrar } from "@/lib/contas/acoes";

export function FormularioCadastro({ convite }: { convite?: string }) {
  const [estado, acao] = useActionState(cadastrar, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      {convite && <input type="hidden" name="convite" value={convite} />}
      <Campo rotulo="Nome" name="nome" autoComplete="name" required />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <CampoDeData rotulo="Data de nascimento" name="data_nascimento" autoComplete="bday" required />
      <GrupoDeRadio
        legenda="Gênero"
        name="genero"
        variante="segmentado"
        required
        opcoes={GENEROS.map((g) => ({ valor: g, texto: NOMES_DOS_GENEROS[g] }))}
      />
      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        minLength={SENHA_MINIMA}
        required
      />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Criando conta…">Criar conta</BotaoEnviar>
      <Link href="/entrar" className="text-center text-sm text-marca underline-offset-4 hover:underline">
        Já tenho conta
      </Link>
    </form>
  );
}
