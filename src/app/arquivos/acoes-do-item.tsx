"use client";

import { Check, Copy, Download, ExternalLink, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const botao = "toque flex min-h-11 items-center justify-center gap-2 rounded-lg border border-borda bg-superficie px-3 text-sm";

/** Copia o link do arquivo no Drive. Sem a área de transferência (conexão sem https, navegador antigo), diz que não deu. */
function BotaoCopiar({ link }: { link: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "falhou">("parado");
  const aoClicar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setEstado("copiado");
    } catch {
      setEstado("falhou");
    }
    setTimeout(() => setEstado("parado"), 2500);
  };
  return (
    <button type="button" onClick={aoClicar} className={botao}>
      {estado === "copiado" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      <span role="status">{estado === "copiado" ? "Link copiado" : estado === "falhou" ? "Não foi possível copiar" : "Copiar link"}</span>
    </button>
  );
}

/** A imagem em tela cheia, servida pelo app; fecha com Esc, com o botão ou tocando fora. */
function Ampliar({ nome, endereco }: { nome: string; endereco: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={botao}>
        <Maximize2 aria-hidden className="size-4" />
        Ampliar
      </button>
      <dialog
        ref={dialogo}
        aria-label={`Prévia de ${nome}`}
        onClose={() => setAberto(false)}
        onClick={(e) => e.target === dialogo.current && setAberto(false)}
        className="m-auto max-h-[92dvh] max-w-[96vw] rounded-2xl border border-borda bg-superficie p-0 backdrop:bg-black/70"
      >
        {aberto && (
          <div className="relative flex flex-col">
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="toque absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-superficie/90">
              <X aria-hidden className="size-5" />
            </button>
            {/* O endereço é do próprio app (checa permissão e raiz): nada do Drive chega ao navegador. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={endereco} alt={nome} className="max-h-[92dvh] max-w-[96vw] rounded-2xl object-contain" />
          </div>
        )}
      </dialog>
    </>
  );
}

/** Abrir no Drive, copiar o link, baixar e (para imagens) ampliar. O que o app não oferece fica de fora. */
export function AcoesDoItem({
  nome,
  link,
  baixar,
  ampliar,
}: {
  nome: string;
  link: string;
  /** Endereço do download pelo app; ausente quando o arquivo passa do limite ou não tem tamanho. */
  baixar: string | null;
  /** Endereço da imagem ampliada pelo app; ausente quando não é imagem com prévia. */
  ampliar: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ampliar && <Ampliar nome={nome} endereco={ampliar} />}
      <a href={link} target="_blank" rel="noopener noreferrer" className={botao}>
        <ExternalLink aria-hidden className="size-4" />
        Abrir no Drive
      </a>
      <BotaoCopiar link={link} />
      {baixar && (
        <a href={baixar} download className={botao}>
          <Download aria-hidden className="size-4" />
          Baixar
        </a>
      )}
    </div>
  );
}
