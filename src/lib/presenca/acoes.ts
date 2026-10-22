"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { lerMarcacao } from "@/dominio/presenca";
import { campoTexto } from "@/lib/campos";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

const SEM_PERMISSAO = "42501";
const UNICO_VIOLADO = "23505";
const eId = (valor: unknown): valor is string => typeof valor === "string" && /^[0-9a-f-]{36}$/i.test(valor);

/**
 * Grava as Marcações de um Adolescente numa aula (o que não vier fica desmarcado), a cada toque da Chamada.
 * `salvar_presenca` confere quem pode, o Adolescente ativo, as Marcações ativas e o visitante, e grava o log.
 */
export async function salvarPresenca(
  eventoId: string,
  adolescenteId: string,
  marcacoes: string[],
  visitante: string | null,
): Promise<{ erro?: string }> {
  if (!eId(eventoId) || !eId(adolescenteId) || !Array.isArray(marcacoes) || !marcacoes.every(eId)) return { erro: "Dados inválidos." };
  const nome = typeof visitante === "string" ? visitante.trim().slice(0, 80) : "";

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("salvar_presenca", {
    evento: eventoId,
    adolescente: adolescenteId,
    marcacoes,
    visitante: nome || null,
  });
  if (error) {
    registrarFalha(supabase, "presenca.chamada_registrada", { tipo: "evento", id: eventoId }, error);
    return { erro: error.code === SEM_PERMISSAO ? "Você não pode fazer a chamada desta aula." : "Não foi possível salvar. Toque de novo." };
  }
  return {};
}

/** Cria (sem `id`) ou edita uma Marcação; só o Admin (a política de `marcacoes` confere). Uma nova entra no fim. */
export async function salvarMarcacao(id: string | null, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lida = lerMarcacao({
    nome: campoTexto(dados, "nome"),
    icone: campoTexto(dados, "icone"),
    pontos: campoTexto(dados, "pontos"),
    ativa: id ? campoTexto(dados, "ativa") : "on",
    contaPresenca: campoTexto(dados, "conta_presenca"),
    pedeVisitante: campoTexto(dados, "pede_visitante"),
  });
  if ("erro" in lida) return lida;
  const linha = {
    nome: lida.nome,
    icone: lida.icone,
    pontos: lida.pontos,
    ativa: lida.ativa,
    conta_presenca: lida.contaPresenca,
    pede_visitante: lida.pedeVisitante,
  };

  const supabase = await supabaseDoServidor();
  let error;
  if (id) {
    ({ error } = await supabase.from("marcacoes").update(linha).eq("id", id));
  } else {
    const { data: ultima } = await supabase.from("marcacoes").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
    ({ error } = await supabase.from("marcacoes").insert({ ...linha, ordem: (ultima?.ordem ?? -1) + 1 }));
  }
  if (error?.code === UNICO_VIOLADO) {
    return {
      erro: error.message.includes("marcacoes_uma_de_presenca")
        ? "Só uma Marcação conta como presença. Desligue a opção na outra antes."
        : "Já existe uma Marcação com esse nome.",
    };
  }
  if (error) {
    registrarFalha(supabase, id ? "marcacao.editada" : "marcacao.criada", { tipo: "marcacao", id, rotulo: lida.nome }, error);
    return { erro: "Não foi possível salvar a Marcação." };
  }

  revalidatePath("/admin/marcacoes");
  return { aviso: id ? "Marcação salva." : "Marcação criada." };
}
