import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { NOMES_DOS_NIVEIS, type NivelDeAcesso } from "@/dominio/acesso";
import { situacaoDoConvite, type SituacaoDoConvite } from "@/dominio/convites";
import { revogarConvite } from "@/lib/contas/acoes";
import { OPCOES_DE_NIVEL, opcoesDeFuncao } from "@/lib/contas/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { origemDoApp } from "@/lib/origem";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { CopiarLink } from "./copiar-link";
import { FormularioConvite } from "./formulario-convite";

export const metadata: Metadata = { title: "Convites" };

type ConviteListado = {
  id: string;
  codigo: string;
  nivel: NivelDeAcesso;
  criado_em: string;
  expira_em: string;
  usado_em: string | null;
  revogado_em: string | null;
  funcoes: { nome: string } | null;
  usado_por_perfil: { nome: string } | null;
};

const ROTULOS: Record<SituacaoDoConvite, string> = {
  valido: "Válido",
  usado: "Usado",
  vencido: "Vencido",
  revogado: "Revogado",
};

const dataEHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" });

export default async function PaginaConvites() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const [{ data }, funcoes, origem] = await Promise.all([
    supabase
      .from("convites")
      .select(
        "id, codigo, nivel, criado_em, expira_em, usado_em, revogado_em, funcoes(nome), usado_por_perfil:perfis!convites_usado_por_fkey(nome)",
      )
      .order("criado_em", { ascending: false })
      .limit(50)
      .overrideTypes<ConviteListado[], { merge: false }>(),
    opcoesDeFuncao(supabase),
    origemDoApp(),
  ]);
  const agora = new Date();

  return (
    <>
      <Cabecalho admin />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-6">
          <h1 className="text-2xl font-semibold">Novo convite</h1>
          <p className="text-sm text-texto-suave">
            O link vale para um único cadastro. Quem entrar por ele já fica aprovado com o nível e a Função escolhidos.
          </p>
          <FormularioConvite niveis={OPCOES_DE_NIVEL} funcoes={funcoes} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Convites recentes</h2>
          {(data ?? []).length === 0 && <p className="text-texto-suave">Nenhum convite gerado ainda.</p>}
          <ul className="flex flex-col gap-3">
            {(data ?? []).map((c) => {
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
                    {NOMES_DOS_NIVEIS[c.nivel]}
                    {c.funcoes && <span className="font-normal"> · {c.funcoes.nome}</span>}
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
                      <form action={revogarConvite.bind(null, c.id)}>
                        <button type="submit" className="rounded-lg border border-borda px-3 py-1.5 text-sm text-erro hover:bg-fundo">
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
