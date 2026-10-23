import type { Metadata } from "next";
import Link from "next/link";
import { SECOES_DE_ADMIN } from "@/components/destinos-admin";
import { TABELAS_EXPORTADAS } from "@/dominio/exportacao";
import { indicadoresDoPainel } from "@/dominio/painel-admin";
import { somarDias } from "@/dominio/fuso";
import { CAMINHO_DOS_PROFESSORES_NO_ADMIN } from "@/dominio/professores";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { categorias, eventos } from "@/lib/eventos/consultas";
import { professoresCadastrados } from "@/lib/professores/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import type { NivelDeAcesso } from "@/dominio/acesso";

export const metadata: Metadata = { title: "Administração" };

type Pessoa = { nivel: NivelDeAcesso; ativo: boolean };
type Convite = { expira_em: string; usado_em: string | null; revogado_em: string | null };

export default async function PainelDeAdmin() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const agora = new Date();
  const [{ data: pessoas }, { data: convites }, todos, doCatalogo, professores, { count: alertasDaSemana }, config] = await Promise.all([
    supabase.from("perfis").select("nivel, ativo").overrideTypes<Pessoa[], { merge: false }>(),
    supabase.from("convites").select("expira_em, usado_em, revogado_em").overrideTypes<Convite[], { merge: false }>(),
    eventos(supabase),
    categorias(supabase),
    professoresCadastrados(supabase),
    supabase
      .from("logs")
      .select("id", { count: "exact", head: true })
      .gte("feito_em", somarDias(agora, -7).toISOString())
      .or("resultado.eq.falha,severidade.neq.info"),
    configuracoes(supabase),
  ]);
  const { count: marcacoesAtivas } = await supabase.from("marcacoes").select("id", { count: "exact", head: true }).eq("ativa", true);
  const perfis = pessoas ?? [];
  const indicadores = indicadoresDoPainel({
    pessoas: perfis,
    convites: (convites ?? []).map((c) => ({
      expiraEm: new Date(c.expira_em),
      usadoEm: c.usado_em ? new Date(c.usado_em) : null,
      revogadoEm: c.revogado_em ? new Date(c.revogado_em) : null,
    })),
    eventos: todos,
    agora,
  });

  const faixa = [
    { rotulo: "Aguardando aprovação", valor: indicadores.pendentes, href: "/admin/usuarios" },
    { rotulo: "Convites ativos", valor: indicadores.convitesAtivos, href: "/admin/convites" },
    { rotulo: "Eventos em Rascunho", valor: indicadores.rascunhos, href: "/calendario?status=rascunho" },
    { rotulo: "Eventos sem Responsável", valor: indicadores.semResponsavel, href: "/calendario" },
  ];
  // O contador de cada cartão é o que a seção tem de mais útil de saber antes de entrar.
  const contadores: Record<string, string> = {
    "/admin/usuarios": `${indicadores.usuariosAtivos} ativos`,
    "/admin/convites": `${indicadores.convitesAtivos} ativos`,
    "/admin/catalogo": `${doCatalogo.length} Categorias`,
    [CAMINHO_DOS_PROFESSORES_NO_ADMIN]: `${professores.filter((p) => p.ativo).length} cadastrados`,
    "/admin/exportar": `${TABELAS_EXPORTADAS.length} tabelas`,
    "/admin/logs": alertasDaSemana ? `${alertasDaSemana} ${alertasDaSemana === 1 ? "alerta" : "alertas"} em 7 dias` : "Sem alertas em 7 dias",
    "/admin/marcacoes": `${marcacoesAtivas} ativas`,
    "/admin/configuracoes": `Logs por ${config.retencaoDosLogsMeses} ${config.retencaoDosLogsMeses === 1 ? "mês" : "meses"}`,
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">Administração</h1>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {faixa.map(({ rotulo, valor, href }) => (
          <Link
            key={rotulo}
            href={href}
            className="toque flex flex-col gap-1 rounded-2xl border border-borda bg-superficie p-4 shadow-sm hover:bg-fundo active:bg-borda"
          >
            <span className={`text-3xl font-semibold tabular-nums ${valor > 0 ? "text-aviso" : ""}`}>{valor}</span>
            <span className="text-sm text-texto-suave">{rotulo}</span>
          </Link>
        ))}
      </section>

      <section aria-label="Seções" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES_DE_ADMIN.map(({ href, rotulo, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            className="toque flex items-center gap-4 rounded-2xl border border-borda bg-superficie p-4 shadow-sm hover:bg-fundo active:bg-borda"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fundo text-marca">
              <Icone aria-hidden className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{rotulo}</span>
              <span className="text-sm text-texto-suave">{contadores[href]}</span>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
