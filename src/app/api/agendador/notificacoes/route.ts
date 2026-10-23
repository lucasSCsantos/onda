import { autorizadoPeloAgendador } from "@/dominio/drive";
import { processarFila } from "@/lib/notificacoes/processar";
import { criarEnviador, modoDeTeste, pushConfigurado } from "@/lib/push/enviador";
import { supabaseDeServico } from "@/lib/supabase/servico";

// Cada rodada fala com os serviços de push; o `pg_net` do banco espera até 55 segundos pela resposta.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * O agendador do banco (`pg_cron` + `pg_net`, ADR 0007) chama esta rota a cada minuto em que há Notificação devida, com
 * `Authorization: Bearer <CRON_SECRET>`. Sem o segredo certo, nada acontece. Sem a chave de serviço ou as chaves VAPID
 * (e fora do modo de teste), responde 503 sem reservar nada: as Notificações esperam a configuração ficar pronta.
 */
export async function POST(request: Request) {
  if (!autorizadoPeloAgendador(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Não autorizado", { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || (!pushConfigurado() && !modoDeTeste())) {
    return Response.json({ processado: false, motivo: "faltam a chave de serviço do Supabase ou as chaves VAPID" }, { status: 503 });
  }

  try {
    const resumo = await processarFila(supabaseDeServico(), { enviar: criarEnviador(), simulado: modoDeTeste() });
    return Response.json({ processado: true, ...resumo });
  } catch (erro) {
    // Só a mensagem: nada de endpoint ou chave nos logs da hospedagem.
    console.error("agendador de notificações:", erro instanceof Error ? erro.message : "erro desconhecido");
    return Response.json({ processado: false, motivo: "erro ao processar a fila" }, { status: 500 });
  }
}
