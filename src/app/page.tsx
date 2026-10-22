import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { diaEMes } from "@/components/aniversarios";
import { Cabecalho } from "@/components/cabecalho";
import { AtalhosDeFiltro } from "@/components/atalhos-de-filtro";
import { FiltrosDeEventos } from "@/components/filtros-de-eventos";
import { aniversariosVisiveis, aniversariantesDoMes } from "@/dominio/aniversarios";
import { podeGerenciarContas, telaInicial } from "@/dominio/acesso";
import { diaDe, podeVerTodosOsEventos } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import { alertas, FILTRO_DO_ALERTA, filtrar, haFiltros, lerFiltros, NOMES_DOS_ALERTAS, parametrosDosFiltros, proximosEventos, SEM_FILTROS } from "@/dominio/filtros";
import { podeCadastrarProfessor } from "@/dominio/professores";
import { aniversariaveis } from "@/lib/aniversarios/consultas";
import { perfilAtual } from "@/lib/contas/perfil";
import { areasDaPessoa, categorias, eventos } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { CartaoDeEvento } from "./lista-de-eventos";

const GRUPOS = [
  { chave: "hoje", titulo: "Hoje" },
  { chave: "semana", titulo: "Esta semana" },
  { chave: "depois", titulo: "Depois" },
] as const;

export default async function Inicio(props: PageProps<"/">) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");
  const tela = telaInicial(perfil);
  const veEventos = podeVerTodosOsEventos(perfil);
  const agora = new Date();
  const filtros = lerFiltros(await props.searchParams);
  const supabase = await supabaseDoServidor();
  const [todos, doCatalogo, quemFazAnos] = veEventos
    ? await Promise.all([eventos(supabase), categorias(supabase), aniversariaveis(supabase, perfil)])
    : [[], [], []];
  // O Professor lê só as aulas em que foi colocado (as políticas por linha filtram); os demais níveis não consultam.
  const aulas = tela === "mural" && perfil.nivel === "professor" ? proximosEventos(await eventos(supabase), agora) : null;
  const areas = perfil.nivel === "lider" ? await areasDaPessoa(supabase, perfil.id) : [];
  const aniversariantes = aniversariosVisiveis(perfil, aniversariantesDoMes(quemFazAnos, diaDe(agora)));
  const proximos = proximosEventos(filtrar(todos, filtros, { eu: perfil.id, agora }), agora);
  const aviso = alertas(todos, agora);

  return (
    <>
      <Cabecalho
        admin={podeGerenciarContas(perfil)}
        lideranca={veEventos}
        calendario={veEventos || aulas !== null}
        professores={podeCadastrarProfessor(perfil, areas)}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold">Olá{perfil.nome ? `, ${perfil.nome}` : ""}!</h1>
        {tela === "aguardando-aprovacao" && (
          <p className="mt-2 text-texto-suave">
            Seu cadastro está aguardando a aprovação de um Admin. Você não precisa fazer nada: assim que houver a
            aprovação, o Mural aparece aqui.
          </p>
        )}
        {tela === "conta-desativada" && (
          <p className="mt-2 text-texto-suave">Sua conta foi desativada. Fale com um Admin se precisar de acesso.</p>
        )}
        {aulas && (
          <section className="mt-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Suas aulas</h2>
            {GRUPOS.every(({ chave }) => aulas[chave].length === 0) ? (
              <p className="text-texto-suave">Você ainda não foi colocado em nenhuma aula. Elas aparecem aqui assim que a Liderança escolher você.</p>
            ) : (
              GRUPOS.filter(({ chave }) => aulas[chave].length > 0).map(({ chave, titulo }) => (
                <div key={chave} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-texto-suave">{titulo}</h3>
                  <ul className="flex flex-col gap-2">
                    {aulas[chave].map((e) => (
                      <CartaoDeEvento key={e.id} evento={e} eu={perfil.id} mostraResponsavel={false} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}
        {veEventos && (
          <div className="mt-6 flex flex-col gap-6">
            {aviso.length > 0 && (
              <section aria-label="Alertas" className="flex flex-col gap-3 rounded-2xl border border-aviso p-4">
                <h2 className="font-semibold text-aviso">Precisam de atenção</h2>
                {aviso.map(({ tipo, eventos: doAlerta }) => (
                  <div key={tipo}>
                    <h3 className="text-sm font-semibold">
                      <Link
                        href={`/calendario?${new URLSearchParams(parametrosDosFiltros({ ...SEM_FILTROS, ...FILTRO_DO_ALERTA[tipo] }))}`}
                        className="underline"
                      >
                        {NOMES_DOS_ALERTAS[tipo]} ({doAlerta.length})
                      </Link>
                    </h3>
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {doAlerta.map((e) => (
                        <li key={e.id}>
                          <Link href={`/eventos/${e.id}`} className="underline">
                            {e.titulo}
                          </Link>
                          <span className="text-texto-suave"> · {e.inicio.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" })}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {aniversariantes.length > 0 && (
              <section aria-label="Aniversariantes do mês" className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
                <h2 className="font-semibold">Aniversariantes do mês</h2>
                <ul className="flex flex-col gap-1 text-sm">
                  {aniversariantes.map((a) => (
                    <li key={a.nome + a.dia}>
                      <span className="font-semibold tabular-nums">{diaEMes(a.dia)}</span> · {a.nome}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Próximos eventos</h2>
                <Link href="/eventos/novo" className="botao-primario">
                  <Plus aria-hidden className="size-5" />
                  Novo Evento
                </Link>
              </div>
              <AtalhosDeFiltro filtros={filtros} />
              <FiltrosDeEventos filtros={filtros} categorias={doCatalogo} />
              {GRUPOS.every(({ chave }) => proximos[chave].length === 0) ? (
                <p className="text-texto-suave">
                  {haFiltros(filtros) ? "Nenhum Evento com esses filtros." : "Nenhum Evento por vir."}
                </p>
              ) : (
                GRUPOS.filter(({ chave }) => proximos[chave].length > 0).map(({ chave, titulo }) => (
                  <div key={chave} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-texto-suave">{titulo}</h3>
                    <ul className="flex flex-col gap-2">
                      {proximos[chave].map((e) => (
                        <CartaoDeEvento key={e.id} evento={e} eu={perfil.id} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
