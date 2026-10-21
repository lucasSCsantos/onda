import Link from "next/link";
import { visualDoStatus } from "@/components/status-do-evento";
import { AniversarioNoDia } from "@/components/aniversarios";
import type { Aniversario } from "@/dominio/aniversarios";
import { eventosPorDia, type DiaDaGrade } from "@/dominio/calendario";
import { NOMES_DOS_STATUS } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import type { EventoListado } from "@/lib/eventos/consultas";
import { hora } from "../lista-de-eventos";

const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Quantos Eventos cabem num dia da visão mensal; o resto fica na semana daquele dia. */
const LIMITE_POR_DIA = 3;

const numeroDoDia = (dia: string) => Number(dia.slice(8));
const diaDaSemanaPorExtenso = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "short" });

/** Um Evento dentro de um dia: a cor da Categoria na borda, o Status no visual e a hora, se houver. */
function ChipDoEvento({ evento, comHora }: { evento: EventoListado; comHora: boolean }) {
  const visual = visualDoStatus(evento.status);
  return (
    <li
      title={`${evento.titulo} · ${evento.categoria.nome} · ${NOMES_DOS_STATUS[evento.status]}`}
      className={`rounded-md border border-l-4 bg-superficie px-1.5 py-0.5 text-xs leading-snug ${visual.borda}`}
      style={{ borderLeftColor: evento.categoria.cor, borderLeftStyle: "solid" }}
    >
      <span className={`block ${comHora ? "break-words" : "truncate"} ${visual.titulo}`}>
        {visual.marca && <span className="text-aviso">{visual.marca} </span>}
        {comHora && !evento.diaInteiro && <span className="text-texto-suave">{hora(evento.inicio)} </span>}
        {evento.titulo}
      </span>
      <span className="sr-only">
        , {evento.categoria.nome}, {NOMES_DOS_STATUS[evento.status]}
      </span>
    </li>
  );
}

function Aniversarios({ aniversarios, compacto }: { aniversarios: Aniversario[]; compacto?: boolean }) {
  if (aniversarios.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {aniversarios.map((a) => (
        <AniversarioNoDia key={a.nome + a.dia} aniversario={a} compacto={compacto} />
      ))}
    </ul>
  );
}

function EventosDoDia({ eventos, comHora }: { eventos: EventoListado[]; comHora: boolean }) {
  if (eventos.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {eventos.map((evento) => (
        <ChipDoEvento key={evento.id} evento={evento} comHora={comHora} />
      ))}
    </ul>
  );
}

/** A visão mensal: semanas de segunda a domingo, com os dias de outros meses esmaecidos. */
export function GradeDoMes({
  semanas,
  eventos,
  aniversarios,
  hoje,
}: {
  semanas: DiaDaGrade[][];
  eventos: EventoListado[];
  aniversarios: Record<string, Aniversario[]>;
  hoje: string;
}) {
  const porDia = eventosPorDia(eventos, semanas.flat().map((d) => d.dia));
  return (
    <div className="overflow-hidden rounded-2xl border border-borda">
      <div className="grid grid-cols-7 border-b border-borda bg-superficie text-center text-xs font-semibold text-texto-suave">
        {DIAS_DA_SEMANA.map((nome) => (
          <div key={nome} className="py-2">
            {nome}
          </div>
        ))}
      </div>
      {semanas.map((semana) => (
        <div key={semana[0].dia} className="grid grid-cols-7 border-b border-borda last:border-b-0">
          {semana.map(({ dia, doPeriodo }) => (
            <div
              key={dia}
              className={`flex min-h-24 min-w-0 flex-col gap-1 border-r border-borda p-1 last:border-r-0 ${doPeriodo ? "" : "bg-fundo opacity-60"}`}
            >
              <span
                className={`self-end rounded-full px-1.5 text-xs ${dia === hoje ? "bg-marca font-semibold text-marca-texto" : "text-texto-suave"}`}
              >
                {numeroDoDia(dia)}
              </span>
              <Aniversarios aniversarios={aniversarios[dia]} compacto />
              <EventosDoDia eventos={porDia[dia].slice(0, LIMITE_POR_DIA)} comHora={false} />
              {porDia[dia].length > LIMITE_POR_DIA && (
                <Link href={`/calendario?visao=semana&dia=${dia}`} className="px-1 text-xs text-texto-suave hover:text-texto">
                  +{porDia[dia].length - LIMITE_POR_DIA}
                  <span className="sr-only"> Eventos neste dia</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A visão semanal, de segunda a domingo: em colunas nas telas largas, um dia embaixo do outro no celular. */
export function GradeDaSemana({
  dias,
  eventos,
  aniversarios,
  hoje,
}: {
  dias: DiaDaGrade[];
  eventos: EventoListado[];
  aniversarios: Record<string, Aniversario[]>;
  hoje: string;
}) {
  const porDia = eventosPorDia(eventos, dias.map((d) => d.dia));
  return (
    <ol className="grid gap-2 md:grid-cols-7">
      {dias.map(({ dia }) => (
        <li key={dia} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-borda bg-superficie p-2 md:min-h-48">
          <h2
            className={`text-sm font-semibold first-letter:uppercase ${dia === hoje ? "text-marca" : "text-texto-suave"}`}
          >
            {diaDaSemanaPorExtenso(dia)}
            {dia === hoje && <span className="sr-only"> (hoje)</span>}
          </h2>
          <Aniversarios aniversarios={aniversarios[dia]} />
          {porDia[dia].length === 0 && aniversarios[dia].length === 0 ? (
            <p className="text-xs text-texto-suave md:sr-only">Nada neste dia.</p>
          ) : (
            <EventosDoDia eventos={porDia[dia]} comHora />
          )}
        </li>
      ))}
    </ol>
  );
}
