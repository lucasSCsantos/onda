import { createSign } from "node:crypto";
import { consultaDeBusca, ErroDoDrive } from "@/dominio/drive";
import type { ClienteDoDrive } from "@/dominio/pastas";

// O cliente real do Drive: API v3 do Google, com a service account do ministério (ADR 0006). Não usa pacote do Google:
// são três chamadas HTTP e um JWT assinado com o `node:crypto`. Recebe as credenciais de fora (quem as lê do ambiente é
// `servidor.ts`), então serve igual ao app e aos testes, que apontam as URLs para um servidor de mentira.

const ESCOPO = "https://www.googleapis.com/auth/drive";
const API_PADRAO = "https://www.googleapis.com/drive/v3";
const TOKEN_PADRAO = "https://oauth2.googleapis.com/token";
const PASTA = "application/vnd.google-apps.folder";
/** Pede o token de novo um pouco antes de vencer. */
const MARGEM_DO_TOKEN_MS = 60_000;
const TEMPO_LIMITE_MS = 20_000;

export type Credenciais = { client_email: string; private_key: string };

/** As credenciais da service account, do JSON que o Google entrega; nulas se não for uma chave de service account. */
export function lerCredenciais(json: string | undefined): Credenciais | null {
  if (!json?.trim()) return null;
  try {
    const chave = JSON.parse(json) as Partial<Credenciais> & { type?: string };
    if (chave.type !== "service_account" || !chave.client_email || !chave.private_key) return null;
    return { client_email: chave.client_email, private_key: chave.private_key };
  } catch {
    return null;
  }
}

export type OpcoesDoGoogle = {
  credenciais: Credenciais;
  urlDaApi?: string;
  urlDoToken?: string;
  fetch?: typeof fetch;
  /** Relógio em milissegundos; os testes o adiantam. */
  agora?: () => number;
};

const emBase64Url = (valor: string | Buffer) => Buffer.from(valor).toString("base64url");

/** O JWT que a service account assina para pedir o token (válido por uma hora). */
function assinarPedidoDeToken(credenciais: Credenciais, audiencia: string, agoraEmSegundos: number): string {
  const cabecalho = emBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const reivindicacoes = emBase64Url(
    JSON.stringify({ iss: credenciais.client_email, scope: ESCOPO, aud: audiencia, iat: agoraEmSegundos, exp: agoraEmSegundos + 3600 }),
  );
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${reivindicacoes}`).sign(credenciais.private_key);
  return `${cabecalho}.${reivindicacoes}.${emBase64Url(assinatura)}`;
}

/** O texto curto do erro de uma resposta do Google; nunca o corpo inteiro. */
async function motivoDe(resposta: Response): Promise<string> {
  try {
    const corpo = (await resposta.json()) as { error?: string | { message?: string }; error_description?: string };
    if (typeof corpo.error === "string") return corpo.error;
    return corpo.error?.message ?? "";
  } catch {
    return "";
  }
}

export function criarClienteDoGoogle({
  credenciais,
  urlDaApi = API_PADRAO,
  urlDoToken = TOKEN_PADRAO,
  fetch: buscar = fetch,
  agora = Date.now,
}: OpcoesDoGoogle): ClienteDoDrive {
  let token: { valor: string; venceEm: number } | null = null;

  async function tokenDeAcesso(): Promise<string> {
    if (token && agora() < token.venceEm - MARGEM_DO_TOKEN_MS) return token.valor;
    const resposta = await buscar(urlDoToken, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assinarPedidoDeToken(credenciais, urlDoToken, Math.floor(agora() / 1000)),
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) throw new ErroDoDrive(`o Google recusou as credenciais (${resposta.status} ${await motivoDe(resposta)})`.trim());
    const corpo = (await resposta.json()) as { access_token: string; expires_in: number };
    token = { valor: corpo.access_token, venceEm: agora() + corpo.expires_in * 1000 };
    return token.valor;
  }

  /** Um pedido à API do Drive. 404 é permanente (a pasta não existe ou a conta não a enxerga); o resto passa. */
  async function pedir(caminho: string, parametros: Record<string, string>, init: RequestInit = {}): Promise<unknown> {
    const url = new URL(`${urlDaApi}${caminho}`);
    for (const [chave, valor] of Object.entries({ ...parametros, supportsAllDrives: "true" })) url.searchParams.set(chave, valor);
    const resposta = await buscar(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await tokenDeAcesso()}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) {
      throw new ErroDoDrive(`Drive ${resposta.status}: ${await motivoDe(resposta)}`.trim(), { permanente: resposta.status === 404 });
    }
    return resposta.json();
  }

  return {
    async buscarPasta(nome, paiId) {
      const corpo = (await pedir("/files", {
        q: consultaDeBusca(nome, paiId),
        fields: "files(id)",
        pageSize: "1",
        includeItemsFromAllDrives: "true",
      })) as { files?: { id: string }[] };
      return corpo.files?.[0] ?? null;
    },
    async criarPasta(nome, paiId) {
      const corpo = (await pedir(
        "/files",
        { fields: "id" },
        { method: "POST", body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [paiId] }) },
      )) as { id: string };
      return { id: corpo.id };
    },
    async renomearPasta(pastaId, nome) {
      await pedir(`/files/${encodeURIComponent(pastaId)}`, { fields: "id" }, { method: "PATCH", body: JSON.stringify({ name: nome }) });
    },
  };
}
