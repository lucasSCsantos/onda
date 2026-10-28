import Link from "next/link";
import { SeloDoStatus, visualDoStatus } from "@/components/status-do-evento";
import { AniversarioNoDia } from "@/components/aniversarios";
import type { Aniversario } from "@/dominio/aniversarios";
import { eventosPorDia, type DiaDaGrade } from "@/dominio/calendario";
import { NOMES_DOS_STATUS } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import type { EventoListado } from "@/lib/eventos/consultas";
import { hora } from "../lista-de-eventos";

const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Quantos Eventos cabem num dia da visão mensal no desktop; o resto fica no Painel do dia. */
const LIMITE_POR_DIA = 4;

/** Quantos pontos de Categoria cabem num dia da visão mensal no celular; depois deles vem um "+". */
const LIMITE_DE_PONTOS = 3;

const numeroDoDia = (dia: string) => Number(dia.slice(8));
const diaDaSemanaPorExtenso = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "short" });

const diaPorExtenso = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", month: "long" });

/**
 * Um Evento dentro de um dia, como link para ele: a cor da Categoria na borda, o Status no visual e a hora, se houver.
 * No mês, `grande` traz a hora e o selo de Status; a área de toque passa um pouco da borda sem mudar o desenho.
 */
function ChipDoEvento({ evento, comHora, grande, cartao }: { evento: EventoListado; comHora: boolean; grande?: boolean; cartao?: boolean }) {
  const visual = visualDoStatus(evento.status);
  const horaDoEvento = !evento.diaInteiro && (comHora || grande);
  return (
    <li
      title={`${evento.titulo} · ${evento.categoria.nome} · ${NOMES_DOS_STATUS[evento.status]}`}
      className={`relative rounded-md border border-l-4 bg-superficie leading-snug transition-colors hover:border-marca active:bg-borda ${cartao ? "min-h-11 px-2.5 py-2 text-base md:px-1.5 md:py-1 md:text-sm" : "px-1.5 py-1"} ${grande ? (cartao ? "" : "text-sm") : "text-xs"} ${visual.borda}`}
      style={{ borderLeftColor: evento.categoria.cor, borderLeftStyle: "solid" }}
    >
      <Link href={`/eventos/${evento.id}`} className={`block after:absolute after:-inset-1 ${comHora ? "break-words" : "truncate"} ${visual.titulo}`}>
        {visual.marca && <span className="text-aviso">{visual.marca} </span>}
        {horaDoEvento && <span className="font-semibold text-texto-suave">{hora(evento.inicio)} </span>}
        {evento.titulo}
        <span className="sr-only">
          , {evento.categoria.nome}, {NOMES_DOS_STATUS[evento.status]}
        </span>
      </Link>
      {grande && evento.status !== "planejado" && (
        <span aria-hidden className="mt-0.5 block">
          <SeloDoStatus status={evento.status} />
        </span>
      )}
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

function EventosDoDia({ eventos, comHora, grande, cartao }: { eventos: EventoListado[]; comHora: boolean; grande?: boolean; cartao?: boolean }) {
  if (eventos.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {eventos.map((evento) => (
        <ChipDoEvento key={evento.id} evento={evento} comHora={comHora} grande={grande} cartao={cartao} />
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
  abrir,
}: {
  semanas: DiaDaGrade[][];
  eventos: EventoListado[];
  aniversarios: Record<string, Aniversario[]>;
  hoje: string;
  /** O endereço do Calendário com o Painel do dia aberto naquele dia. */
  abrir: (dia: string) => string;
}) {
  const porDia = eventosPorDia(eventos, semanas.flat().map((d) => d.dia));
  return (
    <div className="overflow-hidden rounded-2xl border border-borda">
      <div className="grid grid-cols-7 border-b border-borda bg-superficie text-center text-xs font-medium uppercase tracking-wide text-texto-suave">
        {DIAS_DA_SEMANA.map((nome) => (
          <div key={nome} className="py-2">
            {nome}
          </div>
        ))}
      </div>
      {semanas.map((semana) => (
        <div key={semana[0].dia} className="grid grid-cols-7 border-b border-borda last:border-b-0">
          {semana.map(({ dia, doPeriodo }) => {
            const doDia = porDia[dia];
            const aniversariosDoDia = aniversarios[dia] ?? [];
            const painelDoDia = abrir(dia);
            return (
              <div
                key={dia}
                className={`relative flex min-h-28 min-w-0 flex-col gap-1 border-r border-borda p-1 last:border-r-0 md:min-h-36 ${doPeriodo ? "" : "bg-fundo opacity-60"}`}
              >
                {/* O número abre o Painel do dia; o link se estende pela célula, e os chips (relative) ficam por cima. */}
                <Link
                  href={painelDoDia}
                  scroll={false}
                  className={`self-end rounded-lg px-1.5 text-base after:absolute after:inset-0 md:text-xs ${dia === hoje ? "bg-marca font-semibold text-marca-texto" : "text-texto-suave"}`}
                >
                  {numeroDoDia(dia)}
                  <span className="sr-only">, abrir o dia ({diaPorExtenso(dia)})</span>
                </Link>

                {/* Celular: pontos de Categoria; qualquer toque na célula abre o Painel do dia. */}
                {(doDia.length > 0 || aniversariosDoDia.length > 0) && (
                  <div className="flex flex-wrap items-center justify-center gap-1 py-1 md:hidden">
                    {doDia.slice(0, LIMITE_DE_PONTOS).map((e) => (
                      <span key={e.id} aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: e.categoria.cor }} />
                    ))}
                    {doDia.length > LIMITE_DE_PONTOS && (
                      <span aria-hidden className="text-xs leading-none text-texto-suave">
                        +
                      </span>
                    )}
                    {aniversariosDoDia.length > 0 && <span aria-hidden>🎂</span>}
                    <span className="sr-only">
                      {doDia.length} Evento(s) e {aniversariosDoDia.length} aniversário(s) neste dia
                    </span>
                  </div>
                )}

                {/* Desktop: chips maiores, com hora e selo de Status. */}
                <div className="hidden flex-col gap-1.5 md:flex">
                  <Aniversarios aniversarios={aniversariosDoDia} compacto />
                  <EventosDoDia eventos={doDia.slice(0, LIMITE_POR_DIA)} comHora={false} grande />
                  {doDia.length > LIMITE_POR_DIA && (
                    <Link href={painelDoDia} scroll={false} className="relative px-1 text-xs text-texto-suave hover:text-texto">
                      +{doDia.length - LIMITE_POR_DIA}
                      <span className="sr-only"> Eventos neste dia</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
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
  abrir,
}: {
  dias: DiaDaGrade[];
  eventos: EventoListado[];
  aniversarios: Record<string, Aniversario[]>;
  hoje: string;
  abrir: (dia: string) => string;
}) {
  const porDia = eventosPorDia(eventos, dias.map((d) => d.dia));
  return (
    <ol className="grid gap-2 md:grid-cols-7">
      {dias.map(({ dia }) => (
        <li key={dia} className="relative flex min-w-0 flex-col gap-2 rounded-2xl border border-borda bg-superficie p-2 md:min-h-48">
          <h2 className={`text-sm font-semibold first-letter:uppercase ${dia === hoje ? "text-marca" : "text-texto-suave"}`}>
            <Link href={abrir(dia)} scroll={false} className="after:absolute after:inset-0">
              {diaDaSemanaPorExtenso(dia)}
              {dia === hoje && <span className="sr-only"> (hoje)</span>}
            </Link>
          </h2>
          <Aniversarios aniversarios={aniversarios[dia]} />
          {porDia[dia].length === 0 && aniversarios[dia].length === 0 ? (
            <p className="text-xs text-texto-suave md:sr-only">Nada neste dia.</p>
          ) : (
            <EventosDoDia eventos={porDia[dia]} comHora grande cartao />
          )}
        </li>
      ))}
    </ol>
  );
}
