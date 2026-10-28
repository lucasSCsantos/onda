"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { erroNoAdolescente } from "@/dominio/adolescentes";
import { lerGenero } from "@/dominio/genero";
import { campoTexto } from "@/lib/campos";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Uma escrita que a política por linha barrou não dá erro: só não altera nada. Para o log, é falta de permissão. */
const SEM_LINHA = { code: "42501", message: "nenhuma linha alterada" };

/**
 * Cria (sem `id`) ou edita um Adolescente; o banco só deixa a Liderança escrever. O Gênero é obrigatório no cadastro
 * novo; ao editar um registro antigo, em branco, ele segue como está.
 */
export async function salvarAdolescente(id: string | null, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const informado = { nome: campoTexto(dados, "nome"), nascimento: campoTexto(dados, "nascimento"), genero: campoTexto(dados, "genero") };
  const erro = erroNoAdolescente(informado, new Date(), id === null);
  if (erro) return { erro };
  const genero = lerGenero(informado.genero);
  const adolescente = { nome: informado.nome, nascimento: informado.nascimento, ...(genero && { genero }) };

  const supabase = await supabaseDoServidor();
  const { data, error } = id
    ? await supabase.from("adolescentes").update(adolescente).eq("id", id).select("id")
    : await supabase.from("adolescentes").insert(adolescente).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, id ? "adolescente.editado" : "adolescente.cadastrado", { tipo: "adolescente", id, rotulo: adolescente.nome }, error ?? SEM_LINHA);
    return { erro: "Não foi possível salvar o Adolescente." };
  }

  revalidatePath("/adolescentes");
  if (id) revalidatePath(`/adolescentes/${id}`);
  return { aviso: id ? "Adolescente salvo." : "Adolescente cadastrado." };
}

/** Inativar tira da lista sem apagar nada; reativar traz de volta. */
export async function definirAtivo(id: string, ativo: boolean) {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("adolescentes").update({ ativo }).eq("id", id).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, ativo ? "adolescente.reativado" : "adolescente.inativado", { tipo: "adolescente", id }, error ?? SEM_LINHA);
    throw new Error("Não foi possível mudar a situação do Adolescente.");
  }
  revalidatePath("/adolescentes");
}
