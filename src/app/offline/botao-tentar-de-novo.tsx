"use client";

import { useRouter } from "next/navigation";

export function BotaoTentarDeNovo() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      className="botao-primario"
    >
      Tentar de novo
    </button>
  );
}
