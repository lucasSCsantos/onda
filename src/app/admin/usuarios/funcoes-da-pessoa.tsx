"use client";

import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Mensagens, type Opcao } from "@/components/formulario";
import { definirFuncoes } from "@/lib/catalogo/acoes";

/** As Funções de uma pessoa da Liderança: o Admin marca quantas quiser. */
export function FuncoesDaPessoa({
  pessoa,
  atuais,
  funcoes,
}: {
  pessoa: string;
  atuais: string[];
  funcoes: Opcao[];
}) {
  const [estado, acao] = useActionState(definirFuncoes.bind(null, pessoa), {});
  return (
    <form action={acao} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Funções</legend>
        {funcoes.map((f) => (
          <CaixaDeMarcar key={f.valor} rotulo={f.texto} name="funcoes" value={f.valor} defaultChecked={atuais.includes(f.valor)} />
        ))}
      </fieldset>
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Salvando…">Salvar Funções</BotaoEnviar>
    </form>
  );
}
