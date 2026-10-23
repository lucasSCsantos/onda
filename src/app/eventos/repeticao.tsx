"use client";

import { useState } from "react";
import { Campo, Selecao } from "@/components/formulario";
import { MAXIMO_DE_MESES, MAXIMO_DE_OCORRENCIAS } from "@/dominio/series";

/** A repetição de um Evento novo: com ela, o Evento vira uma Série. `valor` devolve o que foi digitado, depois de um erro. */
export function Repeticao({ valor }: { valor: (nome: string) => string }) {
  const [frequencia, setFrequencia] = useState(valor("repeticao"));
  const [terminoPor, setTerminoPor] = useState(valor("termino_por") || "contagem");

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-borda p-3">
      <legend className="px-1 text-sm font-medium">Repetição</legend>
      <Selecao
        rotulo="Repetir"
        name="repeticao"
        value={frequencia}
        onChange={(e) => setFrequencia(e.target.value)}
        opcoes={[
          { valor: "", texto: "Não repete" },
          { valor: "semanal", texto: "Toda semana" },
        ]}
      />

      {frequencia && (
        <>
          <p className="text-sm text-texto-suave">
            A Série repete no máximo toda semana, por até {MAXIMO_DE_MESES} meses, no dia da semana da data acima. Cada data vira um Evento
            numerado, na ordem das datas, que você pode editar à parte.
          </p>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm text-texto-suave">Termina</legend>
            <div className="grid grid-cols-[auto_1fr] items-end gap-x-3 gap-y-2">
              <input
                type="radio"
                name="termino_por"
                value="contagem"
                aria-label="Termina por número de Ocorrências"
                checked={terminoPor === "contagem"}
                onChange={() => setTerminoPor("contagem")}
                className="mb-3.5 size-4 accent-marca"
              />
              <Campo
                rotulo={`Depois de quantas Ocorrências (até ${MAXIMO_DE_OCORRENCIAS}, dentro de ${MAXIMO_DE_MESES} meses)`}
                name="termino_ocorrencias"
                type="number"
                min={1}
                max={MAXIMO_DE_OCORRENCIAS}
                defaultValue={valor("termino_ocorrencias") || "8"}
                onFocus={() => setTerminoPor("contagem")}
              />
              <input
                type="radio"
                name="termino_por"
                value="data"
                aria-label="Termina numa data"
                checked={terminoPor === "data"}
                onChange={() => setTerminoPor("data")}
                className="mb-3.5 size-4 accent-marca"
              />
              <Campo
                rotulo="Ou até a data (inclusive)"
                name="termino_data"
                type="date"
                defaultValue={valor("termino_data")}
                onFocus={() => setTerminoPor("data")}
              />
            </div>
          </fieldset>
        </>
      )}
    </fieldset>
  );
}
