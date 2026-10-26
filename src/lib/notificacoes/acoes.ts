"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { lerConfiguracaoDasNotificacoes, lerPreferencias } from "@/dominio/notificacoes";
import { campoTexto } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

async function quemPode() {
  const eu = await perfilAtual();
  return eu && eu.ativo && eu.nivel !== "pendente" ? eu : null;
}

/** Os tipos que a pessoa quer receber e a janela de horário. As políticas do banco só deixam cada pessoa mexer nas próprias. */
export async function salvarPreferenciasDeNotificacao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const eu = await quemPode();
  if (!eu) return { erro: "Não foi possível salvar agora." };
  const lidas = lerPreferencias({
    tiposLigados: dados.getAll("tipo").map(String),
    inicio: String(dados.get("inicio") ?? ""),
    fim: String(dados.get("fim") ?? ""),
    nivel: eu.nivel,
  });
  if ("erro" in lidas) return lidas;

  const supabase = await supabaseDoServidor();
  const valores = { tipos_desligados: lidas.tiposDesligados, janela_inicio: lidas.janela.inicio, janela_fim: lidas.janela.fim };
  // Atualiza a linha que existe ou cria a primeira (um upsert pediria permissão de trocar o dono da linha).
  const atualizada = await supabase.from("preferencias_de_notificacao").update(valores).eq("pessoa_id", eu.id).select("pessoa_id");
  const erro = atualizada.error ?? (atualizada.data?.length ? null : (await supabase.from("preferencias_de_notificacao").insert({ pessoa_id: eu.id, ...valores })).error);
  if (erro) {
    registrarFalha(supabase, "notificacao.preferencias_alteradas", { tipo: "conta", id: eu.id }, { code: erro.code });
    return { erro: "Não foi possível salvar as preferências. Tente de novo." };
  }
  revalidatePath("/conta");
  return { aviso: "Preferências salvas." };
}

/** Marca uma Notificação da própria pessoa como lida (o banco só deixa mexer nas dela). */
export async function marcarComoLida(dados: FormData): Promise<void> {
  const eu = await quemPode();
  if (!eu) return;
  const supabase = await supabaseDoServidor();
  await supabase.from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("id", String(dados.get("id") ?? "")).is("lida_em", null);
  revalidatePath("/", "layout");
}

export async function marcarTodasComoLidas(): Promise<void> {
  const eu = await quemPode();
  if (!eu) return;
  const supabase = await supabaseDoServidor();
  await supabase.from("notificacoes").update({ lida_em: new Date().toISOString() }).is("lida_em", null);
  revalidatePath("/", "layout");
}

/** Só o Admin altera (a política de `configuracoes` confere); cada mudança vira um log pelo gatilho do banco. */
export async function salvarConfiguracaoDasNotificacoes(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lidas = lerConfiguracaoDasNotificacoes({
    canalLigado: campoTexto(dados, "canal_ligado"),
    retencaoDias: campoTexto(dados, "retencao_das_notificacoes"),
    limiteDeUrgenciaHoras: campoTexto(dados, "limite_de_urgencia"),
    lembreteLongoHoras: campoTexto(dados, "lembrete_longo"),
    lembreteCurtoHoras: campoTexto(dados, "lembrete_curto"),
    horaDoResumo: campoTexto(dados, "hora_do_resumo"),
  });
  if ("erro" in lidas) return lidas;

  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("configuracoes").update(lidas).eq("id", true).select("id");
  if (error || !data?.length) {
    registrarFalha(supabase, "configuracao.alterada", { tipo: "configuracao" }, error ?? { code: "42501", message: "nenhuma linha alterada" });
    return { erro: "Não foi possível salvar as configurações das Notificações." };
  }
  revalidatePath("/admin", "layout");
  return { aviso: "Configurações salvas." };
}
