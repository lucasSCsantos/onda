import { Marca } from "@/components/marca";
import { sair } from "@/lib/auth/acoes";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

export default async function Inicio() {
  const supabase = await supabaseDoServidor();
  const { data: perfil } = await supabase.from("perfis").select("nome").maybeSingle();

  return (
    <>
      <header className="flex items-center justify-between border-b border-borda bg-superficie px-4 py-3">
        <Marca qual="logotipo" rotulo="ONDA" className="h-9 w-14 text-texto" />
        <form action={sair}>
          <button type="submit" className="text-sm text-texto-suave hover:text-texto">
            Sair
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold">Olá{perfil?.nome ? `, ${perfil.nome}` : ""}!</h1>
        <p className="mt-2 text-texto-suave">O calendário do ministério vai aparecer aqui.</p>
      </main>
    </>
  );
}
