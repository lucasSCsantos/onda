import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { AtalhosDeFiltro } from "@/components/atalhos-de-filtro";
import { FiltrosDeEventos } from "@/components/filtros-de-eventos";
import { podeGerenciarContas } from "@/dominio/acesso";
import { aniversariosPorDia } from "@/dominio/aniversarios";
import { lerPosicao, navegar, periodoDaVisao, type Visao } from "@/dominio/calendario";
import { diaDe } from "@/dominio/eventos";
import { filtrar, lerFiltros, parametrosDosFiltros, type Filtros } from "@/dominio/filtros";
import { FUSO } from "@/dominio/fuso";
import { aniversariaveis } from "@/lib/aniversarios/consultas";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { podeCadastrarProfessor } from "@/dominio/professores";
import { exigirMural } from "@/lib/contas/perfil";
import { areasDaPessoa, categorias, eventos } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { ListaDeEventos } from "../lista-de-eventos";
import { GradeDaSemana, GradeDoMes } from "./grade";

export const metadata: Metadata = { title: "Calendário" };

const NOMES_DAS_VISOES: Record<Visao, string> = { lista: "Lista", mes: "Mês", semana: "Semana" };

/** O endereço de uma posição do calendário; os filtros ligados acompanham a navegação. */
const endereco = (filtros: Filtros, visao: Visao | null, dia?: string) => {
  const parametros = new URLSearchParams(parametrosDosFiltros(filtros));
  if (visao) parametros.set("visao", visao);
  if (dia) parametros.set("dia", dia);
  const busca = parametros.toString();
  return busca ? `/calendario?${busca}` : "/calendario";
};

const data = (dia: string, opcoes: Intl.DateTimeFormatOptions) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, ...opcoes });

/** "outubro de 2026", ou "19 a 25 de outubro de 2026" na semana. */
function tituloDoPeriodo(visao: Visao, dia: string, dias: string[]): string {
  if (visao !== "semana") return data(dia, { month: "long", year: "numeric" });
  const [primeiro, ultimo] = [dias[0], dias.at(-1)!];
  const mesmoMes = primeiro.slice(0, 7) === ultimo.slice(0, 7);
  return `${data(primeiro, mesmoMes ? { day: "numeric" } : { day: "numeric", month: "long" })} a ${data(ultimo, { day: "numeric", month: "long", year: "numeric" })}`;
}

/**
 * Sem visão na URL, o celular mostra a lista e as telas largas, o mês: as duas vêm prontas e o CSS escolhe.
 * As classes de cada aba e de cada visão seguem a mesma regra.
 */
const visivel = (visao: Visao, escolhida: Visao | null) => {
  if (escolhida) return visao === escolhida ? "" : "hidden";
  return visao === "lista" ? "md:hidden" : visao === "mes" ? "hidden md:block" : "hidden";
};
const ABA_ATIVA = "bg-marca text-marca-texto";
const ABA_INATIVA = "text-texto-suave hover:text-texto";
const classeDaAba = (visao: Visao, escolhida: Visao | null) => {
  if (escolhida) return visao === escolhida ? ABA_ATIVA : ABA_INATIVA;
  if (visao === "lista") return `${ABA_ATIVA} md:bg-transparent md:text-texto-suave`;
  if (visao === "mes") return `${ABA_INATIVA} md:bg-marca md:text-marca-texto`;
  return ABA_INATIVA;
};

export default async function PaginaCalendario(props: PageProps<"/calendario">) {
  const eu = await exigirMural();
  // O Professor vê só as aulas dele: sem Novo Evento, sem nomes de Responsável (e sem aniversários, que o banco já nega).
  const lideranca = podeVerTodosOsEventos(eu);
  const agora = new Date();
  const hoje = diaDe(agora);
  const parametros = await props.searchParams;
  const { visao, dia } = lerPosicao(parametros, agora);
  const filtros = lerFiltros(parametros);

  // Sem visão, a lista e o mês andam juntos, de mês em mês.
  const navegacao: Visao = visao ?? "mes";
  const mostra = (v: Visao) => (visao ? visao === v : v !== "semana");
  const periodos = { lista: periodoDaVisao("lista", dia), mes: periodoDaVisao("mes", dia), semana: periodoDaVisao("semana", dia) };
  const supabase = await supabaseDoServidor();
  const [doCatalogo, quemFazAnos, areas, ...periodosLidos] = await Promise.all([
    categorias(supabase),
    aniversariaveis(supabase, eu),
    eu.nivel === "lider" ? areasDaPessoa(supabase, eu.id) : Promise.resolve([]),
    ...(["lista", "mes", "semana"] as const).map((v) => (mostra(v) ? eventos(supabase, periodos[v]) : Promise.resolve([]))),
  ]);
  const [daLista, doMes, daSemana] = periodosLidos.map((lidos) => filtrar(lidos, filtros, { eu: eu.id, agora }));
  const aniversarios = (v: Visao) => aniversariosPorDia(quemFazAnos, periodos[v].semanas.flat().map((d) => d.dia));

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca={lideranca} calendario professores={podeCadastrarProfessor(eu, areas)} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold first-letter:uppercase">
            {tituloDoPeriodo(navegacao, dia, periodos[navegacao].semanas[0].map((d) => d.dia))}
          </h1>
          {lideranca && (
            <Link href="/eventos/novo" className="botao-primario">
              <Plus aria-hidden className="size-5" />
              Novo Evento
            </Link>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Período" className="flex items-center gap-2">
            <Link
              href={endereco(filtros, visao, navegar(navegacao, dia, -1))}
              aria-label={navegacao === "semana" ? "Semana anterior" : "Mês anterior"}
              className="botao-secundario"
            >
              ‹
            </Link>
            <Link href={endereco(filtros, visao)} className="botao-secundario text-sm">
              Hoje
            </Link>
            <Link
              href={endereco(filtros, visao, navegar(navegacao, dia, 1))}
              aria-label={navegacao === "semana" ? "Próxima semana" : "Próximo mês"}
              className="botao-secundario"
            >
              ›
            </Link>
          </nav>
          <nav aria-label="Visão" className="flex rounded-lg border border-borda bg-superficie p-0.5 text-sm">
            {(["lista", "mes", "semana"] as const).map((v) => (
              <Link
                key={v}
                href={endereco(filtros, v, dia === hoje ? undefined : dia)}
                aria-current={visao === v ? "page" : undefined}
                className={`rounded-md px-3 py-1 ${classeDaAba(v, visao)}`}
              >
                {NOMES_DAS_VISOES[v]}
              </Link>
            ))}
          </nav>
        </div>

        {lideranca && (
          <div className="mt-4">
            <AtalhosDeFiltro filtros={filtros} calendario />
          </div>
        )}

        <div className="mt-4">
          <FiltrosDeEventos
            caminho="/calendario"
            filtros={filtros}
            categorias={doCatalogo}
            ocultos={{ ...(visao ? { visao } : {}), ...(dia === hoje ? {} : { dia }) }}
          />
        </div>

        <div className="mt-6">
          {mostra("lista") && (
            <section aria-label="Lista" className={visivel("lista", visao)}>
              <ListaDeEventos
                eventos={daLista}
                dias={periodos.lista.semanas[0].map((d) => d.dia)}
                aniversarios={aniversarios("lista")}
                eu={eu.id}
                mostraResponsavel={lideranca}
                vazio="Nenhum Evento neste mês."
              />
            </section>
          )}
          {mostra("mes") && (
            <section aria-label="Mês" className={visivel("mes", visao)}>
              <GradeDoMes semanas={periodos.mes.semanas} eventos={doMes} aniversarios={aniversarios("mes")} hoje={hoje} />
            </section>
          )}
          {mostra("semana") && (
            <section aria-label="Semana" className={visivel("semana", visao)}>
              <GradeDaSemana dias={periodos.semana.semanas[0]} eventos={daSemana} aniversarios={aniversarios("semana")} hoje={hoje} />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
