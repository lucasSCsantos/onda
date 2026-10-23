"use server";

import { revalidatePath } from "next/cache";
import { lerOpcoes, type OpcoesDaAssinatura } from "@/dominio/assinatura-de-calendario";
import { campoTexto } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { categorias } from "@/lib/eventos/consultas";
import { registrarFalha } from "@/lib/logs/registrar";
import { origemDoApp } from "@/lib/origem";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { hashDoToken, novoToken } from "./token";

/** O que a tela mostra depois de uma ação. O `endereco` só existe aqui: nasce com o token e não se recupera depois. */
export type EstadoDaAssinatura = { erro?: string; aviso?: string; endereco?: string };

const ACOES = ["gerar", "salvar", "regerar", "revogar"] as const;

/**
 * Gerar, salvar os filtros, regerar e revogar a Assinatura de calendário de quem está logado. As políticas de
 * `assinaturas_de_calendario` deixam cada pessoa mexer só na própria; o banco registra o Log (sem token nem endereço).
 * O token só passa por aqui: o banco recebe o hash e a tela recebe o endereço uma vez.
 */
export async function agirNaAssinatura(_: EstadoDaAssinatura, dados: FormData): Promise<EstadoDaAssinatura> {
  const acao = ACOES.find((a) => a === campoTexto(dados, "acao"));
  const eu = await perfilAtual();
  if (!acao || !eu || !eu.ativo || eu.nivel === "pendente") return { erro: "Não foi possível fazer isso agora." };
  const supabase = await supabaseDoServidor();

  if (acao === "revogar") {
    const { error } = await supabase.from("assinaturas_de_calendario").delete().eq("pessoa_id", eu.id);
    if (error) return falhou(supabase, "calendario.revogado", error, "Não foi possível revogar o endereço.");
    revalidatePath("/conta");
    return { aviso: "Endereço revogado. Quem o usava deixa de receber os Eventos." };
  }

  const opcoes = await lerAsOpcoes(supabase, eu, dados);

  if (acao === "salvar") {
    const { data, error } = await supabase.from("assinaturas_de_calendario").update(opcoes).eq("pessoa_id", eu.id).select("pessoa_id");
    if (error || data.length === 0) return falhou(supabase, "calendario.opcoes_alteradas", error, "Não foi possível salvar as opções.");
    revalidatePath("/conta");
    return { aviso: "Opções salvas. O calendário do celular atualiza sozinho." };
  }

  const token = novoToken();
  const gravado = { ...opcoes, token_hash: hashDoToken(token) };
  const { data: existente } = await supabase.from("assinaturas_de_calendario").select("pessoa_id").eq("pessoa_id", eu.id).maybeSingle();
  // Regerar troca o hash de quem já tem; gerar cria a primeira. Em ambos o endereço anterior, se havia, deixa de valer.
  const { error } = existente
    ? await supabase.from("assinaturas_de_calendario").update(gravado).eq("pessoa_id", eu.id)
    : await supabase.from("assinaturas_de_calendario").insert({ ...gravado, pessoa_id: eu.id });
  if (error) return falhou(supabase, existente ? "calendario.regerado" : "calendario.gerado", error, "Não foi possível gerar o endereço.");

  revalidatePath("/conta");
  const origem = await origemDoApp();
  return {
    aviso: existente
      ? "Endereço novo gerado. O anterior deixou de valer: assine de novo nos aparelhos que o usavam."
      : "Endereço gerado.",
    endereco: `${origem}/feed/${token}.ics`,
  };
}

/** As opções do formulário, conferidas contra as Categorias que a pessoa enxerga e o nível dela. */
async function lerAsOpcoes(
  supabase: Awaited<ReturnType<typeof supabaseDoServidor>>,
  eu: NonNullable<Awaited<ReturnType<typeof perfilAtual>>>,
  dados: FormData,
): Promise<OpcoesDaAssinatura> {
  const existentes = (await categorias(supabase)).map((c) => c.id);
  return lerOpcoes(
    {
      escopo: campoTexto(dados, "escopo"),
      categorias: dados.getAll("categorias").map(String),
      aniversarios: dados.get("aniversarios") === "on",
    },
    eu,
    existentes,
  );
}

function falhou(
  supabase: Awaited<ReturnType<typeof supabaseDoServidor>>,
  acao: string,
  erro: { message?: string; code?: string } | null,
  mensagem: string,
): EstadoDaAssinatura {
  // Só o código vai para o Log: a mensagem do Postgres pode citar valores da linha, e o hash é segredo.
  registrarFalha(supabase, acao, { tipo: "assinatura" }, { code: erro?.code });
  return { erro: mensagem };
}
