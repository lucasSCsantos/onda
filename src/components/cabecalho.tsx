import Link from "next/link";
import { Marca } from "./marca";
import { MenuDoCabecalho } from "./menu-do-cabecalho";

/**
 * Barra do topo das telas internas: logotipo e menu (hambúrguer no celular, em linha no desktop) com calendário e
 * Adolescentes (Liderança), Professores (quem tem Função em Ensino), "Administração" (só Admin, que chega a Professores pelo painel) e Sair.
 * O Professor vê só o calendário, com as aulas dele. No celular o header fica fixo no topo ao rolar.
 */
export function Cabecalho({
  admin = false,
  lideranca = admin,
  calendario = lideranca,
  professores = false,
}: {
  admin?: boolean;
  lideranca?: boolean;
  calendario?: boolean;
  professores?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borda bg-superficie px-4 py-3 md:static">
      <Link href="/" aria-label="Início">
        <Marca qual="logotipo" rotulo="ONDA" className="h-9 w-14 text-texto" />
      </Link>
      <MenuDoCabecalho admin={admin} lideranca={lideranca} calendario={calendario} professores={professores} />
    </header>
  );
}
