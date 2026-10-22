"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { podeCriarEvento } from "@/dominio/catalogo";
import { cancelarFuturas, encerrarSerie, formatarDia, lerDiaDeEncerramento, resumoDosCancelamentos } from "@/dominio/series";
import { campoTexto } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { linhaDaAlteracao } from "@/lib/eventos/colunas";
import { registrarFalha } from "@/lib/logs/registrar";
import { areasDaPessoa, evento as buscarEvento, serie as buscarSerie } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

const SEM_PERMISSAO = "42501";

/** Quem mexe na Série é quem cria Eventos da Categoria (a Área, ou o Admin); o banco confere a mesma regra. */
async function carregar(eventoId: string) {
  const supabase = await supabaseDoServidor();
  const eu = await perfilAtual();
  if (!eu) return { erro: "Entre de novo para continuar." };
  const [evento, areas] = await Promise.all([buscarEvento(supabase, eventoId), areasDaPessoa(supabase, eu.id)]);
  if (!evento?.serieId) return { erro: "Série não encontrada." };
  if (!podeCriarEvento(eu, areas, evento.categoria)) return { erro: "Você não tem Função na Área desta Categoria." };
  const serie = await buscarSerie(supabase, evento.serieId);
  if (!serie) return { erro: "Série não encontrada." };
  return { supabase, serie, titulo: evento.titulo };
}

/** Encerrar define o último dia da Série: as Ocorrências abertas depois dele viram Canceladas. */
export async function encerrarASerie(eventoId: string, _anterior: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const carregado = await carregar(eventoId);
  if ("erro" in carregado) return carregado;
  const { supabase, serie, titulo } = carregado;

  const lido = lerDiaDeEncerramento(campoTexto(dados, "ate"), serie.ocorrencias);
  if ("erro" in lido) return lido;
  const ate = lido.dia;

  const alteracoes = encerrarSerie(serie.ocorrencias, ate, new Date());
  const { error } = await supabase.rpc("encerrar_serie", {
    serie: serie.id,
    ate,
    alteracoes: alteracoes.map(linhaDaAlteracao),
  });
  if (error) registrarFalha(supabase, "serie.encerrada", { tipo: "serie", id: serie.id, rotulo: titulo }, error);
  if (error?.code === SEM_PERMISSAO) return { erro: "Você não pode encerrar esta Série." };
  if (error) return { erro: "Não foi possível encerrar a Série." };

  revalidatePath("/", "layout");
  return { aviso: `Série encerrada em ${formatarDia(ate)}. ${resumoDosCancelamentos(alteracoes.length)}` };
}

/** Cancela as Ocorrências que ainda não começaram; as passadas ficam como estão. */
export async function cancelarAsFuturas(eventoId: string): Promise<EstadoFormulario> {
  const carregado = await carregar(eventoId);
  if ("erro" in carregado) return carregado;
  const { supabase, serie, titulo } = carregado;

  const alteracoes = cancelarFuturas(serie.ocorrencias, new Date());
  if (alteracoes.length === 0) return { aviso: "Não há Ocorrências futuras abertas." };

  const { error } = await supabase.rpc("editar_serie", {
    serie: serie.id,
    escopo: "cancelar_futuras",
    alteracoes: alteracoes.map(linhaDaAlteracao),
  });
  if (error) registrarFalha(supabase, "serie.editada", { tipo: "serie", id: serie.id, rotulo: titulo }, error);
  if (error?.code === SEM_PERMISSAO) return { erro: "Você não pode cancelar estas Ocorrências." };
  if (error) return { erro: "Não foi possível cancelar as Ocorrências." };

  revalidatePath("/", "layout");
  return { aviso: resumoDosCancelamentos(alteracoes.length) };
}

/** Só o Admin exclui (a política de exclusão confere); as Ocorrências vão junto. */
export async function excluirASerie(serieId: string): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("series").delete().eq("id", serieId).select("id");
  if (error || data.length === 0) {
    registrarFalha(supabase, "serie.excluida", { tipo: "serie", id: serieId }, error ?? { code: SEM_PERMISSAO, message: "nenhuma linha alterada" });
    return { erro: "Não foi possível excluir a Série." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
