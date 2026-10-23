import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { LinhaDoTempo } from "@/components/linha-do-tempo";
import { SeloDoStatus, visualDoStatus } from "@/components/status-do-evento";
import { podeGerenciarContas } from "@/dominio/acesso";
import { nativosDe } from "@/dominio/campos-nativos";
import { podeCriarEvento, type CampoCadastrado } from "@/dominio/catalogo";
import {
  camposChecklist,
  camposDaCriacao,
  diaDe,
  entradaDoEvento,
  podeEditarEvento,
  podeExcluirEvento,
  podeVerTodosOsEventos,
  rotuloDaData,
  semResponsavel,
  statusNoMomento,
} from "@/dominio/eventos";
import { eChecklist } from "@/dominio/checklist";
import { situacaoDaPasta } from "@/dominio/drive";
import { FUSO } from "@/dominio/fuso";
import { podeVerHistoricoDoEvento } from "@/dominio/logs";
import { descreverRegra, formatarDia } from "@/dominio/series";
import { podeEditarSoAsObservacoes } from "@/dominio/professores";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirMural } from "@/lib/contas/perfil";
import { areasDaPessoa, evento as buscarEvento, pessoas, pessoasDaAula, serie as buscarSerie, type EventoCompleto } from "@/lib/eventos/consultas";
import { historicoDoEvento } from "@/lib/logs/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { BotaoExcluir } from "./botao-excluir";
import { Checklist } from "./checklist";
import { ObservacoesDaAula } from "./observacoes-da-aula";
import { PainelDaSerie } from "./painel-da-serie";

export const metadata: Metadata = { title: "Evento" };

const data = (instante: Date) =>
  instante.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });

const hora = (instante: Date) => instante.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

const momento = (instante: Date) =>
  instante.toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "sábado, 24 de outubro de 2026, 19:00–21:00", ou de dia inteiro, até outro dia, no fuso do Mural. */
function quando(evento: EventoCompleto): string {
  const outroDia = evento.fim && diaDe(evento.fim) !== diaDe(evento.inicio);
  if (evento.diaInteiro) return outroDia ? `De ${data(evento.inicio)} a ${data(evento.fim!)}` : `${data(evento.inicio)}, dia inteiro`;
  if (!evento.fim) return `${data(evento.inicio)}, ${hora(evento.inicio)}`;
  if (outroDia) return `De ${data(evento.inicio)}, ${hora(evento.inicio)}, a ${data(evento.fim)}, ${hora(evento.fim)}`;
  return `${data(evento.inicio)}, ${hora(evento.inicio)}–${hora(evento.fim)}`;
}

export default async function PaginaEvento(props: PageProps<"/eventos/[id]">) {
  const eu = await exigirMural();
  const { id } = await props.params;
  const supabase = await supabaseDoServidor();
  const [evento, areas] = await Promise.all([buscarEvento(supabase, id), areasDaPessoa(supabase, eu.id)]);
  if (!evento) notFound();
  const serie = evento.serieId ? await buscarSerie(supabase, evento.serieId) : null;

  const agora = new Date();
  const status = statusNoMomento(evento, agora);
  // O que a Categoria oculta não aparece, mesmo que o Evento ainda guarde o valor (ADR 0008).
  const nativos = nativosDe(evento.categoria);
  const pasta = situacaoDaPasta(evento.pastaEstado);
  const edita = podeEditarEvento(eu, areas, evento);
  // O Professor vê a aula inteira, mas não lê as outras contas: os nomes dela vêm por `pessoas_da_aula`.
  const soObservacoes = podeEditarSoAsObservacoes(eu, { campos: evento.campos, definicoes: evento.categoria.campos });
  const lideranca = podeVerTodosOsEventos(eu);
  const campos = camposDaCriacao(evento.categoria).filter((c) => evento.campos[c.id] !== undefined);
  const nomes = lideranca
    ? await pessoas(
        supabase,
        campos.filter((c) => c.tipo === "pessoa").map((c) => evento.campos[c.id] as string),
      )
    : await pessoasDaAula(supabase, id);
  const responsavel = evento.pessoaResponsavel ?? (evento.responsavel ? (nomes.get(evento.responsavel) ?? null) : null);
  // O histórico (logs) do Evento: o Admin sempre; o líder que edita, se o Admin ligar. A política de `logs` confere.
  const veHistorico =
    lideranca && podeVerHistoricoDoEvento(eu, areas, evento, (await configuracoes(supabase)).lideresVeemHistoricoDoEvento);
  const historico = veHistorico ? await historicoDoEvento(supabase, evento.id, evento.serieId) : [];
  // Os valores como o formulário os mostra (o valor em reais com vírgula, a lista um item por linha).
  const textos = entradaDoEvento(evento, evento.categoria).campos;

  const valorDoCampo = (campo: CampoCadastrado) => {
    const texto = textos[campo.id];
    switch (campo.tipo) {
      case "link":
        return <Externo href={texto} />;
      case "valor":
        return `R$ ${texto}`;
      case "data":
        return new Date(`${texto}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      case "data_hora":
        return texto.replace(/^(\d{4})-(\d{2})-(\d{2})T/, "$3/$2/$1, ");
      case "lista":
        return (
          <ul className="list-disc pl-5">
            {texto.split("\n").map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      case "pessoa": {
        const pessoa = nomes.get(texto);
        return pessoa ? `${pessoa.nome}${pessoa.ativo ? "" : " (desativado)"}` : "—";
      }
      default:
        return <span className="whitespace-pre-line">{texto}</span>;
    }
  };

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca={lideranca} calendario />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <Link href="/" className="text-sm text-texto-suave hover:text-texto">
          ‹ Eventos
        </Link>

        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-2.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: evento.categoria.cor }} />
          <h1 className={`min-w-0 flex-1 text-2xl font-semibold break-words ${visualDoStatus(status).titulo}`}>{evento.tituloDeExibicao}</h1>
          <SeloDoStatus status={status} />
        </div>

        <dl className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <Item rotulo={rotuloDaData(evento.categoria)}>
            <span className="first-letter:uppercase">{quando(nativos.fim === "oculto" ? { ...evento, fim: null } : evento)}</span>
          </Item>
          <Item rotulo="Categoria">{evento.categoria.nome}</Item>
          {serie && (
            <Item rotulo="Série">
              {descreverRegra(serie.regra)}, {serie.ocorrencias.length} Ocorrências
              {serie.encerradaEm && `, encerrada em ${formatarDia(serie.encerradaEm)}`}
              {evento.editada && ". Esta Ocorrência foi editada à parte: as edições de série não a sobrescrevem"}
            </Item>
          )}
          {evento.local && nativos.local !== "oculto" && <Item rotulo="Local">{evento.local}</Item>}
          <Item rotulo="Responsável">
            {semResponsavel({ ...evento, responsavel }, agora)
              ? `Sem Responsável${responsavel ? ` (${responsavel.nome} foi desativado)` : ""}`
              : `${responsavel!.nome}${responsavel!.ativo ? "" : " (desativado)"}`}
          </Item>
          {campos.map((c) => (
            <Item key={c.id} rotulo={c.nome}>
              {valorDoCampo(c)}
            </Item>
          ))}
          {camposChecklist(evento.categoria)
            .filter((c) => edita || evento.campos[c.id] !== undefined)
            .map((c) => {
              const itens = evento.campos[c.id];
              return (
                <Item key={c.id} rotulo={c.nome}>
                  <Checklist eventoId={evento.id} campoId={c.id} itens={eChecklist(itens) ? itens : []} edita={edita} />
                </Item>
              );
            })}
          {evento.link && nativos.link !== "oculto" && (
            <Item rotulo="Link">
              <Externo href={evento.link} />
            </Item>
          )}
          {evento.observacoes && !soObservacoes && nativos.observacoes !== "oculto" && (
            <Item rotulo="Observações">
              <span className="whitespace-pre-line">{evento.observacoes}</span>
            </Item>
          )}
        </dl>

        {pasta && (
          <p
            role="status"
            data-pasta={evento.pastaEstado}
            className={`rounded-xl border border-borda bg-superficie p-3 text-sm ${pasta.tom === "erro" ? "text-erro" : "text-texto-suave"}`}
          >
            {pasta.texto}
          </p>
        )}

        {soObservacoes && nativos.observacoes !== "oculto" && <ObservacoesDaAula eventoId={evento.id} observacoes={evento.observacoes} />}

        {lideranca && (
          <p className="text-sm text-texto-suave">
            Criado por {evento.criadoPor || "(sem nome)"} em {momento(evento.criadoEm)}.
            {evento.editadoEm && ` Editado por último por ${evento.editadoPor || "(sem nome)"} em ${momento(evento.editadoEm)}.`}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {edita && (
            <Link href={`/eventos/${evento.id}/editar`} className="botao-primario">
              Editar
            </Link>
          )}
          {(lideranca || soObservacoes) && evento.categoria.temChamada && (
            <Link href={`/eventos/${evento.id}/chamada`} className="botao-secundario">
              <ClipboardCheck aria-hidden className="size-5" />
              Chamada
            </Link>
          )}
          {podeExcluirEvento(eu) && <BotaoExcluir id={evento.id} />}
        </div>

        {veHistorico && (
          <details className="flex flex-col gap-3">
            <summary className="cursor-pointer font-semibold">Histórico do Evento</summary>
            <div className="pt-3">
              {historico.length === 0 ? (
                <p className="text-sm text-texto-suave">Nada registrado ainda. Os logs só contam o que aconteceu depois que entraram no ar.</p>
              ) : (
                <LinhaDoTempo logs={historico} agora={agora} existentes={new Set([evento.id])} />
              )}
            </div>
          </details>
        )}

        {serie && (
          <PainelDaSerie
            eventoId={evento.id}
            serieId={serie.id}
            pode={podeCriarEvento(eu, areas, evento.categoria)}
            podeExcluir={podeExcluirEvento(eu)}
          />
        )}
      </main>
    </>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm font-medium text-texto-suave">{rotulo}</dt>
      <dd className="-mt-3 break-words sm:mt-0">{children}</dd>
    </>
  );
}

function Externo({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all text-marca underline">
      {href}
    </a>
  );
}
