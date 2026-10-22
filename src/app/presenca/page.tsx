import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { IconeDaMarcacao } from "@/components/icone-da-marcacao";
import { podeGerenciarContas } from "@/dominio/acesso";
import { FUSO, somarDias } from "@/dominio/fuso";
import { alertasDeAusencia, estevePresente, resumoDaAula } from "@/dominio/presenca";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirLideranca } from "@/lib/contas/perfil";
import { adolescentes, marcacoes, presencasDoPeriodo } from "@/lib/presenca/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

// Dados de menores: fora de buscadores (o layout já diz o mesmo; aqui fica explícito).
export const metadata: Metadata = { title: "Presença", robots: { index: false, follow: false } };

const dia = (instante: Date) => instante.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "short", day: "numeric", month: "short" });

type AulaRecente = { id: string; titulo: string; inicio: string; categorias: { nome: string } };

export default async function PaginaDePresenca() {
  const eu = await exigirLideranca();
  const supabase = await supabaseDoServidor();
  const agora = new Date();
  const [config, todas, cadastro, periodo, { data: recentes }] = await Promise.all([
    configuracoes(supabase),
    marcacoes(supabase),
    adolescentes(supabase),
    // Um ano basta para contar faltas seguidas.
    presencasDoPeriodo(supabase, { desde: somarDias(agora, -365) }),
    // As aulas das Categorias com chamada até o fim de hoje, com ou sem chamada feita.
    supabase
      .from("eventos")
      .select("id, titulo, inicio, categorias!inner(nome)")
      .eq("categorias.tem_chamada", true)
      .neq("status", "cancelado")
      .gte("inicio", somarDias(agora, -60).toISOString())
      .lt("inicio", somarDias(agora, 1).toISOString())
      .order("inicio", { ascending: false })
      .limit(12)
      .overrideTypes<AulaRecente[], { merge: false }>(),
  ]);

  const presentesPorAdolescente = new Map<string, Set<string>>();
  for (const [aula, presencas] of periodo.porAula) {
    for (const p of presencas) {
      if (!estevePresente(p.marcacoes, todas)) continue;
      if (!presentesPorAdolescente.has(p.adolescente)) presentesPorAdolescente.set(p.adolescente, new Set());
      presentesPorAdolescente.get(p.adolescente)!.add(aula);
    }
  }
  // Só as aulas que já aconteceram contam para as faltas.
  const passadas = periodo.aulas.filter((a) => a.inicio <= agora);
  const alertas = alertasDeAusencia(cadastro, passadas, presentesPorAdolescente, config.faltasParaAlerta);
  const ativos = cadastro.filter((a) => a.ativo).length;

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Presença</h1>
        </div>

        <section aria-labelledby="titulo-alertas" className="flex flex-col gap-3">
          <h2 id="titulo-alertas" className="text-lg font-semibold">
            Alerta de ausência
          </h2>
          <p className="text-sm text-texto-suave">
            Quem faltou a {config.faltasParaAlerta} {config.faltasParaAlerta === 1 ? "aula" : "aulas"} seguidas ou mais, contando só as aulas com chamada.
          </p>
          {alertas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borda p-4 text-center text-texto-suave">Ninguém faltando há tanto tempo.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {alertas.map(({ adolescente, faltas, ultimaPresenca }) => (
                <li key={adolescente.id}>
                  <Link href={`/adolescentes/${adolescente.id}`} className="toque flex items-center gap-3 p-4 hover:bg-fundo">
                    <TriangleAlert aria-hidden className="size-5 shrink-0 text-aviso" />
                    <span className="flex flex-1 flex-col">
                      <span className="font-semibold">{adolescente.nome}</span>
                      <span className="text-sm text-texto-suave">
                        {faltas} {faltas === 1 ? "falta seguida" : "faltas seguidas"} ·{" "}
                        {ultimaPresenca ? `veio pela última vez em ${dia(ultimaPresenca)}` : "nenhuma presença no último ano"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-aulas" className="flex flex-col gap-3">
          <h2 id="titulo-aulas" className="text-lg font-semibold">
            Aulas recentes
          </h2>
          {(recentes ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borda p-4 text-center text-texto-suave">Nenhuma aula nos últimos 60 dias.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(recentes ?? []).map((aula) => {
                const presencas = periodo.porAula.get(aula.id);
                const resumo = presencas ? resumoDaAula(presencas, todas, ativos) : null;
                return (
                  <li key={aula.id}>
                    <Link
                      href={`/eventos/${aula.id}/chamada`}
                      className="toque flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4 shadow-sm hover:bg-fundo"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{aula.titulo}</span>
                        <span className="shrink-0 text-sm text-texto-suave">{dia(new Date(aula.inicio))}</span>
                      </span>
                      {resumo ? (
                        <span className="flex flex-wrap gap-2 text-sm text-texto-suave">
                          <span className="font-medium text-texto">
                            {resumo.presentes} de {resumo.ativos} presentes
                          </span>
                          {resumo.porMarcacao
                            .filter(({ marcacao }) => !marcacao.contaPresenca)
                            .map(({ marcacao, quantos }) => (
                              <span key={marcacao.id} className="inline-flex items-center gap-1">
                                <IconeDaMarcacao icone={marcacao.icone} className="size-4" /> {quantos}
                              </span>
                            ))}
                        </span>
                      ) : (
                        <span className="text-sm text-aviso">Chamada ainda não feita</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
