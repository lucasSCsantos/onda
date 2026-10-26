import "server-only";
import webpush from "web-push";
import type { EnviadorDePush } from "@/dominio/push";

/**
 * O adaptador de envio (ADR 0007): o único lugar que fala com a biblioteca `web-push`. As chaves VAPID vêm só do ambiente
 * do servidor: a pública (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) também vai ao navegador; a privada nunca.
 * Com `PUSH_MODO_TESTE=1` (dry-run) nada sai: só se finge que deu certo, para ensaiar sem incomodar ninguém.
 */
export function pushConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

/** O envio está pronto neste ambiente: chaves VAPID, chave de serviço e segredo do agendador. Só diz sim ou não, nunca o conteúdo. */
export const envioPronto = () => pushConfigurado() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && Boolean(process.env.CRON_SECRET);

export const modoDeTeste = () => process.env.PUSH_MODO_TESTE === "1";

export function criarEnviador(): EnviadorDePush {
  if (modoDeTeste()) return async () => ({ ok: true });

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const assunto = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !assunto) throw new Error("Faltam as chaves VAPID no ambiente do servidor.");
  const vapid = { subject: assunto, publicKey: publica, privateKey: privada };

  return async (dispositivo, carga, { ttl }) => {
    try {
      await webpush.sendNotification(
        { endpoint: dispositivo.endpoint, keys: { p256dh: dispositivo.p256dh, auth: dispositivo.auth } },
        carga,
        { TTL: ttl, vapidDetails: vapid },
      );
      return { ok: true };
    } catch (erro) {
      // Só o status interessa (404 e 410 removem a inscrição); a mensagem do erro cita o endpoint e não vai a lugar nenhum.
      const status = (erro as { statusCode?: unknown }).statusCode;
      return { ok: false, status: typeof status === "number" ? status : undefined };
    }
  };
}
