import type { Metadata } from "next";
import { CartaoAcesso } from "@/components/cartao-acesso";
import { BotaoTentarDeNovo } from "./botao-tentar-de-novo";

export const metadata: Metadata = { title: "Sem internet" };

/** Mostrada pelo service worker quando uma página não carrega por falta de conexão. */
export default function PaginaOffline() {
  return (
    <CartaoAcesso titulo="Sem internet">
      <p className="text-sm text-texto-suave">
        O Mural precisa de conexão para mostrar os Eventos e salvar mudanças. Confira o Wi-Fi ou os dados móveis e tente
        de novo. Nada do que você digitou foi enviado.
      </p>
      <BotaoTentarDeNovo />
    </CartaoAcesso>
  );
}
