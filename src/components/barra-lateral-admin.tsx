"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAINEL, SECOES_DE_ADMIN } from "./destinos-admin";

/** Sidebar fixa da administração, só no desktop; no celular a mesma lista vive no menu hambúrguer do header. */
export function BarraLateralAdmin() {
  const caminho = usePathname();
  const atual = (href: string) => (href === PAINEL.href ? caminho === href : caminho === href || caminho.startsWith(`${href}/`));

  return (
    <nav aria-label="Administração" className="hidden w-56 shrink-0 self-start md:sticky md:top-0 flex-col gap-1 border-r border-borda bg-superficie p-3 md:flex">
      {[PAINEL, ...SECOES_DE_ADMIN].map(({ href, rotulo, icone: Icone }) => (
        <Link
          key={href}
          href={href}
          aria-current={atual(href) ? "page" : undefined}
          className="toque flex min-h-11 items-center gap-3 rounded-xl px-3 text-texto-suave hover:bg-fundo hover:text-texto active:bg-borda aria-[current=page]:bg-fundo aria-[current=page]:font-semibold aria-[current=page]:text-texto"
        >
          <Icone aria-hidden className="size-5" />
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}
