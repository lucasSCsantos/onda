import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { diaDe } from "@/dominio/eventos";
import { FUSO } from "@/dominio/fuso";
import { podeFazerChamada } from "@/dominio/presenca";
import { exigirLideranca } from "@/lib/contas/perfil";
import { areasDaPessoa, evento as buscarEvento } from "@/lib/eventos/consultas";
import { adolescentes, chamadaDaAula, marcacoes } from "@/lib/presenca/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { Chamada } from "./chamada";

// Dados de menores: fora de buscadores (o layout já diz o mesmo; aqui fica explícito).
export const metadata: Metadata = { title: "Chamada", robots: { index: false, follow: false } };

const data = (instante: Date) => instante.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });

export default async function PaginaDaChamada(props: PageProps<"/eventos/[id]/chamada">) {
  const eu = await exigirLideranca();
  const { id } = await props.params;
  const supabase = await supabaseDoServidor();
  const [evento, areas, todas, presencas, cadastro] = await Promise.all([
    buscarEvento(supabase, id),
    areasDaPessoa(supabase, eu.id),
    marcacoes(supabase),
    chamadaDaAula(supabase, id),
    adolescentes(supabase),
  ]);
  if (!evento || !evento.categoria.temChamada) notFound();

  const agora = new Date();
  const pode = podeFazerChamada(eu, areas, { categoria: evento.categoria, status: evento.status, inicio: evento.inicio }, agora);
  const motivo =
    evento.status === "cancelado"
      ? "Esta aula foi cancelada: não há chamada."
      : diaDe(evento.inicio) > diaDe(agora)
        ? "A chamada abre no dia da aula."
        : `Só o Admin e quem tem Função na Área ${evento.categoria.area} fazem a chamada. Você pode acompanhar.`;

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <Link href={`/eventos/${evento.id}`} className="text-sm text-texto-suave hover:text-texto">
          ‹ {evento.tituloDeExibicao}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Chamada</h1>
          <p className="text-sm text-texto-suave first-letter:uppercase">
            {evento.categoria.nome} · {evento.tituloDeExibicao} · {data(evento.inicio)}
          </p>
        </div>
        {pode ? (
          <p className="text-sm text-texto-suave">Toque nas Marcações de cada um. Tudo é salvo na hora, e dá para corrigir depois.</p>
        ) : (
          <p role="status" className="rounded-xl bg-fundo p-3 text-sm">
            {motivo}
          </p>
        )}
        <Chamada
          eventoId={evento.id}
          adolescentes={cadastro.filter((a) => a.ativo).map(({ id, nome }) => ({ id, nome }))}
          marcacoes={todas.filter((m) => m.ativa)}
          iniciais={presencas}
          pode={pode}
        />
      </main>
    </>
  );
}
