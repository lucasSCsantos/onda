import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { Campo, Selecao } from "@/components/formulario";
import { podeGerenciarContas } from "@/dominio/acesso";
import { listarAdolescentes, prazoDoAniversario, proximoAniversario, type Adolescente } from "@/dominio/adolescentes";
import { FUSO } from "@/dominio/fuso";
import { definirAtivo } from "@/lib/adolescentes/acoes";
import { exigirLideranca } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioAdolescente } from "./formularios";

// Dados de menores: fora de buscadores (o layout já diz o mesmo; aqui fica explícito).
export const metadata: Metadata = { title: "Adolescentes", robots: { index: false, follow: false } };

const diaEMes = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "long" });

const parametroTexto = (valor: string | string[] | undefined) => (typeof valor === "string" ? valor : "");

export default async function PaginaAdolescentes(props: PageProps<"/adolescentes">) {
  const eu = await exigirLideranca();
  const parametros = await props.searchParams;
  const busca = parametroTexto(parametros.q);
  const ordem = parametroTexto(parametros.ordem) === "nome" ? "nome" : "aniversario";
  const comInativos = parametroTexto(parametros.inativos) === "1";
  const agora = new Date();

  const supabase = await supabaseDoServidor();
  const { data } = await supabase
    .from("adolescentes")
    .select("id, nome, nascimento, ativo")
    .order("nome")
    .overrideTypes<Adolescente[], { merge: false }>();
  const { adolescentes: lista, inativos: quantosInativos } = listarAdolescentes(data ?? [], { busca, ordem, comInativos }, agora);

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Adolescentes</h1>

        <form className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-48 flex-1">
            <Campo rotulo="Buscar por nome" name="q" type="search" defaultValue={busca} />
          </div>
          <Selecao
            rotulo="Ordem"
            name="ordem"
            defaultValue={ordem}
            opcoes={[
              { valor: "aniversario", texto: "Próximo aniversário" },
              { valor: "nome", texto: "Nome" },
            ]}
          />
          <label className="flex items-center gap-2 pb-3 text-sm">
            <input type="checkbox" name="inativos" value="1" defaultChecked={comInativos} className="size-4 accent-marca" />
            Mostrar inativos{quantosInativos ? ` (${quantosInativos})` : ""}
          </label>
          <button type="submit" className="botao-primario">
            Aplicar
          </button>
        </form>

        {lista.length === 0 ? (
          <p className="text-texto-suave">{busca ? "Nenhum Adolescente com esse nome." : "Nenhum Adolescente cadastrado."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {lista.map((a) => {
              const proximo = proximoAniversario(a.nascimento, agora);
              return (
                <li key={a.id} className={`flex flex-col gap-3 p-4 ${a.ativo ? "" : "opacity-70"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {a.nome}
                        {!a.ativo && <span className="ml-2 text-sm font-normal text-texto-suave">(inativo)</span>}
                      </p>
                      <p className="text-sm text-texto-suave">
                        Faz {proximo.idade} anos em {diaEMes(proximo.data)} · {prazoDoAniversario(proximo.dias)}
                      </p>
                    </div>
                    <form action={definirAtivo.bind(null, a.id, !a.ativo)}>
                      <button type="submit" className="text-sm text-texto-suave underline hover:text-texto">
                        {a.ativo ? "Inativar" : "Reativar"}
                      </button>
                    </form>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-texto-suave">Editar</summary>
                    <div className="pt-3">
                      <FormularioAdolescente adolescente={a} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
          <h2 className="font-semibold">Novo Adolescente</h2>
          <FormularioAdolescente />
        </div>
      </main>
    </>
  );
}
