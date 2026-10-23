"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

const SEM_PERMISSAO = "42501";
/** Erro de regra levantado pelo banco com a mensagem já escrita para a pessoa (Drive desligado, Categoria sem campo…). */
const REGRA = "P0001";

/** Pede a pasta do Evento sem esperar a criação automática; quem cria é o agendador, então a tela não espera o Drive. */
export async function criarPastaAgora(eventoId: string): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const { error } = await supabase.rpc("criar_pasta_agora", { evento: eventoId });
  if (error?.code === SEM_PERMISSAO) return { erro: "Você não pode pedir a pasta deste Evento." };
  if (error?.code === REGRA) return { erro: error.message };
  if (error) return { erro: "Não foi possível pedir a pasta agora. Tente de novo." };

  revalidatePath(`/eventos/${eventoId}`);
  return { aviso: "Pasta pedida. Em instantes o link aparece em “Link do material”." };
}
