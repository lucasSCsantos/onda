import { agruparPorDia, diaDe, NOMES_DOS_STATUS } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import type { EventoListado } from "@/lib/eventos/consultas";

const dataPorExtenso = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });

const dataCurta = (instante: Date) => instante.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });

const hora = (instante: Date) => instante.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

/** "19:30–21:00", "Dia inteiro" ou "Dia inteiro, até 15/11", no fuso do Mural. */
function quando(evento: EventoListado): string {
  const outroDia = evento.fim && diaDe(evento.fim) !== diaDe(evento.inicio);
  if (evento.diaInteiro) return outroDia ? `Dia inteiro, até ${dataCurta(evento.fim!)}` : "Dia inteiro";
  if (!evento.fim) return hora(evento.inicio);
  return `${hora(evento.inicio)}–${outroDia ? `${dataCurta(evento.fim)} ` : ""}${hora(evento.fim)}`;
}

/** A lista cronológica de Eventos, agrupada por dia no fuso America/Bahia. */
export function ListaDeEventos({ eventos }: { eventos: EventoListado[] }) {
  if (eventos.length === 0) return <p className="text-texto-suave">Nenhum Evento ainda.</p>;

  return (
    <ol className="flex flex-col gap-6">
      {agruparPorDia(eventos).map(({ dia, eventos: doDia }) => (
        <li key={dia} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-texto-suave first-letter:uppercase">{dataPorExtenso(dia)}</h2>
          <ul className="flex flex-col gap-2">
            {doDia.map((evento) => (
              <li
                key={evento.id}
                className={`flex gap-3 rounded-2xl border bg-superficie p-4 ${evento.status === "rascunho" ? "border-dashed border-texto-suave" : "border-borda"}`}
              >
                <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: evento.categoria.cor }} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-semibold break-words">{evento.titulo}</p>
                  <p className="text-sm text-texto-suave">
                    {quando(evento)} · {evento.categoria.nome}
                    {evento.local && ` · ${evento.local}`}
                  </p>
                  <p className="text-sm text-texto-suave">
                    {evento.responsavel ? `Responsável: ${evento.responsavel}` : "Sem Responsável"}
                  </p>
                </div>
                <span className="h-fit shrink-0 rounded-full border border-borda px-2 py-0.5 text-xs">{NOMES_DOS_STATUS[evento.status]}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
