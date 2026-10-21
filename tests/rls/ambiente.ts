import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

/** Lê URL e chaves do Supabase local (`supabase start` precisa estar rodando). */
function ambienteLocal() {
  const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
  const valor = (nome: string) => {
    const linha = saida.split(/\r?\n/).find((l) => l.startsWith(`${nome}=`));
    if (!linha) throw new Error(`Supabase local sem ${nome}. Rode \`pnpm exec supabase start\`.`);
    return linha.slice(nome.length + 1).replace(/^"|"$/g, "");
  };
  return { url: valor("API_URL"), anon: valor("ANON_KEY"), servico: valor("SERVICE_ROLE_KEY") };
}

const ambiente = ambienteLocal();
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(ambiente.url, ambiente.servico, semSessao);

export function anonimo(): SupabaseClient {
  return createClient(ambiente.url, ambiente.anon, semSessao);
}

/** Cria uma conta nova e devolve um cliente já autenticado como ela. */
export async function contaNova(nome: string) {
  const email = `${crypto.randomUUID()}@teste.onda`;
  const senha = "senha-de-teste-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) throw error;

  const cliente = anonimo();
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) throw login.error;
  return { id: data.user.id, cliente };
}
