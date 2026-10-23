import Link from "next/link";
import { Marca } from "./marca";
import { naoLidasDeQuemEstaLogado } from "@/lib/notificacoes/consultas";
import { MenuDoCabecalho } from "./menu-do-cabecalho";

/**
 * Barra do topo das telas internas: logotipo e menu (hambúrguer no celular, em linha no desktop) com calendário,
 * Adolescentes, Presença e Ranking (Liderança), Notificações (todos, com o número de não lidas), Professores (quem tem Função em Ensino e não é Admin), "Minha conta" (todos), "Administração" (só Admin, que chega a Professores pelo menu da administração) e Sair.
 * O Professor vê só o calendário, com as aulas dele. No celular o header fica fixo no topo ao rolar.
 */
export async function Cabecalho({
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
  const naoLidas = await naoLidasDeQuemEstaLogado();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borda bg-superficie px-4 py-3 md:static">
      <Link href="/" aria-label="Início">
        <Marca qual="logotipo" rotulo="ONDA" className="h-9 w-14 text-texto" />
      </Link>
      <MenuDoCabecalho admin={admin} lideranca={lideranca} calendario={calendario} professores={professores} naoLidas={naoLidas} />
    </header>
  );
}
