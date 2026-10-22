"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/components/formulario";
import { tarefasFeitas, type ItemDoChecklist } from "@/dominio/checklist";
import { mudarChecklistDoEvento } from "@/lib/eventos/acoes";

/** As tarefas de um campo checklist; quem pode editar o Evento marca, adiciona e remove, os demais só leem. */
export function Checklist({
  eventoId,
  campoId,
  itens,
  edita,
}: {
  eventoId: string;
  campoId: string;
  itens: ItemDoChecklist[];
  edita: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(mudarChecklistDoEvento.bind(null, eventoId, campoId), {});

  return (
    <div className="flex flex-col gap-2">
      {itens.length > 0 && (
        <p className="text-sm text-texto-suave">
          {tarefasFeitas(itens)} de {itens.length} feitas
        </p>
      )}
      <form action={acao}>
        <ul className="flex flex-col gap-1.5">
        {itens.map((item, posicao) => (
          <li key={posicao} className="flex items-center gap-2">
            {edita ? (
              <button
                type="submit"
                name="mudanca"
                value={`marcar:${posicao}:${!item.feito}`}
                role="checkbox"
                aria-checked={item.feito}
                disabled={pendente}
                className="flex min-h-9 flex-1 items-center gap-2 text-left"
              >
                <span aria-hidden className="size-4 shrink-0 rounded border border-borda text-center text-xs leading-[0.9rem]">
                  {item.feito ? "✓" : ""}
                </span>
                <span className={item.feito ? "text-texto-suave line-through" : ""}>{item.texto}</span>
              </button>
            ) : (
              <span className={`flex-1 ${item.feito ? "text-texto-suave line-through" : ""}`}>
                {item.feito ? "✓ " : "☐ "}
                {item.texto}
              </span>
            )}
            {edita && (
              <button
                type="submit"
                name="mudanca"
                value={`remover:${posicao}`}
                disabled={pendente}
                aria-label={`Remover “${item.texto}”`}
                className="min-h-9 px-2 text-sm text-texto-suave hover:text-texto"
              >
                Remover
              </button>
            )}
          </li>
        ))}
        </ul>
      </form>
      {itens.length === 0 && !edita && <p className="text-texto-suave">Nenhuma tarefa.</p>}
      {edita && (
        // Outro formulário: o Enter no texto envia "adicionar", e não a primeira tarefa da lista.
        <form action={acao} className="flex gap-2">
          <input
            name="texto"
            aria-label="Nova tarefa"
            placeholder="Nova tarefa"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-borda bg-superficie px-3 py-2 outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
          />
          <button type="submit" name="mudanca" value="adicionar" disabled={pendente} className="botao-primario">
            Adicionar
          </button>
        </form>
      )}
      {estado.erro && (
        <p role="alert" className="text-sm text-erro">
          {estado.erro}
        </p>
      )}
    </div>
  );
}
