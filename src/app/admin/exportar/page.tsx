import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { NOMES_DAS_TABELAS, TABELAS_EXPORTADAS, type TabelaExportada } from "@/dominio/exportacao";
import { exigirAdmin } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Exportar", robots: { index: false, follow: false } };

type Registro = { id: string; tabela: TabelaExportada; feito_em: string; perfis: { nome: string } | null };

const dataEHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

export default async function PaginaExportar() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const { data } = await supabase
    .from("exportacoes")
    .select("id, tabela, feito_em, perfis(nome)")
    .order("feito_em", { ascending: false })
    .limit(50)
    .overrideTypes<Registro[], { merge: false }>();
  const registros = data ?? [];

  return (
    <>
      <Cabecalho admin />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Exportar</h1>
          <p className="text-texto-suave">
            Um arquivo CSV por tabela, que abre direto no Excel. Contém dados pessoais, inclusive de menores: guarde com
            cuidado. Cada exportação fica registrada abaixo.
          </p>
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {TABELAS_EXPORTADAS.map((tabela) => (
              <li key={tabela} className="flex items-center justify-between gap-3 p-4">
                <span className="font-semibold">{NOMES_DAS_TABELAS[tabela]}</span>
                <form method="post" action={`/admin/exportar/${tabela}`}>
                  <button type="submit" className="rounded-lg bg-marca px-4 py-2 font-semibold text-marca-texto">
                    Baixar CSV
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Histórico</h2>
          {registros.length === 0 ? (
            <p className="text-texto-suave">Nada foi exportado ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {registros.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-x-3 p-4 text-sm">
                  <span>
                    <span className="font-semibold">{NOMES_DAS_TABELAS[r.tabela]}</span> · {r.perfis?.nome || "(conta removida)"}
                  </span>
                  <span className="text-texto-suave">{dataEHora(r.feito_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
