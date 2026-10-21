"use client";

import { useActionState } from "react";
import { BotaoEnviar, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import { aprovarPendente } from "@/lib/contas/acoes";

export function AprovarPendente({
  pessoa,
  niveis,
  funcoes,
}: {
  pessoa: string;
  niveis: Opcao[];
  funcoes: Opcao[];
}) {
  const [estado, acao] = useActionState(aprovarPendente.bind(null, pessoa), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
      <Selecao rotulo="Nível" name="nivel" opcoes={niveis} defaultValue="lider" required />
      <Selecao rotulo="Função" name="funcao" opcoes={funcoes} vazia="Sem Função (Professor)" />
      <BotaoEnviar pendente="Aprovando…">Aprovar</BotaoEnviar>
      <div className="sm:col-span-3">
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
