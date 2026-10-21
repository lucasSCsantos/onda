import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { buscarPorNome, ordenarPorProximoAniversario, proximoAniversario } from "@/dominio/adolescentes";
import { FUSO } from "@/dominio/fuso";
import { definirAtivo } from "@/lib/adolescentes/acoes";
import { exigirLideranca } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioAdolescente } from "./formularios";

// Dados de menores: fora de buscadores (o layout já diz o mesmo; aqui fica explícito).
export const metadata: Metadata = { title: "Adolescentes", robots: { index: false, follow: false } };

type Adolescente = { id: string; nome: string; nascimento: string; ativo: boolean };

const diaEMes = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: FUSO, day: "numeric", month: "long" });

function quando(dias: number) {
  if (dias === 0) return "hoje";
  return dias === 1 ? "amanhã" : `em ${dias} dias`;
}

const texto = (valor: string | string[] | undefined) => (typeof valor === "string" ? valor : "");

export default async function PaginaAdolescentes(props: PageProps<"/adolescentes">) {
  const eu = await exigirLideranca();
  const parametros = await props.searchParams;
  const busca = texto(parametros.q);
  const porNome = texto(parametros.ordem) === "nome";
  const comInativos = texto(parametros.inativos) === "1";
  const agora = new Date();

  const supabase = await supabaseDoServidor();
  const { data } = await supabase
    .from("adolescentes")
    .select("id, nome, nascimento, ativo")
    .order("nome")
    .overrideTypes<Adolescente[], { merge: false }>();
  const todos = data ?? [];
  const visiveis = buscarPorNome(
    todos.filter((a) => a.ativo || comInativos),
    busca,
  );
  const lista = porNome ? visiveis : ordenarPorProximoAniversario(visiveis, agora);
  const quantosInativos = todos.filter((a) => !a.ativo).length;

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Adolescentes</h1>

        <form className="flex flex-wrap items-end gap-3" role="search">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium">
            Buscar por nome
            <input
              name="q"
              type="search"
              defaultValue={busca}
              className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ordem
            <select
              name="ordem"
              defaultValue={porNome ? "nome" : "aniversario"}
              className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base font-normal"
            >
              <option value="aniversario">Próximo aniversário</option>
              <option value="nome">Nome</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-3 text-sm">
            <input type="checkbox" name="inativos" value="1" defaultChecked={comInativos} className="size-4 accent-marca" />
            Mostrar inativos{quantosInativos ? ` (${quantosInativos})` : ""}
          </label>
          <button type="submit" className="rounded-lg bg-marca px-4 py-3 font-semibold text-marca-texto">
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
                        Faz {proximo.idade} anos em {diaEMes(proximo.data)} · {quando(proximo.dias)}
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
