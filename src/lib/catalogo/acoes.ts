"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import type { NivelDeAcesso } from "@/dominio/acesso";
import {
  erroNaCategoria,
  erroNaFuncao,
  erroNasFuncoes,
  erroNoCampo,
  type CampoDaCategoria,
  type TipoDeCampo,
} from "@/dominio/catalogo";
import { campoTexto } from "@/lib/campos";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

const UNICO_VIOLADO = "23505";

export async function salvarFuncao(id: string | null, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const funcao = { nome: campoTexto(dados, "nome"), area: campoTexto(dados, "area") };
  const erro = erroNaFuncao(funcao);
  if (erro) return { erro };

  const supabase = await supabaseDoServidor();
  const linha = { nome: funcao.nome, area_id: funcao.area };
  const { error } = id
    ? await supabase.from("funcoes").update(linha).eq("id", id)
    : await supabase.from("funcoes").insert(linha);
  if (error?.code === UNICO_VIOLADO) return { erro: "Já existe uma Função com esse nome." };
  if (error) {
    registrarFalha(supabase, id ? "funcao.editada" : "funcao.criada", { tipo: "funcao", id, rotulo: funcao.nome }, error);
    return { erro: "Não foi possível salvar a Função." };
  }

  revalidatePath("/admin/catalogo");
  return { aviso: id ? "Função salva." : "Função criada." };
}

/** O nível vem do banco, não do formulário; `definir_funcoes` confere a mesma regra. */
export async function definirFuncoes(pessoa: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const funcoes = dados.getAll("funcoes").map(String);
  const supabase = await supabaseDoServidor();
  const { data: perfil } = await supabase.from("perfis").select("nivel").eq("id", pessoa).maybeSingle();
  if (!perfil) return { erro: "Pessoa não encontrada." };
  const erro = erroNasFuncoes(perfil.nivel as NivelDeAcesso, funcoes);
  if (erro) return { erro };

  const { error } = await supabase.rpc("definir_funcoes", { pessoa, novas_funcoes: funcoes });
  if (error) {
    registrarFalha(supabase, "conta.funcao_adicionada", { tipo: "conta", id: pessoa }, error);
    return { erro: "Não foi possível salvar as Funções." };
  }

  revalidatePath("/admin/usuarios");
  return { aviso: "Funções salvas." };
}

/** Nome, Área e cor de uma Categoria; criar leva à tela dos campos dela. */
export async function salvarCategoria(id: string | null, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const categoria = { nome: campoTexto(dados, "nome"), area: campoTexto(dados, "area"), cor: campoTexto(dados, "cor").toLowerCase() };
  const erro = erroNaCategoria(categoria);
  if (erro) return { erro };

  const supabase = await supabaseDoServidor();
  const linha = { nome: categoria.nome, area_id: categoria.area, cor: categoria.cor };
  const { data, error } = id
    ? await supabase.from("categorias").update(linha).eq("id", id).select("id").single()
    : await supabase.from("categorias").insert(linha).select("id").single();
  if (error?.code === UNICO_VIOLADO) return { erro: "Já existe uma Categoria com esse nome." };
  if (error) {
    registrarFalha(supabase, id ? "categoria.editada" : "categoria.criada", { tipo: "categoria", id, rotulo: categoria.nome }, error);
    return { erro: "Não foi possível salvar a Categoria." };
  }

  revalidatePath("/admin/catalogo");
  if (!id) redirect(`/admin/catalogo/${data.id}`);
  revalidatePath(`/admin/catalogo/${id}`);
  return { aviso: "Categoria salva." };
}

/** Cria (sem `id`) ou edita um campo específico de uma Categoria. Um campo novo entra no fim da lista. */
export async function salvarCampo(
  categoria: string,
  id: string | null,
  _: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  // O tipo chega como texto; erroNoCampo confere se é um dos dez.
  const tipo = campoTexto(dados, "tipo") as TipoDeCampo;
  const campo: CampoDaCategoria = {
    nome: campoTexto(dados, "nome"),
    tipo,
    obrigatorio: dados.get("obrigatorio") === "on",
    // As opções só existem na escolha; nos outros tipos o que estiver no campo é ignorado.
    opcoes:
      tipo === "escolha"
        ? campoTexto(dados, "opcoes")
            .split(/\r?\n/)
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
  };
  const erro = erroNoCampo(campo);
  if (erro) return { erro };

  const supabase = await supabaseDoServidor();
  let error;
  if (id) {
    ({ error } = await supabase.from("campos_das_categorias").update(campo).eq("id", id).eq("categoria_id", categoria));
  } else {
    const { data: ultimo } = await supabase
      .from("campos_das_categorias")
      .select("ordem")
      .eq("categoria_id", categoria)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase
      .from("campos_das_categorias")
      .insert({ ...campo, categoria_id: categoria, ordem: (ultimo?.ordem ?? -1) + 1 }));
  }
  if (error?.code === UNICO_VIOLADO) return { erro: "Já existe um campo com esse nome nesta Categoria." };
  if (error) {
    registrarFalha(supabase, id ? "categoria.campo_editado" : "categoria.campo_adicionado", { tipo: "categoria", id: categoria }, error);
    return { erro: "Não foi possível salvar o campo." };
  }

  revalidatePath(`/admin/catalogo/${categoria}`);
  return { aviso: id ? "Campo salvo." : "Campo adicionado." };
}

export async function removerCampo(categoria: string, id: string) {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.from("campos_das_categorias").delete().eq("id", id).eq("categoria_id", categoria);
  if (error) registrarFalha(supabase, "categoria.campo_removido", { tipo: "categoria", id: categoria }, error);
  revalidatePath(`/admin/catalogo/${categoria}`);
}
