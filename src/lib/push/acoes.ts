"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_DO_DISPOSITIVO, entregar, lerInscricao, nomeDoDispositivo, NOTIFICACAO_DE_TESTE } from "@/dominio/push";
import { perfilAtual } from "@/lib/contas/perfil";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDeServico } from "@/lib/supabase/servico";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { criarEnviador, modoDeTeste, pushConfigurado } from "./enviador";

/** O que a tela mostra depois de uma ação. Nunca leva endpoint nem chave. */
export type EstadoDoPush = { erro?: string; aviso?: string };

const SEM_PERMISSAO = "Não foi possível fazer isso agora.";

async function quemPode() {
  const eu = await perfilAtual();
  return eu && eu.ativo && eu.nivel !== "pendente" ? eu : null;
}

/** O aparelho só marca "este dispositivo" por um cookie do servidor com o hash do endpoint; sair da conta usa o mesmo. */
async function lembrarDispositivo(hash: string) {
  (await cookies()).set(COOKIE_DO_DISPOSITIVO, hash, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/**
 * Cadastra a inscrição de push deste aparelho, depois que a pessoa tocou em "Ativar" e o navegador deu a permissão. O
 * banco guarda endpoint e chaves; a ação devolve só o resultado. O Log de "ativado" sai do gatilho do banco.
 */
export async function ativarPush(inscricaoDoNavegador: unknown): Promise<EstadoDoPush> {
  const eu = await quemPode();
  const inscricao = lerInscricao(inscricaoDoNavegador);
  if (!eu || !inscricao) return { erro: "Não foi possível ativar as Notificações neste aparelho." };

  const supabase = await supabaseDoServidor();
  const nome = nomeDoDispositivo((await headers()).get("user-agent") ?? "");
  const { data, error } = await supabase.rpc("registrar_inscricao_de_push", {
    endereco: inscricao.endpoint,
    chave_p256dh: inscricao.p256dh,
    chave_auth: inscricao.auth,
    apelido: nome,
  });
  const gravada = Array.isArray(data) ? data[0] : null;
  if (error || !gravada) {
    // Só o código vai para o Log: a mensagem do Postgres pode citar valores da linha, e endpoint e chaves são segredos.
    registrarFalha(supabase, "push.ativado", { tipo: "dispositivo", rotulo: nome }, { code: error?.code });
    return { erro: error?.code === "P0001" ? "Você já tem 10 dispositivos. Desative algum para ativar este." : "Não foi possível ativar as Notificações neste aparelho." };
  }
  await lembrarDispositivo(gravada.endpoint_hash);
  revalidatePath("/conta");
  return { aviso: "Notificações ativadas neste aparelho." };
}

/** Desativa um dispositivo (o da lista) ou todos. O navegador cancela a própria inscrição do lado dele. */
export async function desativarPush(_: EstadoDoPush, dados: FormData): Promise<EstadoDoPush> {
  const eu = await quemPode();
  if (!eu) return { erro: SEM_PERMISSAO };
  const supabase = await supabaseDoServidor();

  const id = String(dados.get("dispositivo") ?? "");
  const consulta = supabase.from("inscricoes_de_push").delete().eq("pessoa_id", eu.id);
  const { error } = await (id === "todos" ? consulta : consulta.eq("id", id));
  if (error) {
    registrarFalha(supabase, "push.desativado", { tipo: "dispositivo" }, { code: error.code });
    return { erro: "Não foi possível desativar. Tente de novo." };
  }
  const cookie = await cookies();
  const atual = cookie.get(COOKIE_DO_DISPOSITIVO)?.value;
  if (atual) {
    // O cookie só vale se a inscrição que ele aponta continua na lista.
    const { data } = await supabase.from("inscricoes_de_push").select("id").eq("endpoint_hash", atual).maybeSingle();
    if (!data) cookie.delete(COOKIE_DO_DISPOSITIVO);
  }
  revalidatePath("/conta");
  return { aviso: id === "todos" ? "Notificações desativadas em todos os dispositivos." : "Dispositivo desativado." };
}

/**
 * Envia a Notificação de teste só para a própria pessoa, a todos os dispositivos dela. Inscrição que o serviço de push
 * recusa com 404 ou 410 sai do banco. O Log leva só as contagens.
 */
export async function enviarTesteDePush(): Promise<EstadoDoPush> {
  const eu = await quemPode();
  if (!eu) return { erro: SEM_PERMISSAO };
  if (!pushConfigurado() && !modoDeTeste()) return { erro: "As Notificações ainda não foram configuradas neste ambiente." };

  const servico = supabaseDeServico();
  const { data } = await servico.from("inscricoes_de_push").select("id, endpoint, p256dh, auth").eq("pessoa_id", eu.id);
  if (!data || data.length === 0) return { erro: "Ative as Notificações em pelo menos um dispositivo antes de testar." };

  const entrega = await entregar(data, NOTIFICACAO_DE_TESTE, criarEnviador());

  if (entrega.expirados.length > 0) await servico.from("inscricoes_de_push").delete().in("id", entrega.expirados);
  if (entrega.enviados.length > 0 && !modoDeTeste()) {
    await servico.from("inscricoes_de_push").update({ usado_em: new Date().toISOString() }).in("id", entrega.enviados);
  }
  const supabase = await supabaseDoServidor();
  await supabase.rpc("registrar_teste_de_push", { enviados: entrega.enviados.length, falhas: entrega.falhas.length + entrega.expirados.length });
  revalidatePath("/conta");

  if (entrega.enviados.length === 0) return { erro: "Nenhum dispositivo recebeu o teste. Desative e ative de novo as Notificações." };
  const falhou = entrega.falhas.length + entrega.expirados.length;
  const base = modoDeTeste() ? "Modo de teste: nada foi enviado de verdade. " : "";
  return { aviso: `${base}Teste enviado a ${entrega.enviados.length} dispositivo${entrega.enviados.length === 1 ? "" : "s"}${falhou > 0 ? `; ${falhou} não recebeu${falhou === 1 ? "" : "ram"}` : ""}.` };
}
