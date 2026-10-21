import type { Metadata } from "next";
import Link from "next/link";
import { CartaoAcesso } from "@/components/cartao-acesso";
import { NOMES_DOS_NIVEIS, type NivelDeAcesso } from "@/dominio/acesso";
import type { SituacaoDoConvite } from "@/dominio/convites";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioCadastro } from "./formulario-cadastro";

export const metadata: Metadata = { title: "Criar conta" };

const MOTIVOS: Record<SituacaoDoConvite, string> = {
  valido: "",
  usado: "Este convite já foi usado.",
  vencido: "Este convite venceu.",
  revogado: "Este convite foi cancelado pelo Admin.",
};

export default async function PaginaCadastro({ searchParams }: PageProps<"/cadastro">) {
  const { convite: parametro } = await searchParams;
  const codigo = typeof parametro === "string" ? parametro : "";

  if (!codigo) {
    return (
      <CartaoAcesso titulo="Criar conta">
        <p className="text-sm text-texto-suave">
          Sem convite, sua conta fica aguardando a aprovação de um Admin. Se recebeu um link de convite, abra por ele.
        </p>
        <FormularioCadastro />
      </CartaoAcesso>
    );
  }

  const supabase = await supabaseDoServidor();
  const { data: convite } = await supabase
    .rpc("consultar_convite", { codigo })
    .maybeSingle<{ situacao: SituacaoDoConvite; nivel: NivelDeAcesso; funcao: string | null }>();

  if (!convite || convite.situacao !== "valido") {
    return (
      <CartaoAcesso titulo="Convite inválido">
        <p className="text-sm text-texto-suave">
          {convite ? MOTIVOS[convite.situacao] : "Não encontramos este convite."} Peça um novo ao Admin, ou cadastre-se
          sem convite e aguarde a aprovação.
        </p>
        <Link href="/cadastro" className="text-center text-sm text-marca underline-offset-4 hover:underline">
          Criar conta sem convite
        </Link>
      </CartaoAcesso>
    );
  }

  return (
    <CartaoAcesso titulo="Criar conta">
      <p className="text-sm text-texto-suave">
        Seu convite é para <strong className="text-texto">{NOMES_DOS_NIVEIS[convite.nivel]}</strong>
        {convite.funcao ? (
          <>
            {" "}
            (<strong className="text-texto">{convite.funcao}</strong>)
          </>
        ) : null}
        . Ao criar a conta, você já entra no Mural.
      </p>
      <FormularioCadastro convite={codigo} />
    </CartaoAcesso>
  );
}
