"use client";

import { useActionState, useState, useTransition } from "react";
import { BotaoEnviar, CaixaDeMarcar, Campo, Mensagens } from "@/components/formulario";
import {
  HORA_DO_RESUMO_MAXIMA,
  HORA_DO_RESUMO_MINIMA,
  LEMBRETE_CURTO_MAXIMO,
  LEMBRETE_CURTO_MINIMO,
  LEMBRETE_LONGO_MAXIMO,
  LEMBRETE_LONGO_MINIMO,
  LIMITE_DE_URGENCIA_MAXIMO,
  LIMITE_DE_URGENCIA_MINIMO,
  RETENCAO_DA_CENTRAL_MAXIMA,
  RETENCAO_DA_CENTRAL_MINIMA,
} from "@/dominio/notificacoes";
import type { Configuracoes } from "@/lib/configuracoes/consultas";
import { salvarConfiguracaoDasNotificacoes } from "@/lib/notificacoes/acoes";
import { enviarTesteDePush, type EstadoDoPush } from "@/lib/push/acoes";

export type ValoresDasNotificacoes = Configuracoes["notificacoes"];

/** O interruptor do canal e os horários das Notificações. Cada mudança fica registrada nos Logs. */
export function FormularioDeNotificacoes({ valores }: { valores: ValoresDasNotificacoes }) {
  const [estado, acao] = useActionState(salvarConfiguracaoDasNotificacoes, {});
  return (
    <form action={acao} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Canal</legend>
        <CaixaDeMarcar rotulo="Canal de Notificações ligado" name="canal_ligado" defaultChecked={valores.ligado} />
        <p className="text-sm text-texto-suave">
          Desligado, nada é enviado aos aparelhos e os lembretes, o resumo e os alertas deixam de ser gerados. Designações e mudanças de Evento ainda entram
          na fila e na central dentro do app; o que perder a validade antes de religar some sem ser enviado.
        </p>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Horários</legend>
        <Campo
          rotulo="Primeiro lembrete, quantas horas antes do Evento"
          name="lembrete_longo"
          type="number"
          inputMode="numeric"
          min={LEMBRETE_LONGO_MINIMO}
          max={LEMBRETE_LONGO_MAXIMO}
          defaultValue={valores.lembreteLongoHoras}
          required
        />
        <Campo
          rotulo="Segundo lembrete, quantas horas antes do Evento"
          name="lembrete_curto"
          type="number"
          inputMode="numeric"
          min={LEMBRETE_CURTO_MINIMO}
          max={LEMBRETE_CURTO_MAXIMO}
          defaultValue={valores.lembreteCurtoHoras}
          required
        />
        <p className="text-sm text-texto-suave">Os lembretes vão só para quem é Responsável pelo Evento. O segundo precisa sair depois do primeiro.</p>
        <Campo
          rotulo="Resumo da semana: hora de domingo (0 a 23)"
          name="hora_do_resumo"
          type="number"
          inputMode="numeric"
          min={HORA_DO_RESUMO_MINIMA}
          max={HORA_DO_RESUMO_MAXIMA}
          defaultValue={valores.horaDoResumo}
          required
        />
        <Campo
          rotulo="Mudança ou cancelamento é urgente se o Evento começa em menos de (horas)"
          name="limite_de_urgencia"
          type="number"
          inputMode="numeric"
          min={LIMITE_DE_URGENCIA_MINIMO}
          max={LIMITE_DE_URGENCIA_MAXIMO}
          defaultValue={valores.limiteDeUrgenciaHoras}
          required
        />
        <p className="text-sm text-texto-suave">Os avisos urgentes chegam na hora, mesmo fora do horário que cada pessoa escolheu.</p>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 font-semibold">Central</legend>
        <Campo
          rotulo="Guardar as Notificações na central por quantos dias"
          name="retencao_das_notificacoes"
          type="number"
          inputMode="numeric"
          min={RETENCAO_DA_CENTRAL_MINIMA}
          max={RETENCAO_DA_CENTRAL_MAXIMA}
          defaultValue={valores.retencaoDias}
          required
        />
        <p className="text-sm text-texto-suave">Todo dia, de madrugada, as Notificações mais antigas que isso saem da central de cada pessoa. Por segurança, nenhuma sai antes de 8 dias.</p>
      </fieldset>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}

/** Envia uma Notificação de teste só para o próprio Admin, a todos os dispositivos dele. */
export function BotaoDeTeste() {
  const [mensagem, setMensagem] = useState<EstadoDoPush>({});
  const [ocupado, comecar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          comecar(async () => {
            setMensagem({});
            setMensagem(await enviarTesteDePush());
          })
        }
        className="toque min-h-11 rounded-lg border border-borda px-4 text-sm font-medium disabled:opacity-60"
      >
        {ocupado ? "Enviando…" : "Enviar notificação de teste para mim"}
      </button>
      <Mensagens estado={mensagem} />
    </div>
  );
}
