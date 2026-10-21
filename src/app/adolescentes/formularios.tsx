"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens } from "@/components/formulario";
import { salvarAdolescente } from "@/lib/adolescentes/acoes";

/** Cria (sem `adolescente`) ou edita nome e data de nascimento. */
export function FormularioAdolescente({ adolescente }: { adolescente?: { id: string; nome: string; nascimento: string } }) {
  const [estado, acao] = useActionState(salvarAdolescente.bind(null, adolescente?.id ?? null), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
      <Campo rotulo="Nome" name="nome" defaultValue={adolescente?.nome} required />
      <Campo rotulo="Data de nascimento" name="nascimento" type="date" defaultValue={adolescente?.nascimento} required />
      <BotaoEnviar pendente="Salvando…">{adolescente ? "Salvar" : "Cadastrar"}</BotaoEnviar>
      <div className="sm:col-span-3">
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
