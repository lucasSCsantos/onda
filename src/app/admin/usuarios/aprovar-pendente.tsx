"use client";

import { useActionState } from "react";
import { BotaoEnviar, Mensagens, Selecao } from "@/components/formulario";
import { NIVEIS_CONCEDIVEIS, NOMES_DOS_NIVEIS } from "@/dominio/acesso";
import { aprovarPendente } from "@/lib/contas/acoes";

const NIVEIS = NIVEIS_CONCEDIVEIS.map((nivel) => ({ valor: nivel, texto: NOMES_DOS_NIVEIS[nivel] }));

export function AprovarPendente({ pessoa, funcoes }: { pessoa: string; funcoes: { valor: string; texto: string }[] }) {
  const [estado, acao] = useActionState(aprovarPendente.bind(null, pessoa), {});
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
      <Selecao rotulo="Nível" name="nivel" opcoes={NIVEIS} defaultValue="lider" required />
      <Selecao rotulo="Função" name="funcao" opcoes={funcoes} vazia="Sem Função (Professor)" />
      <BotaoEnviar pendente="Aprovando…">Aprovar</BotaoEnviar>
      <div className="sm:col-span-3">
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
