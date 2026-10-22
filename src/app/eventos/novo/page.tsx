import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { enderecoDoNovoEvento, lerDataDoNovoEvento } from "@/dominio/calendario";
import { categoriasQuePodeCriar } from "@/dominio/catalogo";
import { exigirLideranca } from "@/lib/contas/perfil";
import { areasDaPessoa, categorias } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Novo Evento" };

/**
 * Primeiro passo de criar um Evento: a Categoria, entre as das Áreas das Funções de quem cria. Uma data vinda do
 * Painel do dia (`data`) segue junto até o formulário.
 */
export default async function PaginaNovoEvento(props: PageProps<"/eventos/novo">) {
  const eu = await exigirLideranca();
  const data = lerDataDoNovoEvento(await props.searchParams);
  const supabase = await supabaseDoServidor();
  const [todas, areas] = await Promise.all([categorias(supabase), areasDaPessoa(supabase, eu.id)]);
  const disponiveis = categoriasQuePodeCriar(eu, areas, todas);

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
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
                    href={enderecoDoNovoEvento(data, c.id)}
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
