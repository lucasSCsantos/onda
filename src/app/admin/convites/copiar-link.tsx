"use client";

import { useState } from "react";

export function CopiarLink({ link, rotulo = "Link do convite" }: { link: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <>
      <input
        readOnly
        value={link}
        aria-label={rotulo}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopiado(true);
        }}
        className="botao-primario"
      >
        {copiado ? "Copiado!" : "Copiar link"}
      </button>
    </>
  );
}
