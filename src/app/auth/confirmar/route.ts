import { NextResponse, type NextRequest } from "next/server";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Destino dos links enviados por e-mail: troca o código por uma sessão e segue para `proximo`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const proximo = searchParams.get("proximo") ?? "/";
  // Só caminhos internos, para o link não poder mandar ninguém para fora do app.
  const destino = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/";

  if (codigo) {
    const supabase = await supabaseDoServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`);
}
