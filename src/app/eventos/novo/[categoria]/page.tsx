import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { podeCriarEvento } from "@/dominio/catalogo";
import { rotuloDaData, STATUS_INICIAIS } from "@/dominio/eventos";
import { exigirLideranca } from "@/lib/contas/perfil";
import { areasDaPessoa, categoria as buscarCategoria, opcoesDaLideranca } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { criarEvento } from "@/lib/eventos/acoes";
import { FormularioEvento } from "../../formulario-evento";

export const metadata: Metadata = { title: "Novo Evento" };

export default async function PaginaNovoEventoDaCategoria(props: PageProps<"/eventos/novo/[categoria]">) {
  const eu = await exigirLideranca();
  const { categoria: id } = await props.params;
  const supabase = await supabaseDoServidor();
  const [categoria, areas, lideranca] = await Promise.all([
    buscarCategoria(supabase, id),
    areasDaPessoa(supabase, eu.id),
    opcoesDaLideranca(supabase),
  ]);
  if (!categoria || !podeCriarEvento(eu, areas, categoria)) notFound();

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <Link href="/eventos/novo" className="text-sm text-texto-suave hover:text-texto">
          ‹ Categorias
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: categoria.cor }} />
          Novo Evento: {categoria.nome}
        </h1>
        {/* Quem cria é o Responsável sugerido, e o Evento começa Planejado. */}
        <FormularioEvento
          acao={criarEvento.bind(null, categoria.id)}
          categoria={categoria}
          lideranca={lideranca}
          status={STATUS_INICIAIS}
          iniciais={{ responsavel: eu.id, status: "planejado" }}
          rotuloDaData={rotuloDaData(categoria)}
          botao={{ texto: "Criar Evento", pendente: "Criando…" }}
        />
      </main>
    </>
  );
}
