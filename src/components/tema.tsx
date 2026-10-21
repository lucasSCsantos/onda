"use client";

import { useSyncExternalStore } from "react";

type Tema = "claro" | "escuro";
const CHAVE = "mural-onda:tema";
const EVENTO = "mural-onda:tema";
const MIDIA_ESCURA = "(prefers-color-scheme: dark)";

/** Script que roda antes da pintura para aplicar o tema salvo, evitando o "piscar" de cores. */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("${CHAVE}");if(t==="claro"||t==="escuro")document.documentElement.dataset.tema=t}catch(e){}`;

function temaAtual(): Tema {
  const escolhido = document.documentElement.dataset.tema;
  if (escolhido === "claro" || escolhido === "escuro") return escolhido;
  return matchMedia(MIDIA_ESCURA).matches ? "escuro" : "claro";
}

function assinar(avisar: () => void) {
  const midia = matchMedia(MIDIA_ESCURA);
  midia.addEventListener("change", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    midia.removeEventListener("change", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

export function AlternarTema() {
  const tema = useSyncExternalStore<Tema | null>(assinar, temaAtual, () => null);

  function alternar() {
    const proximo: Tema = temaAtual() === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = proximo;
    try {
      localStorage.setItem(CHAVE, proximo);
    } catch {
      // Sem armazenamento local, o tema vale só até fechar a página.
    }
    window.dispatchEvent(new Event(EVENTO));
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="rounded-full border border-borda px-3 py-1.5 text-sm text-texto-suave hover:text-texto"
    >
      {tema === "escuro" ? "Modo claro" : "Modo escuro"}
    </button>
  );
}
