"use client";

import { useActionState } from "react";
import { BotaoEnviar, CaixaDeMarcar, Mensagens, Selecao } from "@/components/formulario";
import { NOMES_DOS_TIPOS, TIPOS_DE_NOTIFICACAO, type PreferenciasDeNotificacao } from "@/dominio/notificacoes";
import { salvarPreferenciasDeNotificacao } from "@/lib/notificacoes/acoes";

const HORAS = Array.from({ length: 25 }, (_, h) => ({ valor: String(h), texto: `${h}h` }));

/** Que tipos de Notificação a pessoa recebe e em que horas. Fora da janela, o aviso espera abrir (os urgentes não esperam). */
export function PreferenciasDeNotificacao({ preferencias }: { preferencias: PreferenciasDeNotificacao }) {
  const [estado, acao] = useActionState(salvarPreferenciasDeNotificacao, {});
  return (
    <form action={acao} className="flex flex-col gap-4 border-t border-borda pt-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Quero ser avisado(a)</legend>
        {TIPOS_DE_NOTIFICACAO.map((tipo) => (
          <CaixaDeMarcar key={tipo} rotulo={NOMES_DOS_TIPOS[tipo]} name="tipo" value={tipo} defaultChecked={!preferencias.tiposDesligados.includes(tipo)} />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Horário das Notificações</legend>
        <div className="grid grid-cols-2 gap-3">
          <Selecao rotulo="Das" name="inicio" defaultValue={String(preferencias.janela.inicio)} opcoes={HORAS.slice(0, 24)} />
          <Selecao rotulo="Até" name="fim" defaultValue={String(preferencias.janela.fim)} opcoes={HORAS.slice(1)} />
        </div>
        <p className="text-sm text-texto-suave">
          Fora desse horário (de Salvador), os avisos esperam abrir. Só as mudanças urgentes, de um Evento que começa em poucas horas, chegam na hora. Todos
          ficam na central, em Notificações.
        </p>
      </fieldset>
      <div className="flex flex-col gap-2">
        <BotaoEnviar pendente="Salvando…">Salvar preferências</BotaoEnviar>
        <Mensagens estado={estado} />
      </div>
    </form>
  );
}
