"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { lerEdicao, lerEvento, podeEditarEvento, type CategoriaDoEvento, type EntradaDeEvento, type Evento } from "@/dominio/eventos";
import { campoTexto, nomeDoCampoEspecifico } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { areasDaPessoa, categoria as buscarCategoria, evento as buscarEvento, opcoesDaLideranca } from "./consultas";

/** Em caso de erro, devolve o que foi digitado para o formulário não perder nada. */
export type EstadoDoEvento = EstadoFormulario & { valores?: Record<string, string>; tentativa?: number };

const SEM_PERMISSAO = "42501";

const valoresDigitados = (dados: FormData) =>
  Object.fromEntries([...dados.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

function entradaDoFormulario(dados: FormData, categoria: CategoriaDoEvento): EntradaDeEvento {
  return {
    titulo: campoTexto(dados, "titulo"),
    data: campoTexto(dados, "data"),
    hora: campoTexto(dados, "hora"),
    dataFim: campoTexto(dados, "data_fim"),
    horaFim: campoTexto(dados, "hora_fim"),
    local: campoTexto(dados, "local"),
    responsavel: campoTexto(dados, "responsavel"),
    status: campoTexto(dados, "status"),
    observacoes: campoTexto(dados, "observacoes"),
    link: campoTexto(dados, "link"),
    campos: Object.fromEntries(categoria.campos.map((c) => [c.id, campoTexto(dados, nomeDoCampoEspecifico(c.id))])),
  };
}

/** As colunas de `public.eventos` que a criação e a edição gravam. */
const colunas = (evento: Evento) => ({
  titulo: evento.titulo,
  inicio: evento.inicio.toISOString(),
  fim: evento.fim?.toISOString() ?? null,
  dia_inteiro: evento.diaInteiro,
  local: evento.local,
  responsavel_id: evento.responsavel,
  status: evento.status,
  observacoes: evento.observacoes,
  link: evento.link,
  campos: evento.campos,
});

export async function criarEvento(categoriaId: string, anterior: EstadoDoEvento, dados: FormData): Promise<EstadoDoEvento> {
  const valores = valoresDigitados(dados);
  const falhou = (erro: string): EstadoDoEvento => ({ erro, valores, tentativa: (anterior.tentativa ?? 0) + 1 });

  const supabase = await supabaseDoServidor();
  const [categoria, lideranca] = await Promise.all([buscarCategoria(supabase, categoriaId), opcoesDaLideranca(supabase)]);
  if (!categoria) return falhou("Categoria não encontrada.");

  const lido = lerEvento(entradaDoFormulario(dados, categoria), categoria, lideranca.map((p) => p.valor));
  if ("erro" in lido) return falhou(lido.erro);

  const { error } = await supabase.from("eventos").insert({ ...colunas(lido.evento), categoria_id: categoria.id });
  if (error?.code === SEM_PERMISSAO) return falhou("Você não tem Função na Área desta Categoria.");
  if (error) return falhou("Não foi possível criar o Evento.");

  revalidatePath("/");
  redirect("/");
}

export async function editarEvento(id: string, anterior: EstadoDoEvento, dados: FormData): Promise<EstadoDoEvento> {
  const valores = valoresDigitados(dados);
  const falhou = (erro: string): EstadoDoEvento => ({ erro, valores, tentativa: (anterior.tentativa ?? 0) + 1 });

  const supabase = await supabaseDoServidor();
  const eu = await perfilAtual();
  if (!eu) return falhou("Entre de novo para editar.");
  const [gravado, areas, lideranca] = await Promise.all([
    buscarEvento(supabase, id),
    areasDaPessoa(supabase, eu.id),
    opcoesDaLideranca(supabase),
  ]);
  if (!gravado) return falhou("Evento não encontrado.");
  if (!podeEditarEvento(eu, areas, gravado)) return falhou("Você não pode editar este Evento.");

  const lido = lerEdicao(entradaDoFormulario(dados, gravado.categoria), gravado.categoria, lideranca.map((p) => p.valor), {
    anterior: gravado,
    quem: eu,
    agora: new Date(),
  });
  if ("erro" in lido) return falhou(lido.erro);

  const { data, error } = await supabase.from("eventos").update(colunas(lido.evento)).eq("id", id).select("id");
  if (error?.code === SEM_PERMISSAO || data?.length === 0) return falhou("Você não pode fazer esta alteração.");
  if (error) return falhou("Não foi possível salvar o Evento.");

  revalidatePath("/", "layout");
  redirect(`/eventos/${id}`);
}

/** Só o Admin exclui (podeExcluirEvento); a política de exclusão confere. */
export async function excluirEvento(id: string): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("eventos").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { erro: "Não foi possível excluir o Evento." };

  revalidatePath("/", "layout");
  redirect("/");
}
