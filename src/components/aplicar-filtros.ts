"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { parametrosDosFiltros, PARAMETROS_DE_FILTRO, type Filtros } from "@/dominio/filtros";

/**
 * Troca os filtros na URL na hora: os parâmetros de filtro são refeitos e os outros (a visão e o dia do calendário)
 * ficam como estão.
 */
export function useAplicarFiltros(): { aplicar: (filtros: Filtros) => void; pendente: boolean } {
  const caminho = usePathname();
  const router = useRouter();
  const atual = useSearchParams();
  const [pendente, comecar] = useTransition();

  const aplicar = (novos: Filtros) => {
    const parametros = new URLSearchParams(atual);
    for (const nome of PARAMETROS_DE_FILTRO) parametros.delete(nome);
    for (const [nome, valor] of parametrosDosFiltros(novos)) parametros.append(nome, valor);
    const busca = parametros.toString();
    comecar(() => router.push(busca ? `${caminho}?${busca}` : caminho, { scroll: false }));
  };

  return { aplicar, pendente };
}
