import "server-only";
import { headers } from "next/headers";

/** Endereço público do app, para montar links enviados por e-mail ou WhatsApp. */
export async function origemDoApp() {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
  return host ? `${protocolo}://${host}` : (cabecalhos.get("origin") ?? "");
}
