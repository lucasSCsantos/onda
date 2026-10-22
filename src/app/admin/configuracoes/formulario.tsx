"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, Mensagens, Selecao, type Opcao } from "@/components/formulario";
import { FALTAS_MAXIMAS, FALTAS_MINIMAS, RETENCAO_MAXIMA, RETENCAO_MINIMA } from "@/dominio/configuracoes";
import { salvarConfiguracoes } from "@/lib/configuracoes/acoes";

export type ValoresDasConfiguracoes = {
  retencaoDosLogsMeses: number;
  lideresVeemHistoricoDoEvento: boolean;
  faltasParaAlerta: number;
  desempatePor: string | null;
};

/** `marcacoes`: as opções do desempate do ranking. */
export function FormularioDeConfiguracoes({ valores, marcacoes }: { valores: ValoresDasConfiguracoes; marcacoes: Opcao[] }) {
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
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Presença</legend>
        <Campo
          rotulo="Avisar quando um Adolescente faltar a quantas aulas seguidas"
          name="faltas_para_alerta"
          type="number"
          inputMode="numeric"
          min={FALTAS_MINIMAS}
          max={FALTAS_MAXIMAS}
          defaultValue={valores.faltasParaAlerta}
          required
        />
        <p className="text-sm text-texto-suave">
          O aviso aparece na tela de Presença. As Marcações e os pontos ficam em{" "}
          <Link href="/admin/marcacoes" className="underline">
            Marcações
          </Link>
          .
        </p>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Ranking</legend>
        <Selecao
          rotulo="Desempate: no empate de pontos, fica na frente quem tem mais"
          name="desempate"
          defaultValue={valores.desempatePor ?? ""}
          opcoes={[...marcacoes, { valor: "", texto: "Nenhum: o empate divide a posição" }]}
        />
      </fieldset>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
