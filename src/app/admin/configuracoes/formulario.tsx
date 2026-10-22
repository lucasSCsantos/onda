"use client";

import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, Mensagens } from "@/components/formulario";
import { RETENCAO_MAXIMA, RETENCAO_MINIMA } from "@/dominio/configuracoes";
import { salvarConfiguracoes } from "@/lib/configuracoes/acoes";

export type ValoresDasConfiguracoes = { retencaoDosLogsMeses: number; lideresVeemHistoricoDoEvento: boolean };

export function FormularioDeConfiguracoes({ valores }: { valores: ValoresDasConfiguracoes }) {
  const [estado, acao] = useActionState(salvarConfiguracoes, {});
  return (
    <form action={acao} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Logs</legend>
        <Campo
          rotulo="Guardar os logs por quantos meses"
          name="retencao"
          type="number"
          inputMode="numeric"
          min={RETENCAO_MINIMA}
          max={RETENCAO_MAXIMA}
          defaultValue={valores.retencaoDosLogsMeses}
          required
        />
        <p className="text-sm text-texto-suave">Todo dia, de madrugada, os logs mais antigos que isso são apagados.</p>
        <CaixaDeMarcar
          rotulo="Líderes veem o histórico dos Eventos que podem editar, dentro do próprio Evento"
          name="lideres_veem_historico"
          defaultChecked={valores.lideresVeemHistoricoDoEvento}
        />
      </fieldset>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
