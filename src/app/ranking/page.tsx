import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { IconeDaMarcacao } from "@/components/icone-da-marcacao";
import { podeGerenciarContas } from "@/dominio/acesso";
import { anosDoSeletor, classificar, lerAno } from "@/dominio/ranking";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirLideranca } from "@/lib/contas/perfil";
import { marcacoes } from "@/lib/presenca/consultas";
import { anosComPresenca, pontosDoAno } from "@/lib/ranking/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

// Dados de menores: fora de buscadores, e só para a Liderança (o ranking não é mostrado aos Adolescentes).
export const metadata: Metadata = { title: "Ranking", robots: { index: false, follow: false } };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function PaginaDoRanking(props: PageProps<"/ranking">) {
  const eu = await exigirLideranca();
  const parametros = await props.searchParams;
  const agora = new Date();
  const ano = lerAno(typeof parametros.ano === "string" ? parametros.ano : undefined, agora);

  const supabase = await supabaseDoServidor();
  const [linhas, anos, todas, config] = await Promise.all([pontosDoAno(supabase, ano), anosComPresenca(supabase), marcacoes(supabase), configuracoes(supabase)]);
  const ranking = classificar(linhas, config.desempatePor);
  const porId = new Map(todas.map((m) => [m.id, m]));
  const desempate = config.desempatePor ? porId.get(config.desempatePor) : undefined;

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Ranking {ano}</h1>
          <p className="text-sm text-texto-suave">
            A soma dos pontos das Marcações de cada Adolescente nas aulas do ano.{" "}
            {desempate ? `No empate, fica na frente quem tem mais “${desempate.nome}”.` : "No empate, a posição é dividida."} Os pontos são os de agora
            {podeGerenciarContas(eu) ? (
              <>
                {" "}
                (
                <Link href="/admin/marcacoes" className="underline">
                  mudar
                </Link>
                )
              </>
            ) : null}
            : mudar a pontuação refaz também os anos anteriores. Visível só para a Liderança.
          </p>
        </div>

        <nav aria-label="Ano" className="flex flex-wrap gap-2">
          {anosDoSeletor(anos, agora).map((a) => (
            <Link
              key={a}
              href={`/ranking?ano=${a}`}
              aria-current={a === ano ? "page" : undefined}
              className="toque inline-flex min-h-11 items-center rounded-xl border border-borda bg-superficie px-4 font-medium aria-[current=page]:border-marca aria-[current=page]:bg-marca aria-[current=page]:text-marca-texto"
            >
              {a}
            </Link>
          ))}
        </nav>

        {ranking.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borda p-6 text-center text-texto-suave">Nenhuma presença registrada em {ano}.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((r) => (
              <li key={r.adolescente.id}>
                <details className="rounded-2xl border border-borda bg-superficie shadow-sm">
                  <summary className="toque flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3 hover:bg-fundo [&::-webkit-details-marker]:hidden">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums ${r.posicao <= 3 ? "bg-marca text-marca-texto" : "bg-fundo"}`}
                    >
                      {r.posicao <= 3 ? <Trophy aria-hidden className="size-4" /> : null}
                      <span className={r.posicao <= 3 ? "sr-only" : ""}>{r.posicao}º</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">
                        {r.posicao <= 3 && <span className="mr-1">{r.posicao}º</span>}
                        {r.adolescente.nome}
                        {!r.adolescente.ativo && <span className="ml-1 text-sm font-normal text-texto-suave">(inativo)</span>}
                      </span>
                      {desempate && <span className="text-xs text-texto-suave">{plural(r.desempate, `vez “${desempate.nome}”`, `vezes “${desempate.nome}”`)}</span>}
                    </span>
                    <span className="shrink-0 text-lg font-semibold tabular-nums">{plural(r.pontos, "ponto", "pontos")}</span>
                  </summary>
                  <div className="flex flex-col gap-2 border-t border-borda p-3 text-sm">
                    <ul className="flex flex-col gap-1">
                      {[...r.porMarcacao]
                        .sort((a, b) => (porId.get(a.marcacao)?.ordem ?? 0) - (porId.get(b.marcacao)?.ordem ?? 0))
                        .map((p) => {
                        const marcacao = porId.get(p.marcacao);
                        return (
                          <li key={p.marcacao} className="flex items-center gap-2">
                            {marcacao && <IconeDaMarcacao icone={marcacao.icone} className="size-4 text-texto-suave" />}
                            <span className="flex-1">
                              {marcacao?.nome ?? "Marcação"}: {plural(p.quantas, "vez", "vezes")}
                            </span>
                            <span className="tabular-nums">{plural(p.pontos, "ponto", "pontos")}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <Link href={`/adolescentes/${r.adolescente.id}`} className="self-start font-medium text-marca underline">
                      Ver aula por aula
                    </Link>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}
