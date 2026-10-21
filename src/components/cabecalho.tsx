import Link from "next/link";
import { sair } from "@/lib/auth/acoes";
import { Marca } from "./marca";

/** Barra do topo das telas internas: logotipo, calendário e Adolescentes (Liderança), atalhos da administração (só Admin) e Sair. */
export function Cabecalho({ admin = false, lideranca = admin }: { admin?: boolean; lideranca?: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-borda bg-superficie px-4 py-3">
      <Link href="/" aria-label="Início">
        <Marca qual="logotipo" rotulo="ONDA" className="h-9 w-14 text-texto" />
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
        {lideranca && (
          <Link href="/calendario" className="text-texto-suave hover:text-texto">
            Calendário
          </Link>
        )}
        {lideranca && (
          <Link href="/adolescentes" className="text-texto-suave hover:text-texto">
            Adolescentes
          </Link>
        )}
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
            <Link href="/admin/exportar" className="text-texto-suave hover:text-texto">
              Exportar
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
