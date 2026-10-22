"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";
import { NOMES_DOS_STATUS, STATUS, type Status } from "@/dominio/eventos";
import { contarFiltrosAvancados, type Filtros } from "@/dominio/filtros";
import { useAplicarFiltros } from "./aplicar-filtros";

const campo =
  "min-h-11 rounded-lg border border-borda bg-superficie px-3 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30";

/**
 * Os filtros de Eventos que não são atalhos: Área e Categoria expostos, e o resto num painel "Filtros avançados" que
 * abre por baixo. Tudo se aplica na hora, pela URL. O painel abre sozinho quando já há filtro ligado dentro dele.
 */
export function FiltrosDeEventos({ filtros, categorias }: { filtros: Filtros; categorias: { id: string; nome: string; area: string }[] }) {
  const { aplicar, pendente } = useAplicarFiltros();
  const contador = contarFiltrosAvancados(filtros);
  const [aberto, setAberto] = useState(contador > 0);
  const painel = useId();
  const botaoDoPainel = useRef<HTMLButtonElement>(null);
  const areas = [...new Set(categorias.map((c) => c.area))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const varias = filtros.categorias.length > 1;

  return (
    <div aria-busy={pendente} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium">
          Área
          <select className={campo} value={filtros.area ?? ""} onChange={(e) => aplicar({ ...filtros, area: e.target.value || null })}>
            <option value="">Todas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium">
          Categoria
          <select
            className={campo}
            value={varias ? "varias" : (filtros.categorias[0] ?? "")}
            onChange={(e) => aplicar({ ...filtros, categorias: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Todas</option>
            {varias && <option value="varias">Várias ({filtros.categorias.length})</option>}
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <button
          ref={botaoDoPainel}
          type="button"
          aria-expanded={aberto}
          aria-controls={painel}
          onClick={() => setAberto(!aberto)}
          className="toque inline-flex min-h-11 items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-medium hover:bg-fundo active:bg-borda"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filtros avançados
          {contador > 0 && (
            <span
              aria-label={`${contador} ${contador === 1 ? "filtro ligado" : "filtros ligados"}`}
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-marca px-1.5 text-xs font-semibold text-marca-texto"
            >
              {contador}
            </span>
          )}
          <ChevronDown aria-hidden className={`size-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div
        id={painel}
        role="group"
        aria-label="Filtros avançados"
        hidden={!aberto}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          setAberto(false);
          botaoDoPainel.current?.focus();
        }}
        className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Dia
            <input
              type="date"
              className={campo}
              value={filtros.dia ?? ""}
              onChange={(e) => aplicar({ ...filtros, dia: e.target.value || null })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Status
            <select
              className={campo}
              value={filtros.status ?? ""}
              onChange={(e) => aplicar({ ...filtros, status: (e.target.value || null) as Status | null })}
            >
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {NOMES_DOS_STATUS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Categorias</legend>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <label key={c.id} className="toque flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-marca"
                  checked={filtros.categorias.includes(c.id)}
                  onChange={(e) =>
                    aplicar({
                      ...filtros,
                      categorias: e.target.checked ? [...filtros.categorias, c.id] : filtros.categorias.filter((id) => id !== c.id),
                    })
                  }
                />
                {c.nome}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
