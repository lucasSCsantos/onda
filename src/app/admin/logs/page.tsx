import { Download, Search, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Campo, Selecao } from "@/components/formulario";
import { LinhaDoTempo } from "@/components/linha-do-tempo";
import { FUSO } from "@/dominio/fuso";
import {
  acoesDoModulo,
  contarFiltrosDosLogs,
  definicaoDaAcao,
  FILTROS_PADRAO,
  lerFiltrosDosLogs,
  MODULOS,
  NOMES_DAS_SEVERIDADES,
  NOMES_DOS_MODULOS,
  NOMES_DOS_PERIODOS,
  NOMES_DOS_RESULTADOS,
  parametrosDosLogs,
  PERIODOS,
  RESULTADOS,
  SEVERIDADES,
  type FiltrosDosLogs,
} from "@/dominio/logs";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { eventosExistentes, paginaDeLogs, pessoasDoFiltro } from "@/lib/logs/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Logs" };


const dataPorExtenso = (instante: Date) => instante.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "long", year: "numeric" });

/** Os campos escondidos que levam adiante os filtros que o formulário não mostra. */
function Escondidos({ filtros, fora }: { filtros: FiltrosDosLogs; fora: (keyof FiltrosDosLogs)[] }) {
  return parametrosDosLogs(filtros)
    .filter(([chave]) => !fora.includes(chave as keyof FiltrosDosLogs))
    .map(([chave, valor]) => <input key={chave} type="hidden" name={chave} value={valor} />);
}

export default async function PaginaDeLogs(props: PageProps<"/admin/logs">) {
  await exigirAdmin();
  const parametros = await props.searchParams;
  const filtros = lerFiltrosDosLogs(parametros);
  const antesDe = typeof parametros.antes === "string" && /^\d+$/.test(parametros.antes) ? Number(parametros.antes) : null;
  const agora = new Date();

  const supabase = await supabaseDoServidor();
  const [{ logs, proxima }, pessoas, config] = await Promise.all([
    paginaDeLogs(supabase, filtros, agora, antesDe),
    pessoasDoFiltro(supabase),
    configuracoes(supabase),
  ]);
  const existentes = await eventosExistentes(
    supabase,
    logs.filter((l) => l.objetoTipo === "evento" && l.objetoId).map((l) => l.objetoId!),
  );

  const url = (mudancas: Partial<FiltrosDosLogs>, antes?: number) => {
    const busca = new URLSearchParams(parametrosDosLogs({ ...filtros, ...mudancas }));
    if (antes) busca.set("antes", String(antes));
    const texto = busca.toString();
    return texto ? `/admin/logs?${texto}` : "/admin/logs";
  };
  const ligados = contarFiltrosDosLogs(filtros);
  const alertas = filtros.aba === "alertas";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="text-sm text-texto-suave">
          Quem fez o quê no Mural, e quando. Os registros começam em {dataPorExtenso(config.logsDesde)}, quando os logs entraram no ar, e são guardados por{" "}
          {config.retencaoDosLogsMeses} {config.retencaoDosLogsMeses === 1 ? "mês" : "meses"} (
          <Link href="/admin/configuracoes" className="underline">
            mudar
          </Link>
          ).
        </p>
      </div>

      <nav aria-label="Abas dos logs" className="flex gap-1 rounded-xl border border-borda bg-superficie p-1">
        {(
          [
            ["atividade", "Atividade"],
            ["alertas", "Alertas e erros"],
          ] as const
        ).map(([aba, rotulo]) => (
          <Link
            key={aba}
            href={url({ aba })}
            aria-current={filtros.aba === aba ? "page" : undefined}
            className="toque flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium text-texto-suave aria-[current=page]:bg-marca aria-[current=page]:text-marca-texto"
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        <form role="search" className="flex items-end gap-2">
          <Escondidos filtros={filtros} fora={["busca"]} />
          <div className="min-w-0 flex-1">
            <Campo rotulo="Buscar por pessoa ou título" name="busca" type="search" defaultValue={filtros.busca} placeholder="Ex.: Carol, EBD" />
          </div>
          <button type="submit" className="botao-secundario" aria-label="Buscar">
            <Search aria-hidden className="size-5" />
          </button>
        </form>

        <details className="rounded-2xl border border-borda bg-superficie" open={ligados > 0 || filtros.periodo === "intervalo"}>
          <summary className="toque flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 font-medium [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal aria-hidden className="size-5" />
            Filtros
            <span className="text-sm font-normal text-texto-suave">
              · {NOMES_DOS_PERIODOS[filtros.periodo]}
              {ligados > 0 && ` · ${ligados} ${ligados === 1 ? "filtro ligado" : "filtros ligados"}`}
            </span>
          </summary>
          <form className="grid gap-3 border-t border-borda p-4 sm:grid-cols-2">
            <Escondidos filtros={filtros} fora={["periodo", "de", "ate", "usuario", "acao", "modulo", "resultado", "severidade"]} />
            <Selecao rotulo="Período" name="periodo" defaultValue={filtros.periodo} opcoes={PERIODOS.map((p) => ({ valor: p, texto: NOMES_DOS_PERIODOS[p] }))} />
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="De" name="de" type="date" defaultValue={filtros.de} />
              <Campo rotulo="Até" name="ate" type="date" defaultValue={filtros.ate} />
            </div>
            <Selecao
              rotulo="Quem fez"
              name="usuario"
              defaultValue={filtros.usuario}
              vazia="Todos"
              opcoes={[{ valor: "sistema", texto: "Sistema (automático)" }, ...pessoas]}
            />
            <Selecao
              rotulo="Módulo"
              name="modulo"
              defaultValue={filtros.modulo}
              vazia="Todos"
              opcoes={MODULOS.map((m) => ({ valor: m, texto: NOMES_DOS_MODULOS[m] }))}
            />
            <Selecao
              rotulo="Tipo de ação"
              name="acao"
              defaultValue={filtros.acao}
              vazia="Todos"
              opcoes={MODULOS.flatMap((modulo) =>
                acoesDoModulo(modulo).map((acao) => ({ valor: acao, texto: `${NOMES_DOS_MODULOS[modulo]} · ${definicaoDaAcao(acao).nome}` })),
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <Selecao
                rotulo="Resultado"
                name="resultado"
                defaultValue={filtros.resultado}
                vazia="Todos"
                opcoes={RESULTADOS.map((r) => ({ valor: r, texto: NOMES_DOS_RESULTADOS[r] }))}
              />
              <Selecao
                rotulo="Severidade"
                name="severidade"
                defaultValue={filtros.severidade}
                vazia="Todas"
                opcoes={SEVERIDADES.map((s) => ({ valor: s, texto: NOMES_DAS_SEVERIDADES[s] }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button type="submit" className="botao-primario">
                Aplicar
              </button>
              <Link href={url({ ...FILTROS_PADRAO, aba: filtros.aba })} className="botao-secundario">
                Limpar filtros
              </Link>
            </div>
          </form>
        </details>

        {/* POST porque grava o registro da exportação, como as outras exportações. */}
        <form method="post" action={`/admin/logs/exportar?${new URLSearchParams(parametrosDosLogs(filtros))}`} className="self-end">
          <button type="submit" className="botao-discreto">
            <Download aria-hidden className="size-4" />
            Exportar o resultado em CSV
          </button>
        </form>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-borda p-6 text-center">
          <p className="font-medium">{alertas ? "Nenhum alerta ou erro neste período." : "Nenhuma atividade neste período."}</p>
          <p className="text-sm text-texto-suave">
            {ligados > 0 || filtros.busca ? "Tente tirar algum filtro ou mudar a busca. " : ""}Os logs começam em {dataPorExtenso(config.logsDesde)}.
          </p>
        </div>
      ) : (
        <LinhaDoTempo logs={logs} agora={agora} existentes={existentes} />
      )}

      {(antesDe || proxima) && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          {antesDe ? (
            <Link href={url({})} className="botao-secundario">
              ‹ Mais recentes
            </Link>
          ) : (
            <span />
          )}
          {proxima && (
            <Link href={url({}, proxima)} className="botao-secundario">
              Mais antigos ›
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
