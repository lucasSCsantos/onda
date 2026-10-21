import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { categoriasQuePodeCriar } from "@/dominio/catalogo";
import { exigirLideranca } from "@/lib/contas/perfil";
import { areasDaPessoa, categorias } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Novo Evento" };

/** Primeiro passo de criar um Evento: a Categoria, entre as das Áreas das Funções de quem cria. */
export default async function PaginaNovoEvento() {
  const eu = await exigirLideranca();
  const supabase = await supabaseDoServidor();
  const [todas, areas] = await Promise.all([categorias(supabase), areasDaPessoa(supabase, eu.id)]);
  const disponiveis = categoriasQuePodeCriar(eu, areas, todas);

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <Link href="/" className="text-sm text-texto-suave hover:text-texto">
          ‹ Eventos
        </Link>
        <h1 className="text-2xl font-semibold">Novo Evento</h1>
        {disponiveis.length === 0 ? (
          <p className="text-texto-suave">
            Você ainda não tem Função numa Área que crie Eventos. Fale com um Admin se precisar.
          </p>
        ) : (
          <>
            <p className="text-texto-suave">De que Categoria?</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {disponiveis.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/eventos/novo/${c.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-borda bg-superficie p-4 hover:bg-fundo"
                  >
                    <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                    <span className="font-semibold">{c.nome}</span>
                    <span className="ml-auto text-sm text-texto-suave">{c.area}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
