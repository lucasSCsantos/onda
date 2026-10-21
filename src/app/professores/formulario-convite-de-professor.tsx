"use client";

import { useActionState } from "react";
import { BotaoEnviar, Campo, Mensagens } from "@/components/formulario";
import { VALIDADE_MAXIMA_DIAS, VALIDADE_MINIMA_DIAS, VALIDADE_PADRAO_DIAS } from "@/dominio/convites";
import { gerarConviteDeProfessor } from "@/lib/professores/acoes";

export function FormularioConviteDeProfessor() {
  const [estado, acao] = useActionState(gerarConviteDeProfessor, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
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
      <BotaoEnviar pendente="Gerando…">Gerar convite de Professor</BotaoEnviar>
    </form>
  );
}
