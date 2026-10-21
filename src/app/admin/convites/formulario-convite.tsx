"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens, Selecao } from "@/components/formulario";
import { NIVEIS_CONCEDIVEIS, NOMES_DOS_NIVEIS } from "@/dominio/acesso";
import { VALIDADE_MAXIMA_DIAS, VALIDADE_MINIMA_DIAS, VALIDADE_PADRAO_DIAS } from "@/dominio/convites";
import { gerarConvite } from "@/lib/contas/acoes";

const NIVEIS = NIVEIS_CONCEDIVEIS.map((nivel) => ({ valor: nivel, texto: NOMES_DOS_NIVEIS[nivel] }));

export function FormularioConvite({ funcoes }: { funcoes: { valor: string; texto: string }[] }) {
  const [estado, acao] = useActionState(gerarConvite, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Selecao rotulo="Nível de acesso" name="nivel" opcoes={NIVEIS} defaultValue="lider" required />
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
