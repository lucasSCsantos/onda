import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./ambiente";

/** Rotas abertas a quem não entrou. O feed do calendário se autentica pelo token do endereço, não pela sessão. */
const ROTAS_PUBLICAS = ["/entrar", "/cadastro", "/recuperar-senha", "/auth/confirmar", "/feed"];

/** Renova a sessão nos cookies e manda quem não entrou para a tela de entrada. */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aGravar, cabecalhos) => {
        aGravar.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        aGravar.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        Object.entries(cabecalhos).forEach(([nome, valor]) => resposta.headers.set(nome, valor));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`));

  if (!data?.claims && !publica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}
