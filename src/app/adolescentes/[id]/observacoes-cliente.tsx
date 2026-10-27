"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { BotaoEnviar, Mensagens, type EstadoFormulario } from "@/components/formulario";
import { cabeNoLimite, LIMITE_DA_OBSERVACAO, restantes } from "@/dominio/observacoes";
import { adicionarObservacao, apagarObservacao, editarObservacao } from "@/lib/observacoes/acoes";

/** Caixa de texto com o contador de caracteres; passa do limite, o contador fica vermelho e o banco recusaria. */
function CaixaDaObservacao({ rotulo, inicial = "" }: { rotulo: string; inicial?: string }) {
  const [texto, setTexto] = useState(inicial);
  const contador = useId();
  const sobra = restantes(texto);
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {rotulo}
      <textarea
        name="texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        required
        aria-describedby={contador}
        className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
      />
      <span
        id={contador}
        aria-live="polite"
        className={`text-xs font-normal ${cabeNoLimite(texto) ? "text-texto-suave" : "text-erro"}`}
      >
        {texto.length.toLocaleString("pt-BR")} de {LIMITE_DA_OBSERVACAO.toLocaleString("pt-BR")} caracteres
        {sobra < 0 && ` (passou ${(-sobra).toLocaleString("pt-BR")})`}
      </span>
    </label>
  );
}

/** Formulário de adicionar; depois de salvar, a caixa volta vazia. */
export function NovaObservacao({ adolescenteId }: { adolescenteId: string }) {
  const [estado, acao] = useActionState(
    async (anterior: EstadoFormulario & { rodada: number }, dados: FormData) => {
      const novo = await adicionarObservacao(adolescenteId, anterior, dados);
      // Salvou: a rodada nova remonta a caixa, que volta vazia.
      return { ...novo, rodada: novo.aviso ? anterior.rodada + 1 : anterior.rodada };
    },
    { rodada: 0 },
  );
  return (
    <form action={acao} className="flex flex-col gap-3">
      <CaixaDaObservacao key={estado.rodada} rotulo="Nova observação" />
      <div>
        <BotaoEnviar pendente="Salvando…">Adicionar observação</BotaoEnviar>
      </div>
      <Mensagens estado={estado} />
    </form>
  );
}

type ItemProps = {
  id: string;
  adolescenteId: string;
  texto: string;
  autor: string;
  criadaEm: string;
  editadaEm: string | null;
  /** O autor e o Admin editam e apagam (o banco confirma). */
  pode: boolean;
};

/** Uma entrada: texto, autor, data de criação, data da última edição (se houve) e, para quem pode, editar e apagar. */
export function ItemDaObservacao({ id, adolescenteId, texto, autor, criadaEm, editadaEm, pode }: ItemProps) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, iniciar] = useTransition();
  const [estado, acao] = useActionState(
    async (anterior: EstadoFormulario, dados: FormData) => {
      const novo = await editarObservacao(id, adolescenteId, anterior, dados);
      if (novo.aviso) setEditando(false);
      return novo;
    },
    {},
  );

  return (
    <li className="flex flex-col gap-2 p-4">
      {editando ? (
        <form action={acao} className="flex flex-col gap-3">
          <CaixaDaObservacao rotulo="Editar observação" inicial={texto} />
          <div className="flex flex-wrap gap-2">
            <BotaoEnviar pendente="Salvando…">Salvar</BotaoEnviar>
            <button type="button" className="botao-secundario" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
          <Mensagens estado={estado} />
        </form>
      ) : (
        <p className="whitespace-pre-wrap break-words">{texto}</p>
      )}
      <p className="text-sm text-texto-suave">
        {autor} · {criadaEm}
        {editadaEm && ` · editada em ${editadaEm}`}
      </p>
      {pode && !editando && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="underline text-texto-suave hover:text-texto" onClick={() => setEditando(true)}>
            Editar
          </button>
          {confirmando ? (
            <span className="flex items-center gap-3">
              <span>Apagar esta observação?</span>
              <button
                type="button"
                disabled={apagando}
                className="underline text-erro disabled:opacity-60"
                onClick={() => iniciar(() => apagarObservacao(id, adolescenteId))}
              >
                {apagando ? "Apagando…" : "Apagar"}
              </button>
              <button type="button" className="underline text-texto-suave hover:text-texto" onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" className="underline text-erro" onClick={() => setConfirmando(true)}>
              Apagar
            </button>
          )}
        </div>
      )}
    </li>
  );
}
