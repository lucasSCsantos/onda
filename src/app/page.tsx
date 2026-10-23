import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { diaEMes } from "@/components/aniversarios";
import { Cabecalho } from "@/components/cabecalho";
import { AtalhosDeFiltro } from "@/components/atalhos-de-filtro";
import { FiltrosDeEventos } from "@/components/filtros-de-eventos";
import { cartoesDeChamada, JANELA_MAXIMA } from "@/dominio/cartao-de-chamada";
import { aniversariosVisiveis, aniversariantesDaSemana } from "@/dominio/aniversarios";
import { podeGerenciarContas, telaInicial } from "@/dominio/acesso";
import { diaDe, podeVerTodosOsEventos } from "@/dominio/eventos";
import { FUSO, somarDias } from "@/dominio/fuso";
import { FILTRO_DO_ALERTA, haFiltros, lerFiltros, NOMES_DOS_ALERTAS, parametrosDosFiltros, proximosEventos, SEM_FILTROS } from "@/dominio/filtros";
import { semanaDe } from "@/dominio/semana";
import { podeCadastrarProfessor } from "@/dominio/professores";
import { montarTelaPrincipal } from "@/dominio/tela-principal";
import { aniversariaveis } from "@/lib/aniversarios/consultas";
import { janelaDaChamada } from "@/lib/configuracoes/consultas";
import { perfilAtual } from "@/lib/contas/perfil";
import { areasDaPessoa, categorias, eventos } from "@/lib/eventos/consultas";
import { chamadasFeitas } from "@/lib/presenca/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { CartoesDeChamada } from "./cartoes-de-chamada";
import { CartaoDeEvento } from "./lista-de-eventos";
import { SemanaPorDia } from "./semana-por-dia";

const GRUPOS = [
  { chave: "hoje", titulo: "Hoje" },
  { chave: "semana", titulo: "Esta semana" },
  { chave: "depois", titulo: "Depois" },
] as const;

// A tela só olha da segunda desta semana em diante (ou, se for antes, do começo da janela máxima do cartão de Chamada); o que já passou não entra na consulta (nem no teto de linhas do banco).
const FIM_DOS_TEMPOS = new Date("2100-01-01T00:00:00Z");

export default async function Inicio(props: PageProps<"/">) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");
  const tela = telaInicial(perfil);
  const veEventos = podeVerTodosOsEventos(perfil);
  const agora = new Date();
  const parametros = await props.searchParams;
  const filtros = lerFiltros(parametros);
  const soMeus = parametros["so-meus"] === "1";
  const supabase = await supabaseDoServidor();
  const [todos, doCatalogo, quemFazAnos] = veEventos
    ? await Promise.all([eventos(supabase, { inicio: new Date(Math.min(semanaDe(agora).inicio.getTime(), somarDias(agora, -(JANELA_MAXIMA + 1)).getTime())), fim: FIM_DOS_TEMPOS }), categorias(supabase), aniversariaveis(supabase, perfil)])
    : [[], [], []];
  // O Professor lê só as aulas em que foi colocado (as políticas por linha filtram); os demais níveis não consultam.
  const doProfessor = tela === "mural" && perfil.nivel === "professor" ? await eventos(supabase) : null;
  const aulas = doProfessor && proximosEventos(doProfessor, agora);
  const areas = perfil.nivel === "lider" ? await areasDaPessoa(supabase, perfil.id) : [];
  const aniversariantes = aniversariosVisiveis(perfil, aniversariantesDaSemana(quemFazAnos, agora));
  // O cartão de Chamada é de quem é Professor ou Auxiliar da aula, seja Professor ou Líder; só as aulas dele entram na conta.
  const candidatas = (doProfessor ?? todos).filter((e) => e.temChamada && e.professores.includes(perfil.id));
  const [janela, feitas] = candidatas.length > 0 ? await Promise.all([janelaDaChamada(supabase), chamadasFeitas(supabase, candidatas.map((e) => e.id))]) : [0, new Set<string>()];
  const cartoes = cartoesDeChamada(candidatas, { eu: perfil.id, agora, janelaDias: janela, feitas });
  const { meus, semana, alertas: aviso, depois } = montarTelaPrincipal(todos, { eu: perfil.id, agora, soMeus, filtros });
  const hoje = diaDe(agora);
  const alternarSoMeus = new URLSearchParams([
    ...Object.entries(parametros).flatMap(([chave, valor]) => (chave === "so-meus" ? [] : [valor ?? []].flat().map((v) => [chave, v] as [string, string]))),
    ...(soMeus ? [] : [["so-meus", "1"] as [string, string]]),
  ]);

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
        {cartoes.length > 0 && (
          <div className="mt-6">
            <CartoesDeChamada cartoes={cartoes} />
          </div>
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
            <section aria-labelledby="meus-da-semana" className="flex flex-col gap-3">
              <h2 id="meus-da-semana" className="text-xl font-semibold">
                Meus eventos desta semana
              </h2>
              <SemanaPorDia eventos={meus} hoje={hoje} eu={perfil.id} vazio="Você não tem eventos nesta semana." />
            </section>

            {aviso.length > 0 && (
              <section aria-label="Alertas" className="flex flex-col gap-3 rounded-2xl border border-aviso p-4">
                <h2 className="font-semibold text-aviso">Precisam de atenção nesta semana</h2>
                {aviso.map(({ tipo, eventos: doAlerta }) => (
                  <div key={tipo}>
                    <h3 className="text-sm font-semibold">
                      <Link
                        href={`/calendario?${new URLSearchParams(parametrosDosFiltros({ ...SEM_FILTROS, ...FILTRO_DO_ALERTA[tipo], semana: true }))}`}
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

            <section aria-labelledby="semana-no-onda" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h2 id="semana-no-onda" className="text-xl font-semibold">
                  Esta semana no ONDA
                </h2>
                <Link href={`/?${alternarSoMeus}`} className="botao-secundario toque text-sm">
                  {soMeus ? "Ver todos" : "Só os meus"}
                </Link>
              </div>
              <SemanaPorDia
                eventos={semana}
                hoje={hoje}
                eu={perfil.id}
                vazio={soMeus ? "Você não tem eventos nesta semana." : "Nenhum Evento nesta semana."}
              />
            </section>

            <section aria-labelledby="proximos-eventos" className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 id="proximos-eventos" className="text-xl font-semibold">
                  Próximos eventos
                </h2>
                <Link href="/eventos/novo" className="botao-primario">
                  <Plus aria-hidden className="size-5" />
                  Novo Evento
                </Link>
              </div>
              <AtalhosDeFiltro filtros={filtros} />
              <FiltrosDeEventos filtros={filtros} categorias={doCatalogo} />
              {depois.length === 0 ? (
                <p className="text-texto-suave">
                  {haFiltros(filtros) ? "Nenhum Evento com esses filtros." : "Nenhum Evento depois desta semana."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-texto-suave">Depois</h3>
                  <ul className="flex flex-col gap-2">
                    {depois.map((e) => (
                      <CartaoDeEvento key={e.id} evento={e} eu={perfil.id} />
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {aniversariantes.length > 0 && (
              <section aria-label="Aniversariantes da semana" className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
                <h2 className="font-semibold">Aniversariantes da semana</h2>
                <ul className="flex flex-col gap-1 text-sm">
                  {aniversariantes.map((a) => (
                    <li key={a.nome + a.dia}>
                      <span className="font-semibold tabular-nums">{diaEMes(a.dia)}</span> · {a.nome}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
