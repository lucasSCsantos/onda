import type { Metadata } from "next";
import { CartaoAcesso } from "@/components/cartao-acesso";
import { FormularioRedefinir } from "./formulario-redefinir";

export const metadata: Metadata = { title: "Nova senha" };

export default function PaginaRedefinirSenha() {
  return (
    <CartaoAcesso titulo="Criar nova senha">
      <FormularioRedefinir />
    </CartaoAcesso>
  );
}
