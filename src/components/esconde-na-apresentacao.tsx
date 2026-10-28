"use client";

import { usePathname } from "next/navigation";

/** A página /sobre tem marca e fim de página próprios: o rodapé do app (com as logos do ministério) não aparece nela. */
export function EscondeNaApresentacao({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  return caminho === "/sobre" || caminho.startsWith("/sobre/") ? null : children;
}
