"use client";

import { useState } from "react";
import { CaixaDeMarcar, Campo, Selecao } from "@/components/formulario";
import { MAXIMO_DE_OCORRENCIAS, NOMES_DOS_DIAS } from "@/dominio/series";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const POSICOES = [
  { valor: "1", texto: "Primeiro" },
  { valor: "2", texto: "Segundo" },
  { valor: "3", texto: "Terceiro" },
  { valor: "4", texto: "Quarto" },
  { valor: "ultimo", texto: "Último" },
];

/** A repetição de um Evento novo: com ela, o Evento vira uma Série. `valor` devolve o que foi digitado, depois de um erro. */
export function Repeticao({ valor }: { valor: (nome: string) => string }) {
  const [frequencia, setFrequencia] = useState(valor("repeticao"));
  const [terminoPor, setTerminoPor] = useState(valor("termino_por") || "contagem");
  const diasMarcados = valor("repete_dias").split(",");

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
          { valor: "quinzenal", texto: "A cada duas semanas" },
          { valor: "mensal", texto: "Todo mês, num dia da semana" },
        ]}
      />

      {frequencia && (
        <>
          <p className="text-sm text-texto-suave">
            Cada data vira um Evento que você pode editar à parte. A primeira é o primeiro dia, a partir da data acima, que cai na regra.
          </p>

          {(frequencia === "semanal" || frequencia === "quinzenal") && (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="mb-1.5 text-sm text-texto-suave">Nos dias (sem nenhum marcado, repete no dia da semana da data)</legend>
              {DIAS_CURTOS.map((nome, dia) => (
                <CaixaDeMarcar key={dia} rotulo={nome} name="repete_dias" value={dia} defaultChecked={diasMarcados.includes(String(dia))} />
              ))}
            </fieldset>
          )}

          {frequencia === "mensal" && (
            <div className="grid grid-cols-2 gap-3">
              <Selecao rotulo="Posição" name="repete_posicao" opcoes={POSICOES} vazia="Escolha" defaultValue={valor("repete_posicao")} required />
              <Selecao
                rotulo="Dia da semana"
                name="repete_dia_da_semana"
                opcoes={NOMES_DOS_DIAS.map((nome, dia) => ({ valor: String(dia), texto: nome }))}
                vazia="Escolha"
                defaultValue={valor("repete_dia_da_semana")}
                required
              />
            </div>
          )}

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
                rotulo={`Depois de quantas Ocorrências (até ${MAXIMO_DE_OCORRENCIAS})`}
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
