"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { erroNoAdolescente } from "@/dominio/adolescentes";
import { campoTexto } from "@/lib/campos";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Cria (sem `id`) ou edita um Adolescente; o banco só deixa a Liderança escrever. */
export async function salvarAdolescente(id: string | null, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const adolescente = { nome: campoTexto(dados, "nome"), nascimento: campoTexto(dados, "nascimento") };
  const erro = erroNoAdolescente(adolescente, new Date());
  if (erro) return { erro };

  const supabase = await supabaseDoServidor();
  const { data, error } = id
    ? await supabase.from("adolescentes").update(adolescente).eq("id", id).select("id")
    : await supabase.from("adolescentes").insert(adolescente).select("id");
  if (error || !data?.length) return { erro: "Não foi possível salvar o Adolescente." };

  revalidatePath("/adolescentes");
  return { aviso: id ? "Adolescente salvo." : "Adolescente cadastrado." };
}

/** Inativar tira da lista sem apagar nada; reativar traz de volta. */
export async function definirAtivo(id: string, ativo: boolean) {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("adolescentes").update({ ativo }).eq("id", id).select("id");
  if (error || !data?.length) throw new Error("Não foi possível mudar a situação do Adolescente.");
  revalidatePath("/adolescentes");
}
