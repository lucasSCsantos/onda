"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { erroNaObservacao } from "@/dominio/observacoes";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Uma escrita que a política por linha barrou não dá erro: só não altera nada. Para o log, é falta de permissão. */
const SEM_LINHA = { code: "42501", message: "nenhuma linha alterada" };

const textoDe = (dados: FormData) => {
  const valor = dados.get("texto");
  return typeof valor === "string" ? valor : "";
};

/**
 * Escreve uma Observação sobre o Adolescente. O autor não vem do formulário: o banco o grava a partir da sessão.
 * O Log (só a ação, o Adolescente e quem fez) também sai do banco; aqui só as falhas, e nunca com o texto.
 */
export async function adicionarObservacao(adolescenteId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const texto = textoDe(dados);
  const erro = erroNaObservacao(texto);
  if (erro) return { erro };

  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("observacoes").insert({ adolescente_id: adolescenteId, texto }).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, "observacao.adicionada", { tipo: "adolescente", id: adolescenteId }, error ?? SEM_LINHA);
    return { erro: "Não foi possível salvar a observação." };
  }
  revalidatePath(`/adolescentes/${adolescenteId}`);
  return { aviso: "Observação adicionada." };
}

/** Só o autor e o Admin editam: para os outros o banco não altera nada. */
export async function editarObservacao(id: string, adolescenteId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const texto = textoDe(dados);
  const erro = erroNaObservacao(texto);
  if (erro) return { erro };

  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("observacoes").update({ texto }).eq("id", id).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, "observacao.editada", { tipo: "adolescente", id: adolescenteId }, error ?? SEM_LINHA);
    return { erro: "Não foi possível salvar a observação." };
  }
  revalidatePath(`/adolescentes/${adolescenteId}`);
  return { aviso: "Observação salva." };
}

/** Só o autor e o Admin apagam. */
export async function apagarObservacao(id: string, adolescenteId: string) {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("observacoes").delete().eq("id", id).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, "observacao.apagada", { tipo: "adolescente", id: adolescenteId }, error ?? SEM_LINHA);
    throw new Error("Não foi possível apagar a observação.");
  }
  revalidatePath(`/adolescentes/${adolescenteId}`);
}
