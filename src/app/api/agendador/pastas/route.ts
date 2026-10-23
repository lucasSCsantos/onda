import { autorizadoPeloAgendador } from "@/dominio/drive";
import { processarFilaDePastas } from "@/lib/drive/fila";
import { clienteDoDriveDoServidor } from "@/lib/drive/servidor";
import { supabaseDeServico } from "@/lib/supabase/servico";

/** Uma rodada pode criar várias pastas; o `pg_net` do banco espera até 55 segundos pela resposta. */
export const maxDuration = 60;

/**
 * O agendador do banco (`pg_cron` + `pg_net`, ADR 0007) chama esta rota a cada minuto em que há tarefa de pasta devida,
 * com `Authorization: Bearer <CRON_SECRET>`. Sem o segredo certo, nada acontece. Sem a chave de serviço ou as
 * credenciais do Google, responde 503 sem reservar tarefa nenhuma, então elas esperam até a configuração ficar pronta.
 */
export async function POST(request: Request) {
  if (!autorizadoPeloAgendador(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Não autorizado", { status: 401 });
  }

  const drive = clienteDoDriveDoServidor();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !drive) {
    return Response.json({ processado: false, motivo: "faltam a chave de serviço do Supabase ou as credenciais do Google" }, { status: 503 });
  }

  try {
    return Response.json({ processado: true, ...(await processarFilaDePastas(supabaseDeServico(), drive)) });
  } catch (erro) {
    // Só a mensagem: nada de credencial nos logs da hospedagem.
    console.error("agendador de pastas:", erro instanceof Error ? erro.message : "erro desconhecido");
    return Response.json({ processado: false, motivo: "erro ao processar a fila" }, { status: 500 });
  }
}
