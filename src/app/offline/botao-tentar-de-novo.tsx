"use client";

import { useRouter } from "next/navigation";

export function BotaoTentarDeNovo() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      className="rounded-lg bg-marca px-4 py-3 font-semibold text-marca-texto"
    >
      Tentar de novo
    </button>
  );
}
