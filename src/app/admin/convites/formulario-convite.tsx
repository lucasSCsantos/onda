"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import { VALIDADE_MAXIMA_DIAS, VALIDADE_MINIMA_DIAS, VALIDADE_PADRAO_DIAS } from "@/dominio/convites";
import { gerarConvite } from "@/lib/contas/acoes";

export function FormularioConvite({ niveis, funcoes }: { niveis: Opcao[]; funcoes: Opcao[] }) {
  const [estado, acao] = useActionState(gerarConvite, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Selecao rotulo="Nível de acesso" name="nivel" opcoes={niveis} defaultValue="lider" required />
      <Selecao rotulo="Função" name="funcao" opcoes={funcoes} vazia="Sem Função (Professor)" />
      <Campo
        rotulo="Validade (dias)"
        name="validade"
        type="number"
        min={VALIDADE_MINIMA_DIAS}
        max={VALIDADE_MAXIMA_DIAS}
        defaultValue={VALIDADE_PADRAO_DIAS}
        required
      />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Gerando…">Gerar convite</BotaoEnviar>
    </form>
  );
}
