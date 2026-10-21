import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import type { Opcao } from "@/components/formulario";
import { podeGerenciarContas } from "@/dominio/acesso";
import { entradaDoEvento, podeEditarEvento, rotuloDaData, statusDaEdicao, statusNoMomento } from "@/dominio/eventos";
import { nomeDoCampoEspecifico } from "@/lib/campos";
import { exigirLideranca } from "@/lib/contas/perfil";
import { editarEvento } from "@/lib/eventos/acoes";
import { areasDaPessoa, evento as buscarEvento, opcoesDaLideranca, pessoas } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioEvento } from "../../formulario-evento";

export const metadata: Metadata = { title: "Editar Evento" };

export default async function PaginaEditarEvento(props: PageProps<"/eventos/[id]/editar">) {
  const eu = await exigirLideranca();
  const { id } = await props.params;
  const supabase = await supabaseDoServidor();
  const [evento, areas, lideranca] = await Promise.all([
    buscarEvento(supabase, id),
    areasDaPessoa(supabase, eu.id),
    opcoesDaLideranca(supabase),
  ]);
  if (!evento || !podeEditarEvento(eu, areas, evento)) notFound();

  const agora = new Date();
  const { campos, ...comuns } = entradaDoEvento(evento, evento.categoria);
  const iniciais: Record<string, string> = {
    ...comuns,
    status: statusNoMomento(evento, agora),
    data_fim: comuns.dataFim,
    hora_fim: comuns.horaFim,
    ...Object.fromEntries(Object.entries(campos).map(([campo, texto]) => [nomeDoCampoEspecifico(campo), texto])),
  };

  // Quem já está no Evento e foi desativado continua entre as opções, para poder ficar.
  const ativos = new Set(lideranca.map((p) => p.valor));
  const camposPessoa = evento.categoria.campos.filter((c) => c.tipo === "pessoa").map((c) => campos[c.id]);
  const gravadas = [evento.responsavel, ...camposPessoa].filter((v): v is string => !!v && !ativos.has(v));
  const desativadas = [...(await pessoas(supabase, gravadas)).values()];
  const opcoes: Opcao[] = [...lideranca, ...desativadas.map((p) => ({ valor: p.id, texto: `${p.nome || "(sem nome)"} (desativado)` }))];

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <Link href={`/eventos/${evento.id}`} className="text-sm text-texto-suave hover:text-texto">
          ‹ {evento.titulo}
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: evento.categoria.cor }} />
          Editar Evento: {evento.categoria.nome}
        </h1>
        {evento.status === "adiado" && (
          <p className="text-sm text-texto-suave">Mudar a data ou o horário remarca o Evento, que volta a Planejado.</p>
        )}
        <FormularioEvento
          acao={editarEvento.bind(null, evento.id)}
          categoria={evento.categoria}
          lideranca={opcoes}
          status={statusDaEdicao(eu, evento, agora)}
          iniciais={iniciais}
          rotuloDaData={rotuloDaData(evento.categoria)}
          botao={{ texto: "Salvar", pendente: "Salvando…" }}
        />
      </main>
    </>
  );
}
