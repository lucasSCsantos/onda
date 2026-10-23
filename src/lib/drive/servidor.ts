import "server-only";
import type { ClienteDoDrive } from "@/dominio/pastas";
import { comCache } from "./cache";
import { criarClienteDoGoogle, lerCredenciais } from "./google";

/** O Drive do ministério com a service account guardada no ambiente do servidor; nulo se as credenciais não estão lá. */
export function clienteDoDriveDoServidor(): ClienteDoDrive | null {
  const credenciais = lerCredenciais(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return credenciais ? criarClienteDoGoogle({ credenciais }) : null;
}

/** As credenciais do Google estão configuradas? Só diz sim ou não: nunca devolve o conteúdo. */
export const credenciaisDoGoogleConfiguradas = () => lerCredenciais(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) !== null;

let compartilhado: ReturnType<typeof comCache> | null | undefined;

/** O Drive de Arquivos: o mesmo cliente e o mesmo cache para todos os pedidos deste servidor; nulo sem credenciais. */
function driveDeArquivos() {
  if (compartilhado === undefined) {
    const cliente = clienteDoDriveDoServidor();
    compartilhado = cliente ? comCache(cliente) : null;
  }
  return compartilhado;
}

export const clienteDeArquivos = (): ClienteDoDrive | null => driveDeArquivos()?.cliente ?? null;

/** O botão "Atualizar" de Arquivos: esquece o que o servidor guardou do Drive. */
export const esquecerArquivosGuardados = () => driveDeArquivos()?.limpar();
