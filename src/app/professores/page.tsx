import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { podeGerenciarContas } from "@/dominio/acesso";
import { situacaoDoConvite, type SituacaoDoConvite } from "@/dominio/convites";
import { podeCadastrarProfessor, podeInativarProfessor } from "@/dominio/professores";
import { perfilAtual } from "@/lib/contas/perfil";
import { areasDaPessoa } from "@/lib/eventos/consultas";
import { origemDoApp } from "@/lib/origem";
import { convitesDeProfessor, professoresCadastrados, type ProfessorCadastrado } from "@/lib/professores/consultas";
import { mudarAtivoDoProfessor, revogarConviteDeProfessor } from "@/lib/professores/acoes";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { CopiarLink } from "../admin/convites/copiar-link";
import { FormularioConviteDeProfessor } from "./formulario-convite-de-professor";

export const metadata: Metadata = { title: "Professores" };

const ROTULOS: Record<SituacaoDoConvite, string> = { valido: "Válido", usado: "Usado", vencido: "Vencido", revogado: "Revogado" };

const dataEHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

const botaoDiscreto = "botao-discreto";

export default async function PaginaProfessores() {
  const eu = await perfilAtual();
  const supabase = await supabaseDoServidor();
  const areas = eu ? await areasDaPessoa(supabase, eu.id) : [];
  if (!eu || !podeCadastrarProfessor(eu, areas)) redirect("/");

  const [convites, professores, origem] = await Promise.all([convitesDeProfessor(supabase), professoresCadastrados(supabase), origemDoApp()]);
  const agora = new Date();
  const ativos = professores.filter((p) => p.ativo);
  const inativos = professores.filter((p) => !p.ativo);
  const inativaProfessor = (p: ProfessorCadastrado) => podeInativarProfessor(eu, { id: p.id, nivel: "professor", ativo: p.ativo });

  return (
    <>
      <Cabecalho admin={podeGerenciarContas(eu)} lideranca calendario professores />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-6">
          <h1 className="text-2xl font-semibold">Novo Professor</h1>
          <p className="text-sm text-texto-suave">
            O link vale para um único cadastro. Quem entrar por ele vira Professor e vê só as aulas em que for colocado como Professor
            ou Auxiliar, podendo editar as observações delas.
          </p>
          <FormularioConviteDeProfessor />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Professores</h2>
          {ativos.length === 0 && <p className="text-texto-suave">Nenhum Professor cadastrado ainda.</p>}
          {ativos.length > 0 && (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {ativos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <p className="font-semibold">{p.nome || "(sem nome)"}</p>
                  {inativaProfessor(p) && (
                    <form action={mudarAtivoDoProfessor.bind(null, p.id, false)}>
                      <button type="submit" className={`${botaoDiscreto} text-erro`}>
                        Inativar
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {inativos.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-texto-suave">Inativos</h3>
              <p className="text-sm text-texto-suave">Não entram no Mural, mas continuam no histórico das aulas.</p>
              <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
                {inativos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                    <p>{p.nome || "(sem nome)"}</p>
                    {inativaProfessor(p) && (
                      <form action={mudarAtivoDoProfessor.bind(null, p.id, true)}>
                        <button type="submit" className={botaoDiscreto}>
                          Reativar
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!podeGerenciarContas(eu) && <p className="text-sm text-texto-suave">Só o Admin inativa um Professor.</p>}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Convites de Professor</h2>
          {convites.length === 0 && <p className="text-texto-suave">Nenhum convite gerado ainda.</p>}
          <ul className="flex flex-col gap-3">
            {convites.map((c) => {
              const situacao = situacaoDoConvite(
                {
                  expiraEm: new Date(c.expira_em),
                  usadoEm: c.usado_em ? new Date(c.usado_em) : null,
                  revogadoEm: c.revogado_em ? new Date(c.revogado_em) : null,
                },
                agora,
              );
              return (
                <li key={c.id} className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
                  <p className="font-semibold">
                    Professor
                    <span className="ml-2 rounded-full border border-borda px-2 py-0.5 text-xs font-normal text-texto-suave">
                      {ROTULOS[situacao]}
                    </span>
                  </p>
                  <p className="text-sm text-texto-suave">
                    {situacao === "usado"
                      ? `Usado por ${c.usado_por_perfil?.nome || "conta removida"} em ${dataEHora(c.usado_em!)}`
                      : `Vence em ${dataEHora(c.expira_em)}`}
                  </p>
                  {situacao === "valido" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <CopiarLink link={`${origem}/cadastro?convite=${c.codigo}`} />
                      <form action={revogarConviteDeProfessor.bind(null, c.id)}>
                        <button type="submit" className={`${botaoDiscreto} text-erro`}>
                          Revogar
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
