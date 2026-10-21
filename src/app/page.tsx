import Link from "next/link";
import { redirect } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { FiltrosDeEventos } from "@/components/filtros-de-eventos";
import { podeGerenciarContas, telaInicial } from "@/dominio/acesso";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { alertas, filtrar, haFiltros, lerFiltros, NOMES_DOS_ALERTAS, proximosEventos } from "@/dominio/filtros";
import { perfilAtual } from "@/lib/contas/perfil";
import { categorias, eventos } from "@/lib/eventos/consultas";
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
  const [todos, doCatalogo] = veEventos ? await Promise.all([eventos(supabase), categorias(supabase)]) : [[], []];
  const proximos = proximosEventos(filtrar(todos, filtros, { eu: perfil.id, agora }), agora);
  const aviso = alertas(todos, agora);

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(perfil)} lideranca={veEventos} />
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
        {tela === "mural" && !veEventos && <p className="mt-2 text-texto-suave">Suas aulas vão aparecer aqui.</p>}
        {veEventos && (
          <div className="mt-6 flex flex-col gap-6">
            {aviso.length > 0 && (
              <section aria-label="Alertas" className="flex flex-col gap-3 rounded-2xl border border-aviso p-4">
                <h2 className="font-semibold text-aviso">Precisam de atenção</h2>
                {aviso.map(({ tipo, eventos: doAlerta }) => (
                  <div key={tipo}>
                    <h3 className="text-sm font-semibold">
                      {NOMES_DOS_ALERTAS[tipo]} ({doAlerta.length})
                    </h3>
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {doAlerta.map((e) => (
                        <li key={e.id}>
                          <Link href={`/eventos/${e.id}`} className="underline">
                            {e.titulo}
                          </Link>
                          <span className="text-texto-suave"> · {e.inicio.toLocaleDateString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit" })}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Próximos eventos</h2>
                <Link href="/eventos/novo" className="rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto">
                  Novo Evento
                </Link>
              </div>
              <FiltrosDeEventos caminho="/" filtros={filtros} categorias={doCatalogo} />
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
