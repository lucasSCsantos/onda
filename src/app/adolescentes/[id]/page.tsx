import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { IconeDaMarcacao } from "@/components/icone-da-marcacao";
import { podeGerenciarContas } from "@/dominio/acesso";
import { FUSO } from "@/dominio/fuso";
import type { Genero } from "@/dominio/genero";
import { AVISO_DAS_OBSERVACOES, foiEditada, podeMudarObservacao } from "@/dominio/observacoes";
import { historicoDoAdolescente } from "@/dominio/presenca";
import { classificar, lerAno } from "@/dominio/ranking";
import { exigirLideranca } from "@/lib/contas/perfil";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { observacoesDoAdolescente } from "@/lib/observacoes/consultas";
import { marcacoes, presencasDoPeriodo } from "@/lib/presenca/consultas";
import { pontosDoAno } from "@/lib/ranking/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioAdolescente } from "../formularios";
import { ItemDaObservacao, NovaObservacao } from "./observacoes-cliente";

// Dados de menores: fora de buscadores (o layout já diz o mesmo; aqui fica explícito).
export const metadata: Metadata = { title: "Adolescente", robots: { index: false, follow: false } };

const dia = (instante: Date) => instante.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });

/** O histórico de presença de um Adolescente, aula por aula, desde o cadastro. */
export default async function PaginaDoAdolescente(props: PageProps<"/adolescentes/[id]">) {
  const eu = await exigirLideranca();
  const { id } = await props.params;
  const supabase = await supabaseDoServidor();
  const ano = lerAno(undefined, new Date());
  const [{ data: adolescente }, todas, periodo, pontos, config, observacoes] = await Promise.all([
    supabase
      .from("adolescentes")
      .select("id, nome, nascimento, genero, ativo, criado_em")
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<{ id: string; nome: string; nascimento: string; genero: Genero | null; ativo: boolean; criado_em: string }, { merge: false }>(),
    marcacoes(supabase),
    presencasDoPeriodo(supabase),
    pontosDoAno(supabase, ano),
    configuracoes(supabase),
    observacoesDoAdolescente(supabase, id),
  ]);
  if (!adolescente) notFound();

  const agora = new Date();
  const dele = new Map<string, string[]>();
  for (const [aula, presencas] of periodo.porAula) {
    const presenca = presencas.find((p) => p.adolescente === adolescente.id);
    if (presenca) dele.set(aula, presenca.marcacoes);
  }
  const historico = historicoDoAdolescente(
    periodo.aulas.filter((a) => a.inicio <= agora),
    dele,
    new Date(adolescente.criado_em),
    todas,
  );
  const presencas = historico.filter((h) => h.presente).length;
  const noRanking = classificar(pontos, config.desempatePor).find((r) => r.adolescente.id === adolescente.id);
  const totais = todas
    .map((m) => ({ marcacao: m, quantos: historico.filter((h) => h.marcacoes.some((x) => x.id === m.id)).length }))
    .filter(({ marcacao, quantos }) => !marcacao.contaPresenca && (marcacao.ativa || quantos > 0));

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <Link href="/adolescentes" className="text-sm text-texto-suave hover:text-texto">
          ‹ Adolescentes
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {adolescente.nome}
            {!adolescente.ativo && <span className="ml-2 text-base font-normal text-texto-suave">(inativo)</span>}
          </h1>
          <p className="text-sm text-texto-suave">
            Presente em {presencas} de {historico.length} {historico.length === 1 ? "aula" : "aulas"} com chamada desde o cadastro.
          </p>
          <p className="text-sm">
            <Link href={`/ranking?ano=${ano}`} className="underline">
              Ranking {ano}
            </Link>
            : {noRanking ? `${noRanking.pontos} ${noRanking.pontos === 1 ? "ponto" : "pontos"}, ${noRanking.posicao}º lugar` : "ainda sem pontos"}
          </p>
        </div>

        <section aria-labelledby="titulo-cadastro" className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
          <h2 id="titulo-cadastro" className="text-lg font-semibold">
            Cadastro
          </h2>
          <FormularioAdolescente adolescente={adolescente} />
        </section>

        {totais.length > 0 && (
          <section aria-label="Totais" className="flex flex-wrap gap-2">
            {totais.map(({ marcacao, quantos }) => (
              <span key={marcacao.id} className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 py-1 text-sm">
                <IconeDaMarcacao icone={marcacao.icone} className="size-4" />
                {marcacao.nome}: {quantos}
              </span>
            ))}
          </section>
        )}

        <section aria-labelledby="titulo-observacoes" className="flex flex-col gap-3">
          <h2 id="titulo-observacoes" className="text-lg font-semibold">
            Observações
          </h2>
          <p className="text-sm text-texto-suave">{AVISO_DAS_OBSERVACOES}</p>
          {observacoes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borda p-4 text-center text-texto-suave">Nenhuma observação ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {observacoes.map((o) => (
                <ItemDaObservacao
                  key={o.id}
                  id={o.id}
                  adolescenteId={adolescente.id}
                  texto={o.texto}
                  autor={o.autorNome ?? "Ex-integrante da liderança"}
                  criadaEm={dia(o.criadoEm)}
                  editadaEm={foiEditada(o) ? dia(o.editadoEm) : null}
                  pode={podeMudarObservacao(eu, o.autorId)}
                />
              ))}
            </ul>
          )}
          <NovaObservacao adolescenteId={adolescente.id} />
        </section>

        <section aria-labelledby="titulo-historico" className="flex flex-col gap-3">
          <h2 id="titulo-historico" className="text-lg font-semibold">
            Aula por aula
          </h2>
          {historico.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borda p-4 text-center text-texto-suave">Nenhuma aula com chamada desde o cadastro.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {historico.map(({ aula, marcacoes: marcadas, presente }) => (
                <li key={aula.id}>
                  <Link href={`/eventos/${aula.id}/chamada`} className="toque flex items-center justify-between gap-3 p-4 hover:bg-fundo">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{aula.titulo}</span>
                      <span className="text-sm text-texto-suave">{dia(aula.inicio)}</span>
                    </span>
                    {presente ? (
                      <span className="flex shrink-0 gap-1.5 text-sucesso" aria-label={marcadas.map((m) => m.nome).join(", ")}>
                        {marcadas.map((m) => (
                          <IconeDaMarcacao key={m.id} icone={m.icone} />
                        ))}
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-medium text-aviso">Faltou</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
