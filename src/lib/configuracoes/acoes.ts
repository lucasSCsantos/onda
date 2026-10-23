"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { lerConfiguracoes } from "@/dominio/configuracoes";
import { lerConfiguracaoDoDrive } from "@/dominio/drive";
import { lerConfiguracaoDasNotificacoes } from "@/dominio/notificacoes";
import { campoTexto } from "@/lib/campos";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Só o Admin altera (a política de `configuracoes` confere); cada mudança vira um log pelo gatilho do banco. */
export async function salvarConfiguracoes(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lidas = lerConfiguracoes({
    retencao: campoTexto(dados, "retencao"),
    lideresVeemHistorico: campoTexto(dados, "lideres_veem_historico"),
    faltasParaAlerta: campoTexto(dados, "faltas_para_alerta"),
    desempate: campoTexto(dados, "desempate"),
    janelaDaChamada: campoTexto(dados, "janela_da_chamada"),
  });
  if ("erro" in lidas) return lidas;

  const drive = lerConfiguracaoDoDrive({
    ligado: campoTexto(dados, "drive_ligado"),
    pastaRaiz: campoTexto(dados, "drive_pasta_raiz"),
    categorias: dados.getAll("drive_categoria").map(String),
  });
  if ("erro" in drive) return drive;

  const notificacoes = lerConfiguracaoDasNotificacoes({ retencaoDias: campoTexto(dados, "retencao_das_notificacoes") });
  if ("erro" in notificacoes) return notificacoes;

  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({ ...lidas, ...drive, ...notificacoes })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, "configuracao.alterada", { tipo: "configuracao" }, error ?? { code: "42501", message: "nenhuma linha alterada" });
    return { erro: "Não foi possível salvar as configurações." };
  }

  revalidatePath("/admin", "layout");
  return { aviso: "Configurações salvas." };
}
