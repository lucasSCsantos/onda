"use client";

import { useActionState } from "react";
import { BotaoEnviar, Mensagens, type EstadoFormulario } from "@/components/formulario";
import { criarPastaAgora } from "@/lib/drive/acoes";

/** Para o Evento sem pasta no Drive (criado antes da integração, ou com erro): pede a criação na hora. */
export function BotaoCriarPasta({ id }: { id: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(criarPastaAgora.bind(null, id), {});
  return (
    <form action={acao} className="flex flex-col gap-2">
      <BotaoEnviar pendente="Pedindo…">Criar pasta agora</BotaoEnviar>
      <Mensagens estado={estado} />
    </form>
  );
}
