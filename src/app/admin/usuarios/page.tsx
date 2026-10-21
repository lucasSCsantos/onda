import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { NOMES_DOS_NIVEIS, type NivelDeAcesso } from "@/dominio/acesso";
import { mudarAtivo, promoverAAdmin, recusarPendente } from "@/lib/contas/acoes";
import { opcoesDeFuncao } from "@/lib/contas/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { AprovarPendente } from "./aprovar-pendente";

export const metadata: Metadata = { title: "Usuários" };

type Usuario = {
  id: string;
  nome: string;
  email: string;
  data_nascimento: string | null;
  nivel: NivelDeAcesso;
  ativo: boolean;
  criado_em: string;
  funcoes_das_pessoas: { funcoes: { nome: string } | null }[];
};

const dataCurta = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

const botaoDiscreto = "rounded-lg border border-borda px-3 py-1.5 text-sm hover:bg-fundo";

export default async function PaginaUsuarios() {
  const eu = await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const [{ data }, funcoes] = await Promise.all([
    supabase
      .from("perfis")
      .select("id, nome, email, data_nascimento, nivel, ativo, criado_em, funcoes_das_pessoas(funcoes(nome))")
      .order("nome")
      .overrideTypes<Usuario[], { merge: false }>(),
    opcoesDeFuncao(supabase),
  ]);
  const usuarios = data ?? [];
  const pendentes = usuarios.filter((u) => u.ativo && u.nivel === "pendente");
  const ativos = usuarios.filter((u) => u.ativo && u.nivel !== "pendente");
  const desativados = usuarios.filter((u) => !u.ativo);

  return (
    <>
      <Cabecalho admin />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Pendentes</h1>
          {pendentes.length === 0 && <p className="text-texto-suave">Ninguém aguardando aprovação.</p>}
          {pendentes.map((u) => (
            <article key={u.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
              <div>
                <p className="font-semibold">{u.nome || "(sem nome)"}</p>
                <p className="text-sm break-words text-texto-suave">
                  {u.email}
                  {u.data_nascimento && ` · nasceu em ${dataCurta(u.data_nascimento)}`} · cadastrou-se em{" "}
                  {dataCurta(u.criado_em)}
                </p>
              </div>
              <AprovarPendente pessoa={u.id} funcoes={funcoes} />
              <form action={recusarPendente.bind(null, u.id)}>
                <button type="submit" className={`${botaoDiscreto} text-erro`}>
                  Recusar e apagar o cadastro
                </button>
              </form>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Usuários ativos</h2>
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {ativos.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {u.nome || "(sem nome)"} <span className="text-sm font-normal text-texto-suave">· {NOMES_DOS_NIVEIS[u.nivel]}</span>
                  </p>
                  <p className="text-sm text-texto-suave">
                    {u.funcoes_das_pessoas.map((f) => f.funcoes?.nome).filter(Boolean).join(", ") || "Sem Função"}
                  </p>
                </div>
                {u.id !== eu.id && (
                  <div className="flex gap-2">
                    {u.nivel !== "admin" && (
                      <form action={promoverAAdmin.bind(null, u.id)}>
                        <button type="submit" className={botaoDiscreto}>
                          Promover a Admin
                        </button>
                      </form>
                    )}
                    <form action={mudarAtivo.bind(null, u.id, false)}>
                      <button type="submit" className={`${botaoDiscreto} text-erro`}>
                        Desativar
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {desativados.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Desativados</h2>
            <p className="text-sm text-texto-suave">Não entram no Mural, mas continuam no histórico dos Eventos.</p>
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {desativados.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 p-4">
                  <p>
                    {u.nome || "(sem nome)"} <span className="text-sm text-texto-suave">· {NOMES_DOS_NIVEIS[u.nivel]}</span>
                  </p>
                  <form action={mudarAtivo.bind(null, u.id, true)}>
                    <button type="submit" className={botaoDiscreto}>
                      Reativar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
