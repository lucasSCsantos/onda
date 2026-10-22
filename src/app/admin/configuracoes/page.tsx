import type { Metadata } from "next";
import { configuracoes } from "@/lib/configuracoes/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioDeConfiguracoes } from "./formulario";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaDeConfiguracoes() {
  await exigirAdmin();
  const valores = await configuracoes(await supabaseDoServidor());
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-texto-suave">O que dá para ajustar no Mural sem mexer no sistema. Cada mudança fica registrada nos Logs.</p>
      </div>
      <FormularioDeConfiguracoes valores={valores} />
    </main>
  );
}
