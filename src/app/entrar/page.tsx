import type { Metadata } from "next";
import { CartaoAcesso } from "@/components/cartao-acesso";
import { FormularioEntrar } from "./formulario-entrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const { erro } = await searchParams;
  return (
    <CartaoAcesso titulo="Entrar no Mural">
      <FormularioEntrar linkInvalido={erro === "link-invalido"} />
    </CartaoAcesso>
  );
}
