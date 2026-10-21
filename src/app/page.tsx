import Link from "next/link";
import { redirect } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas, telaInicial } from "@/dominio/acesso";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { perfilAtual } from "@/lib/contas/perfil";
import { eventos } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { ListaDeEventos } from "./lista-de-eventos";

export default async function Inicio() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");
  const tela = telaInicial(perfil);
  const veEventos = podeVerTodosOsEventos(perfil);
  const lista = veEventos ? await eventos(await supabaseDoServidor()) : [];

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
          <section className="mt-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Eventos</h2>
              <Link href="/eventos/novo" className="rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto">
                Novo Evento
              </Link>
            </div>
            <ListaDeEventos eventos={lista} />
          </section>
        )}
      </main>
    </>
  );
}
