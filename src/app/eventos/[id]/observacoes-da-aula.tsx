"use client";

import { useActionState } from "react";
import { BotaoEnviar, CampoDeTextoLongo, Mensagens, type EstadoFormulario } from "@/components/formulario";
import { editarObservacoes } from "@/lib/eventos/acoes";

/** O Professor e o Auxiliar editam só as observações da aula: não mudam Status, data nem Responsável. */
export function ObservacoesDaAula({ eventoId, observacoes }: { eventoId: string; observacoes: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(editarObservacoes.bind(null, eventoId), {});

  return (
    <form action={acao} className="flex flex-col gap-3">
      <CampoDeTextoLongo rotulo="Observações da aula" name="observacoes" rows={4} defaultValue={observacoes} />
      <Mensagens estado={estado} />
      <BotaoEnviar pendente="Salvando…">Salvar observações</BotaoEnviar>
    </form>
  );
}
