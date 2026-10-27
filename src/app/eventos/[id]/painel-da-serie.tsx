"use client";

import { useActionState } from "react";
import { BotaoEnviar, CampoDeData, Mensagens, type EstadoFormulario } from "@/components/formulario";
import { cancelarAsFuturas, encerrarASerie, excluirASerie } from "@/lib/series/acoes";

/**
 * O que se faz com a Série inteira, a partir de uma Ocorrência: encerrar, cancelar as futuras e (só o Admin) excluir.
 * Cada ação pede uma segunda confirmação, sem diálogo do navegador.
 */
export function PainelDaSerie({
  eventoId,
  serieId,
  pode,
  podeExcluir,
}: {
  eventoId: string;
  serieId: string;
  /** Quem cria Eventos da Categoria encerra e cancela. */
  pode: boolean;
  podeExcluir: boolean;
}) {
  if (!pode && !podeExcluir) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-borda p-4">
      <h2 className="text-sm font-medium">Série</h2>
      {pode && <Encerrar eventoId={eventoId} />}
      {pode && <CancelarFuturas eventoId={eventoId} />}
      {podeExcluir && <ExcluirSerie serieId={serieId} />}
    </section>
  );
}

function Encerrar({ eventoId }: { eventoId: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(encerrarASerie.bind(null, eventoId), {});
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-marca">Encerrar a Série</summary>
      <form action={acao} className="mt-2 flex flex-col gap-2">
        <p className="text-sm text-texto-suave">As Ocorrências depois do último dia, que ainda estão abertas, viram Canceladas.</p>
        <CampoDeData rotulo="Último dia da Série" name="ate" required />
        <BotaoEnviar pendente="Encerrando…">Encerrar</BotaoEnviar>
        <Mensagens estado={estado} />
      </form>
    </details>
  );
}

function CancelarFuturas({ eventoId }: { eventoId: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(cancelarAsFuturas.bind(null, eventoId), {});
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-marca">Cancelar todas as futuras</summary>
      <form action={acao} className="mt-2 flex flex-col gap-2">
        <p className="text-sm text-texto-suave">As Ocorrências que ainda não começaram viram Canceladas. As passadas ficam como estão.</p>
        <BotaoEnviar pendente="Cancelando…">Cancelar as futuras</BotaoEnviar>
        <Mensagens estado={estado} />
      </form>
    </details>
  );
}

function ExcluirSerie({ serieId }: { serieId: string }) {
  const [estado, acao] = useActionState<EstadoFormulario, FormData>(excluirASerie.bind(null, serieId), {});
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm font-semibold text-erro group-open:hidden">Excluir a Série</summary>
      <form action={acao} className="flex flex-col gap-2">
        <p className="text-sm">Excluir apaga a Série e todas as suas Ocorrências, inclusive as passadas, para todos.</p>
        <BotaoEnviar pendente="Excluindo…">Excluir a Série de vez</BotaoEnviar>
        <Mensagens estado={estado} />
      </form>
    </details>
  );
}
