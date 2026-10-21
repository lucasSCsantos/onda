import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./ambiente";

/** Cliente do Supabase para Server Components, Server Actions e Route Handlers, agindo como quem está logado. */
export async function supabaseDoServidor() {
  const loja = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (aGravar) => {
        try {
          aGravar.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Server Components não gravam cookies; o proxy renova a sessão a cada requisição.
        }
      },
    },
  });
}
