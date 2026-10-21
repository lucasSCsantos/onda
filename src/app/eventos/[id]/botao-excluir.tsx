"use client";

import { useActionState } from "react";
import { BotaoEnviar, Mensagens, type EstadoFormulario } from "@/components/formulario";
import { excluirEvento } from "@/lib/eventos/acoes";

/** Excluir pede uma segunda confirmação, sem diálogo do navegador. Só aparece para o Admin. */
export function BotaoExcluir({ id }: { id: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(excluirEvento.bind(null, id), {});
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-lg border border-erro px-4 py-2 font-semibold text-erro group-open:hidden">
        Excluir
      </summary>
      <form action={acao} className="flex flex-col gap-2">
        <p className="text-sm">Excluir apaga o Evento para todos. Para quem não é Admin, o caminho é o Status Cancelado.</p>
        <BotaoEnviar pendente="Excluindo…">Excluir de vez</BotaoEnviar>
        <Mensagens estado={estado} />
      </form>
    </details>
  );
}
