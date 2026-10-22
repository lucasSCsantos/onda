"use client";

import { haFiltros, SEM_FILTROS, type Filtros } from "@/dominio/filtros";
import { useAplicarFiltros } from "./aplicar-filtros";

type Atalho = { rotulo: string; ligado: (f: Filtros) => boolean; alternar: (f: Filtros) => Filtros; soNoCalendario?: boolean };

const ATALHOS: Atalho[] = [
  { rotulo: "Meus eventos", ligado: (f) => f.meus, alternar: (f) => ({ ...f, meus: !f.meus }) },
  { rotulo: "Hoje", ligado: (f) => f.hoje, alternar: (f) => ({ ...f, hoje: !f.hoje }) },
  { rotulo: "Esta semana", ligado: (f) => f.semana, alternar: (f) => ({ ...f, semana: !f.semana }) },
  { rotulo: "Próximos", ligado: (f) => f.proximos, alternar: (f) => ({ ...f, proximos: !f.proximos }), soNoCalendario: true },
  {
    rotulo: "Rascunho",
    ligado: (f) => f.status === "rascunho",
    alternar: (f) => ({ ...f, status: f.status === "rascunho" ? null : "rascunho" }),
  },
  { rotulo: "Sem Responsável", ligado: (f) => f.semResponsavel, alternar: (f) => ({ ...f, semResponsavel: !f.semResponsavel }) },
  { rotulo: "Aula sem Professor", ligado: (f) => f.semProfessor, alternar: (f) => ({ ...f, semProfessor: !f.semProfessor }) },
  { rotulo: "Atrasados", ligado: (f) => f.atrasados, alternar: (f) => ({ ...f, atrasados: !f.atrasados }) },
];

/**
 * A barra de atalhos de filtro: cada um liga e desliga na hora, trocando a URL (os outros parâmetros, como a visão e o
 * dia do calendário, ficam). Uma linha que rola na horizontal no celular. "Próximos" só existe no Calendário.
 */
export function AtalhosDeFiltro({ filtros, calendario = false }: { filtros: Filtros; calendario?: boolean }) {
  const { aplicar: ir, pendente } = useAplicarFiltros();

  return (
    <div aria-label="Atalhos de filtro" role="group" aria-busy={pendente} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {ATALHOS.filter((a) => calendario || !a.soNoCalendario).map((atalho) => {
        const ligado = atalho.ligado(filtros);
        return (
          <button
            key={atalho.rotulo}
            type="button"
            aria-pressed={ligado}
            onClick={() => ir(atalho.alternar(filtros))}
            className={`toque inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap ${
              ligado
                ? "border-marca bg-marca text-marca-texto"
                : "border-borda bg-superficie text-texto hover:bg-fundo active:bg-borda"
            }`}
          >
            {atalho.rotulo}
          </button>
        );
      })}
      {haFiltros(filtros) && (
        <button
          type="button"
          onClick={() => ir(SEM_FILTROS)}
          className="toque inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm text-texto-suave whitespace-nowrap hover:text-texto active:bg-borda"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
