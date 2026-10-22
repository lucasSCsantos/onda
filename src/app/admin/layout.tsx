import { BarraLateralAdmin } from "@/components/barra-lateral-admin";
import { Cabecalho } from "@/components/cabecalho";
import { exigirAdmin } from "@/lib/contas/perfil";

/** Layout das telas de administração: header do Admin e, no desktop, a sidebar com as seções. */
export default async function LayoutDeAdmin({ children }: LayoutProps<"/admin">) {
  await exigirAdmin();
  return (
    <>
      <Cabecalho admin />
      <div className="flex flex-1">
        <BarraLateralAdmin />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
