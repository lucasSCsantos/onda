"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { lerAtalho } from "@/dominio/arquivos";
import { podeVerTodosOsEventos } from "@/dominio/eventos";
import { campoTexto } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { esquecerArquivosGuardados } from "@/lib/drive/servidor";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Cria (sem `id`) ou edita um atalho de Arquivos com as Funções que o veem; só o Admin (a função do banco confere). */
export async function salvarAtalho(id: string | null, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lido = lerAtalho({
    nome: campoTexto(dados, "nome"),
    icone: campoTexto(dados, "icone"),
    pasta: campoTexto(dados, "pasta"),
    funcoes: dados.getAll("funcao").map(String),
  });
  if ("erro" in lido) return lido;

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("salvar_atalho", {
    atalho: id,
    novo_nome: lido.nome,
    novo_icone: lido.icone,
    nova_pasta: lido.pastaId,
    novas_funcoes: lido.funcoes,
  });
  if (error) {
    registrarFalha(supabase, id ? "drive.atalho_editado" : "drive.atalho_criado", { tipo: "atalho", id, rotulo: lido.nome }, error);
    return { erro: "Não foi possível salvar o atalho." };
  }

  revalidatePath("/admin/arquivos");
  revalidatePath("/arquivos");
  return { aviso: id ? "Atalho salvo." : "Atalho criado." };
}

/** Remove o atalho (a pasta no Drive não é tocada); só o Admin (a política do banco confere). */
export async function removerAtalho(id: string): Promise<void> {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("atalhos_de_arquivos").delete().eq("id", id).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, "drive.atalho_removido", { tipo: "atalho", id }, error ?? { code: "42501", message: "nenhuma linha removida" });
    return;
  }
  revalidatePath("/admin/arquivos");
  revalidatePath("/arquivos");
}

/** O botão "Atualizar": esquece o que o servidor guardou do Drive e mostra a pasta de novo. */
export async function atualizarArquivos(): Promise<void> {
  // Não passa pelo banco, então confere aqui: só a Liderança ativa mexe no que o servidor guardou.
  const perfil = await perfilAtual();
  if (!perfil || !podeVerTodosOsEventos(perfil)) return;
  esquecerArquivosGuardados();
  revalidatePath("/arquivos");
}
