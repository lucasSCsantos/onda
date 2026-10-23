"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Mensagens } from "@/components/formulario";
import { estadoDoPush, type Ambiente } from "@/dominio/push";
import { ativarPush, desativarPush, enviarTesteDePush, type EstadoDoPush } from "@/lib/push/acoes";

export type DispositivoNaTela = { id: string; nome: string; atual: boolean; criadoEm: string; usadoEm: string | null };

const dataEHora = (instante: string) =>
  new Date(instante).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

/** A chave pública VAPID (base64url) no formato que `pushManager.subscribe` pede. */
function chaveDoServidor(base64: string): Uint8Array<ArrayBuffer> {
  const preenchida = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const texto = atob(preenchida);
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

/** O navegador deste aparelho: o que ele sabe fazer, e se tem uma inscrição. Só existe depois de montar no cliente. */
function lerAmbiente(): Omit<Ambiente, "inscrito"> {
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const suportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return { suportado, apple, instalado, permissao: "Notification" in window ? Notification.permission : "default" };
}

/**
 * Ativar e desativar o push neste aparelho. O pedido de permissão do navegador só acontece no toque em "Ativar":
 * nada é pedido nem enviado ao abrir a página. Endpoint e chaves só passam do navegador para a ação do servidor.
 */
export function PainelDeNotificacoes({
  dispositivos,
  chavePublica,
  configurado,
}: {
  dispositivos: DispositivoNaTela[];
  chavePublica: string;
  configurado: boolean;
}) {
  const [ambiente, setAmbiente] = useState<Omit<Ambiente, "inscrito"> | null>(null);
  const [inscritoNoNavegador, setInscritoNoNavegador] = useState(false);
  const [mensagem, setMensagem] = useState<EstadoDoPush>({});
  const [ocupado, comecar] = useTransition();
  const [estadoDeDesativar, desativar, desativando] = useActionState(desativarPush, {});

  useEffect(() => {
    const lido = lerAmbiente();
    // Ler o navegador é o que há de externo aqui: só dá para fazer depois de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmbiente(lido);
    if (!lido.suportado) return;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setInscritoNoNavegador(Boolean(s)))
      .catch(() => {});
  }, [dispositivos]);

  const esteNaLista = dispositivos.some((d) => d.atual);
  const estado = ambiente && estadoDoPush({ ...ambiente, inscrito: inscritoNoNavegador && esteNaLista });

  const ativar = () =>
    comecar(async () => {
      setMensagem({});
      try {
        const permissao = await Notification.requestPermission();
        setAmbiente((a) => (a ? { ...a, permissao } : a));
        if (permissao !== "granted") return;
        const registro = await navigator.serviceWorker.ready;
        const inscricao =
          (await registro.pushManager.getSubscription()) ??
          (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveDoServidor(chavePublica) }));
        setMensagem(await ativarPush(inscricao.toJSON()));
        setInscritoNoNavegador(true);
      } catch {
        setMensagem({ erro: "Não foi possível ativar as Notificações neste aparelho." });
      }
    });

  const tirar = (id: string, atual: boolean) =>
    comecar(async () => {
      setMensagem({});
      // O navegador cancela a própria inscrição; o servidor remove a linha.
      if (atual || id === "todos") {
        try {
          await (await navigator.serviceWorker.ready).pushManager.getSubscription().then((s) => s?.unsubscribe());
          setInscritoNoNavegador(false);
        } catch {}
      }
      const dados = new FormData();
      dados.set("dispositivo", id);
      desativar(dados);
    });

  const testar = () =>
    comecar(async () => {
      setMensagem({});
      setMensagem(await enviarTesteDePush());
    });

  return (
    <div className="flex flex-col gap-5">
      {estado === null && <p className="text-sm text-texto-suave">Verificando este aparelho…</p>}

      {estado === "instalar" && (
        <div role="note" className="flex flex-col gap-2 rounded-xl border border-borda bg-fundo p-4 text-sm">
          <p className="font-semibold">Instale o app antes de ativar</p>
          <p className="text-texto-suave">
            No iPhone e no iPad, as Notificações só funcionam com o Mural na Tela de Início. Toque em <strong>Compartilhar</strong> (o quadrado
            com a seta) → <strong>Adicionar à Tela de Início</strong>, abra o Mural por esse ícone e volte a esta página.
          </p>
        </div>
      )}

      {estado === "nao_suportado" && (
        <p className="text-sm text-texto-suave">Este navegador não suporta Notificações push. Tente em outro navegador ou aparelho.</p>
      )}

      {estado === "bloqueado" && (
        <div role="note" className="flex flex-col gap-2 rounded-xl border border-borda bg-fundo p-4 text-sm">
          <p className="font-semibold">As Notificações estão bloqueadas neste aparelho</p>
          <p className="text-texto-suave">
            Para liberar, abra as configurações do navegador (ou toque no cadeado ao lado do endereço), procure Notificações do site do
            Mural, escolha <strong>Permitir</strong> e recarregue esta página. No iPhone: Ajustes → Notificações → Mural.
          </p>
        </div>
      )}

      {estado === "inativo" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-suave">Este aparelho ainda não recebe Notificações. O navegador vai pedir sua permissão ao tocar no botão.</p>
          <button type="button" onClick={ativar} disabled={ocupado || !configurado} className="botao-primario self-start">
            {ocupado ? "Ativando…" : "Ativar neste aparelho"}
          </button>
          {!configurado && <p className="text-sm text-texto-suave">As Notificações ainda não foram configuradas neste ambiente.</p>}
        </div>
      )}

      {estado === "ativo" && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm font-medium text-sucesso">
            Notificações ativas neste aparelho.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={testar} disabled={ocupado} className="botao-secundario">
              Enviar notificação de teste
            </button>
            <button
              type="button"
              onClick={() => tirar(dispositivos.find((d) => d.atual)!.id, true)}
              disabled={ocupado || desativando || !esteNaLista}
              className="botao-secundario"
            >
              Desativar neste aparelho
            </button>
          </div>
        </div>
      )}

      <Mensagens estado={mensagem.erro || mensagem.aviso ? mensagem : estadoDeDesativar} />

      {dispositivos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Seus dispositivos</h3>
          <ul className="flex flex-col divide-y divide-borda rounded-xl border border-borda">
            {dispositivos.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="flex flex-col">
                  <span className="font-medium">
                    {d.nome}
                    {d.atual && <span className="ml-2 text-xs text-marca">este aparelho</span>}
                  </span>
                  <span className="text-texto-suave">
                    Ativado em {dataEHora(d.criadoEm)}. {d.usadoEm ? `Último envio em ${dataEHora(d.usadoEm)}.` : "Nenhum envio ainda."}
                  </span>
                </span>
                <button type="button" onClick={() => tirar(d.id, d.atual)} disabled={ocupado || desativando} className="botao-secundario text-erro">
                  Desativar
                </button>
              </li>
            ))}
          </ul>
          {dispositivos.length > 1 && (
            <button type="button" onClick={() => tirar("todos", false)} disabled={ocupado || desativando} className="botao-secundario self-start text-erro">
              Desativar em todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
