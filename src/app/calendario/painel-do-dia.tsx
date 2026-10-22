"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * O Painel do dia: folha que sobe de baixo no celular e painel lateral no desktop. É um `<dialog>` modal, que já traz
 * foco preso, Esc e rótulo; aqui só se liga o fechamento (Esc, toque fora e botão) à URL, em `fechar`.
 * O voltar do navegador fecha por si: abrir é uma navegação.
 */
export function PainelDoDia({ titulo, fechar, children }: { titulo: string; fechar: string; children: ReactNode }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const idDoTitulo = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (elemento && !elemento.open) elemento.showModal();
  }, []);

  const fecha = () => router.replace(fechar, { scroll: false });

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idDoTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        fecha();
      }}
      onClick={(evento) => {
        if (evento.target === dialogo.current) fecha();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-borda bg-fundo p-0 text-texto backdrop:bg-black/50 md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:h-full md:w-96 md:rounded-none md:rounded-l-2xl"
    >
      <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-borda bg-fundo px-4 py-3">
        <h2 id={idDoTitulo} className="text-lg font-semibold first-letter:uppercase">
          {titulo}
        </h2>
        <button type="button" onClick={fecha} aria-label="Fechar" className="botao-secundario size-11 !p-0">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </dialog>
  );
}
