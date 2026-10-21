"use client";

import { useState } from "react";

export function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <>
      <input
        readOnly
        value={link}
        aria-label="Link do convite"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopiado(true);
        }}
        className="rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-marca-texto"
      >
        {copiado ? "Copiado!" : "Copiar link"}
      </button>
    </>
  );
}
