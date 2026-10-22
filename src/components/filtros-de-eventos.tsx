import Link from "next/link";
import { NOMES_DOS_STATUS, STATUS } from "@/dominio/eventos";
import { haFiltros, type Filtros } from "@/dominio/filtros";
import { CaixaDeMarcar, Campo, Selecao } from "./formulario";

/**
 * Os filtros de Eventos como um formulário GET: o resultado vai para a URL e a página se refaz no servidor.
 * `ocultos` são os outros parâmetros da página (a visão e o dia do calendário) que precisam sobreviver ao filtrar.
 */
export function FiltrosDeEventos({
  caminho,
  filtros,
  categorias,
  ocultos = {},
}: {
  caminho: string;
  filtros: Filtros;
  categorias: { id: string; nome: string; area: string }[];
  ocultos?: Record<string, string>;
}) {
  const areas = [...new Set(categorias.map((c) => c.area))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return (
    <details open={haFiltros(filtros)} className="rounded-2xl border border-borda bg-superficie p-4">
      <summary className="cursor-pointer text-sm font-semibold">Filtros{haFiltros(filtros) && " (ligados)"}</summary>
      <form action={caminho} method="get" className="mt-4 flex flex-col gap-4">
        {Object.entries(ocultos).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <CaixaDeMarcar rotulo="Meus eventos" name="meus" value="1" defaultChecked={filtros.meus} />
          <CaixaDeMarcar rotulo="Esta semana" name="semana" value="1" defaultChecked={filtros.semana} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Dia" type="date" name="data" defaultValue={filtros.dia ?? ""} />
          <Selecao
            rotulo="Área"
            name="area"
            vazia="Todas"
            defaultValue={filtros.area ?? ""}
            opcoes={areas.map((area) => ({ valor: area, texto: area }))}
          />
          <Selecao
            rotulo="Status"
            name="status"
            vazia="Todos"
            defaultValue={filtros.status ?? ""}
            opcoes={STATUS.map((s) => ({ valor: s, texto: NOMES_DOS_STATUS[s] }))}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Categorias</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {categorias.map((c) => (
              <CaixaDeMarcar key={c.id} rotulo={c.nome} name="categoria" value={c.id} defaultChecked={filtros.categorias.includes(c.id)} />
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-4">
          <button type="submit" className="botao-primario">
            Filtrar
          </button>
          {haFiltros(filtros) && (
            <Link
              href={{ pathname: caminho, query: ocultos }}
              className="text-sm text-texto-suave hover:text-texto"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}
