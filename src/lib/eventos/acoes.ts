"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { lerEvento, type EntradaDeEvento } from "@/dominio/eventos";
import { campoTexto, nomeDoCampoEspecifico } from "@/lib/campos";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { categoria as buscarCategoria, opcoesDaLideranca } from "./consultas";

/** Em caso de erro, devolve o que foi digitado para o formulário não perder nada. */
export type EstadoDoEvento = EstadoFormulario & { valores?: Record<string, string>; tentativa?: number };

const SEM_PERMISSAO = "42501";

export async function criarEvento(categoriaId: string, anterior: EstadoDoEvento, dados: FormData): Promise<EstadoDoEvento> {
  const valores = Object.fromEntries([...dados.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const falhou = (erro: string): EstadoDoEvento => ({ erro, valores, tentativa: (anterior.tentativa ?? 0) + 1 });

  const supabase = await supabaseDoServidor();
  const [categoria, lideranca] = await Promise.all([buscarCategoria(supabase, categoriaId), opcoesDaLideranca(supabase)]);
  if (!categoria) return falhou("Categoria não encontrada.");

  const entrada: EntradaDeEvento = {
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
  const lido = lerEvento(entrada, categoria, lideranca.map((p) => p.valor));
  if ("erro" in lido) return falhou(lido.erro);

  const { evento } = lido;
  const { error } = await supabase.from("eventos").insert({
    titulo: evento.titulo,
    categoria_id: categoria.id,
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
  if (error?.code === SEM_PERMISSAO) return falhou("Você não tem Função na Área desta Categoria.");
  if (error) return falhou("Não foi possível criar o Evento.");

  revalidatePath("/");
  redirect("/");
}
