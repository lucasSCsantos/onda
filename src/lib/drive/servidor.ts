import "server-only";
import type { ClienteDoDrive } from "@/dominio/pastas";
import { construirIndice, type Indice } from "@/dominio/arquivos";
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

/** Por quanto tempo o índice da busca vale. */
const VALIDADE_DO_INDICE_MS = 5 * 60_000;

/**
 * O índice da busca de Arquivos, guardado por 5 minutos (ler a raiz inteira pesa). Cada começo de busca tem o seu: a raiz,
 * o atalho ou a pasta atual quando o índice completo estourou o teto de pastas.
 */
export function indiceDeArquivos(): ((inicioId: string, recursivo: boolean) => Promise<Indice>) | null {
  const drive = driveDeArquivos();
  if (!drive) return null;
  return (inicioId, recursivo) =>
    drive.lembrar(`indice|${inicioId}|${recursivo}`, () => construirIndice({ cliente: drive.cliente, inicioId, recursivo }), VALIDADE_DO_INDICE_MS);
}

/** O botão "Atualizar" de Arquivos: esquece o que o servidor guardou do Drive. */
export const esquecerArquivosGuardados = () => driveDeArquivos()?.limpar();
