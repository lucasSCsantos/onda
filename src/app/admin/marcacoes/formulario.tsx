"use client";

import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, Mensagens } from "@/components/formulario";
import { ICONES } from "@/components/icone-da-marcacao";
import { ICONES_DAS_MARCACOES, NOMES_DOS_ICONES, PONTOS_MAXIMOS, type Marcacao } from "@/dominio/presenca";
import { salvarMarcacao } from "@/lib/presenca/acoes";

/** Cria (sem `marcacao`) ou edita uma Marcação: nome, ícone, pontos e as opções. */
export function FormularioDeMarcacao({ marcacao }: { marcacao?: Marcacao }) {
  const [estado, acao] = useActionState(salvarMarcacao.bind(null, marcacao?.id ?? null), {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Campo rotulo="Nome" name="nome" defaultValue={marcacao?.nome} maxLength={40} required />
        <Campo rotulo="Pontos no ranking" name="pontos" type="number" inputMode="numeric" min={0} max={PONTOS_MAXIMOS} defaultValue={marcacao?.pontos ?? 1} required />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Ícone</legend>
        <div className="flex flex-wrap gap-2">
          {ICONES_DAS_MARCACOES.map((icone) => {
            const Icone = ICONES[icone];
            return (
              <label
                key={icone}
                className="toque flex size-11 cursor-pointer items-center justify-center rounded-xl border border-borda has-checked:border-marca has-checked:bg-marca has-checked:text-marca-texto has-focus-visible:ring-2 has-focus-visible:ring-marca/40"
              >
                <input type="radio" name="icone" value={icone} defaultChecked={(marcacao?.icone ?? "check") === icone} className="sr-only" />
                <Icone aria-hidden className="size-5" />
                <span className="sr-only">{NOMES_DOS_ICONES[icone]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <CaixaDeMarcar rotulo="Conta como presença (só uma Marcação pode ter isto)" name="conta_presenca" defaultChecked={marcacao?.contaPresenca ?? false} />
        <CaixaDeMarcar rotulo="Pede o nome do visitante" name="pede_visitante" defaultChecked={marcacao?.pedeVisitante ?? false} />
        {marcacao && <CaixaDeMarcar rotulo="Ativa (desativada, some da Chamada, mas fica no histórico)" name="ativa" defaultChecked={marcacao.ativa} />}
      </div>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">{marcacao ? "Salvar" : "Criar Marcação"}</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
