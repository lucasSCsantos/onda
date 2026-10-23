import { agruparPorDia } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import type { EventoListado } from "@/lib/eventos/consultas";
import { CartaoDeEvento } from "./lista-de-eventos";

const diaDaSemana = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });

/** Os Eventos de uma semana agrupados por dia, com o dia de hoje destacado; `vazio` aparece quando não há nenhum. */
export function SemanaPorDia({ eventos, hoje, eu, vazio }: { eventos: EventoListado[]; hoje: string; eu: string; vazio: string }) {
  if (eventos.length === 0) return <p className="text-texto-suave">{vazio}</p>;
  return (
    <ol className="flex flex-col gap-4">
      {agruparPorDia(eventos).map(({ dia, eventos: doDia }) => (
        <li key={dia} aria-current={dia === hoje ? "date" : undefined} className="flex flex-col gap-2">
          <h3 className={`text-sm font-semibold first-letter:uppercase ${dia === hoje ? "text-marca" : "text-texto-suave"}`}>
            {diaDaSemana(dia)}
            {dia === hoje && " · hoje"}
          </h3>
          <ul className="flex flex-col gap-2">
            {doDia.map((e) => (
              <CartaoDeEvento key={e.id} evento={e} eu={eu} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
