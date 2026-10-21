import Link from "next/link";
import { sair } from "@/lib/auth/acoes";
import { Marca } from "./marca";

/** Barra do topo das telas internas: logotipo, atalho da administração (só Admin) e Sair. */
export function Cabecalho({ admin = false }: { admin?: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-borda bg-superficie px-4 py-3">
      <Link href="/" aria-label="Início">
        <Marca qual="logotipo" rotulo="ONDA" className="h-9 w-14 text-texto" />
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {admin && (
          <>
            <Link href="/admin/usuarios" className="text-texto-suave hover:text-texto">
              Usuários
            </Link>
            <Link href="/admin/convites" className="text-texto-suave hover:text-texto">
              Convites
            </Link>
            <Link href="/admin/catalogo" className="text-texto-suave hover:text-texto">
              Catálogo
            </Link>
          </>
        )}
        <form action={sair}>
          <button type="submit" className="text-texto-suave hover:text-texto">
            Sair
          </button>
        </form>
      </nav>
    </header>
  );
}
