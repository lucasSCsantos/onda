import type { Metadata } from "next";
import { nomeCurtoDoTipo } from "@/dominio/notificacoes";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { filaDeNotificacoes, SITUACOES_DA_FILA, type ItemDaFila, type SituacaoDaFila } from "@/lib/notificacoes/administracao";
import { envioPronto, modoDeTeste } from "@/lib/push/enviador";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { BotaoDeTeste, FormularioDeNotificacoes } from "./formulario";

export const metadata: Metadata = { title: "Notificações" };

const TITULOS: Record<SituacaoDaFila, string> = { pendente: "Pendentes", enviada: "Enviadas", falha: "Falhas" };
const VAZIO: Record<SituacaoDaFila, string> = { pendente: "Nada esperando para ser enviado.", enviada: "Nada enviado ainda.", falha: "Nenhuma falha." };

const dataEHora = (instante: Date) => instante.toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

function detalhe(situacao: SituacaoDaFila, item: ItemDaFila) {
  if (situacao === "enviada") return `enviada ${dataEHora(item.enviadaEm ?? item.criadaEm)}`;
  if (situacao === "pendente") return `criada ${dataEHora(item.criadaEm)} · próxima tentativa ${dataEHora(item.proximaTentativa)}`;
  return `criada ${dataEHora(item.criadaEm)} · ${item.tentativas} ${item.tentativas === 1 ? "tentativa" : "tentativas"}`;
}

export default async function PaginaDeNotificacoes() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const [config, fila] = await Promise.all([configuracoes(supabase), filaDeNotificacoes(supabase)]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <p className="text-sm text-texto-suave">Liga ou desliga o envio, ajusta os horários e mostra o que está na fila. Cada mudança fica registrada nos Logs.</p>
      </div>

      <section aria-label="Situação" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-borda bg-superficie p-4">
          <span className="text-2xl font-semibold">{config.notificacoes.ligado ? "Ligado" : "Desligado"}</span>
          <span className="text-sm text-texto-suave">Canal</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-borda bg-superficie p-4">
          <span className="text-2xl font-semibold">{fila.pessoasComDispositivo}</span>
          <span className="text-sm text-texto-suave">{fila.pessoasComDispositivo === 1 ? "pessoa com dispositivo" : "pessoas com dispositivo"}</span>
        </div>
        {SITUACOES_DA_FILA.filter((s) => s !== "enviada").map((s) => (
          <div key={s} className="flex flex-col rounded-2xl border border-borda bg-superficie p-4">
            <span className="text-2xl font-semibold">{fila.totais[s]}</span>
            <span className="text-sm text-texto-suave">{TITULOS[s].toLowerCase()}</span>
          </div>
        ))}
      </section>

      {!envioPronto() && !modoDeTeste() && (
        <p className="rounded-2xl border border-borda bg-superficie p-4 text-sm text-texto-suave">
          O envio ainda não está configurado neste ambiente (faltam chaves VAPID, chave de serviço ou segredo do agendador). As Notificações esperam na fila.
        </p>
      )}
      {modoDeTeste() && (
        <p className="rounded-2xl border border-borda bg-superficie p-4 text-sm text-texto-suave">
          Modo de teste: as Notificações só são registradas nos Logs, nada chega aos aparelhos.
        </p>
      )}

      <FormularioDeNotificacoes valores={config.notificacoes} />

      <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="font-semibold">Teste</h2>
        <p className="text-sm text-texto-suave">Envia uma notificação só para você, em todos os seus dispositivos. Ative as Notificações em Minha conta antes.</p>
        <BotaoDeTeste />
      </div>

      {SITUACOES_DA_FILA.map((situacao) => (
        <section key={situacao} className="flex flex-col gap-2">
          <h2 className="font-semibold">
            {TITULOS[situacao]} <span className="font-normal text-texto-suave">({fila.totais[situacao]})</span>
          </h2>
          {fila.itens[situacao].length === 0 ? (
            <p className="rounded-2xl border border-borda bg-superficie p-4 text-sm text-texto-suave">{VAZIO[situacao]}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {fila.itens[situacao].map((item) => (
                <li key={item.id} className="flex flex-col gap-0.5 p-4">
                  <span className="font-medium">
                    {nomeCurtoDoTipo(item.tipo)}
                    {item.urgente && <span className="ml-2 text-sm font-normal text-erro">urgente</span>}
                  </span>
                  <span className="text-sm text-texto-suave">{item.pessoa}</span>
                  <span className="text-sm text-texto-suave">{detalhe(situacao, item)}</span>
                </li>
              ))}
            </ul>
          )}
          {fila.totais[situacao] > fila.itens[situacao].length && (
            <p className="text-sm text-texto-suave">Mostrando as {fila.itens[situacao].length} mais recentes.</p>
          )}
        </section>
      ))}
    </main>
  );
}
