import type { Metadata } from "next";
import { CartaoAcesso } from "@/components/cartao-acesso";
import { FormularioRecuperar } from "./formulario-recuperar";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function PaginaRecuperarSenha() {
  return (
    <CartaoAcesso titulo="Recuperar senha">
      <FormularioRecuperar />
    </CartaoAcesso>
  );
}
