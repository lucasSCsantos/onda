import Link from "next/link";
import { AniversarioNoDia } from "@/components/aniversarios";
import { SeloDoStatus, visualDoStatus } from "@/components/status-do-evento";
import type { Aniversario } from "@/dominio/aniversarios";
import { diasComEventos } from "@/dominio/calendario";
import { agruparPorDia, diaDe } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import type { EventoListado } from "@/lib/eventos/consultas";

const dataPorExtenso = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });

const dataCurta = (instante: Date) => instante.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });

export const hora = (instante: Date) => instante.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

/** "19:30–21:00", "Dia inteiro" ou "Dia inteiro, até 15/11", no fuso do Mural. */
function quando(evento: EventoListado): string {
  const outroDia = evento.fim && diaDe(evento.fim) !== diaDe(evento.inicio);
  if (evento.diaInteiro) return outroDia ? `Dia inteiro, até ${dataCurta(evento.fim!)}` : "Dia inteiro";
  if (!evento.fim) return hora(evento.inicio);
  return `${hora(evento.inicio)}–${outroDia ? `${dataCurta(evento.fim)} ` : ""}${hora(evento.fim)}`;
}

/**
 * A lista cronológica de Eventos, agrupada por dia no fuso America/Bahia. Com `dias`, mostra só esses dias, e um
 * Evento de vários dias aparece em cada um que cobre, como na grade do calendário.
 */
export function ListaDeEventos({
  eventos,
  dias,
  aniversarios = {},
  eu,
  vazio = "Nenhum Evento ainda.",
}: {
  eventos: EventoListado[];
  dias?: string[];
  /** Aniversários de cada dia de `dias`; um dia só com aniversário também entra na lista. */
  aniversarios?: Record<string, Aniversario[]>;
  /** Id de quem olha: os Eventos dele ganham destaque. */
  eu?: string;
  vazio?: string;
}) {
  const grupos = dias
    ? diasComEventos(eventos, dias, (dia) => (aniversarios[dia] ?? []).length > 0)
    : agruparPorDia(eventos);
  if (grupos.length === 0) return <p className="text-texto-suave">{vazio}</p>;

  return (
    <ol className="flex flex-col gap-6">
      {grupos.map(({ dia, eventos: doDia }) => (
        <li key={dia} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-texto-suave first-letter:uppercase">{dataPorExtenso(dia)}</h2>
          <ul className="flex flex-col gap-2">
            {(aniversarios[dia] ?? []).map((a) => (
              <AniversarioNoDia key={a.nome} aniversario={a} />
            ))}
            {doDia.map((evento) => (
              <CartaoDeEvento key={evento.id} evento={evento} eu={eu} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** O cartão de um Evento; o cartão inteiro abre o Evento. Os de `eu` (Responsável, Professor ou Auxiliar) ganham destaque. */
export function CartaoDeEvento({ evento, eu }: { evento: EventoListado; eu?: string }) {
  const meu = eu !== undefined && evento.envolvidos.includes(eu);
  return (
    <li
      className={`relative flex gap-3 rounded-2xl border bg-superficie p-4 hover:border-marca ${visualDoStatus(evento.status).borda} ${meu ? "ring-2 ring-marca" : ""}`}
    >
      <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: evento.categoria.cor }} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/eventos/${evento.id}`}
          className={`font-semibold break-words after:absolute after:inset-0 ${visualDoStatus(evento.status).titulo}`}
        >
          {evento.titulo}
        </Link>
        <p className="text-sm text-texto-suave">
          {quando(evento)} · {evento.categoria.nome}
          {evento.local && ` · ${evento.local}`}
        </p>
        <p className="text-sm text-texto-suave">{evento.responsavel ? `Responsável: ${evento.responsavel}` : "Sem Responsável"}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <SeloDoStatus status={evento.status} />
        {meu && <span className="text-xs font-semibold text-marca">Meu</span>}
      </div>
    </li>
  );
}
