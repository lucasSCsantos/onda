"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { lerHorarioPadrao, mudouOHorarioPadrao } from "@/dominio/horarios-padrao";
import { campoTexto } from "@/lib/campos";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/**
 * Grava o horário padrão (início e duração) de cada Categoria do formulário; vazio limpa. Só o Admin altera (a política e
 * a permissão de coluna de `categorias` conferem), e cada mudança vira um Log pelo gatilho do banco. Eventos já criados
 * não são tocados.
 */
export async function salvarHorariosPadrao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const linhas: { id: string; horario_padrao: string | null; duracao_padrao_minutos: number | null }[] = [];
  for (const id of dados.getAll("categoria").map(String)) {
    const lido = lerHorarioPadrao({ inicio: campoTexto(dados, `inicio_${id}`), duracao: campoTexto(dados, `duracao_${id}`) });
    if ("erro" in lido) return { erro: lido.erro };
    linhas.push({ id, horario_padrao: lido.inicio, duracao_padrao_minutos: lido.duracaoMinutos });
  }

  // Só grava o que mudou: sem mudança não há o que registrar nos Logs.
  const supabase = await supabaseDoServidor();
  const { data: atuais } = await supabase.from("categorias").select("id, horario_padrao, duracao_padrao_minutos");
  const atual = new Map((atuais ?? []).map((c) => [c.id as string, c]));
  const mudadas = linhas.filter(({ id, horario_padrao, duracao_padrao_minutos }) =>
    mudouOHorarioPadrao(atual.get(id), { inicio: horario_padrao, duracaoMinutos: duracao_padrao_minutos }),
  );
  for (const { id, ...padrao } of mudadas) {
    const { data, error } = await supabase.from("categorias").update(padrao).eq("id", id).select("id");
    if (error || !data?.length) {
      registrarFalha(supabase, "categoria.editada", { tipo: "categoria", id }, error ?? { code: "42501", message: "nenhuma linha alterada" });
      return { erro: "Não foi possível salvar os horários padrão." };
    }
  }

  revalidatePath("/admin/horarios");
  return { aviso: "Horários padrão salvos." };
}
