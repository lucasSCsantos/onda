import type { Metadata } from "next";
import { categoriasComCampoDaPasta, configuracoes } from "@/lib/configuracoes/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { credenciaisDoGoogleConfiguradas } from "@/lib/drive/servidor";
import { marcacoes } from "@/lib/presenca/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioDeConfiguracoes } from "./formulario";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaDeConfiguracoes() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const [valores, todas, categoriasDoDrive] = await Promise.all([
    configuracoes(supabase),
    marcacoes(supabase),
    categoriasComCampoDaPasta(supabase),
  ]);
  const opcoes = todas.map((m) => ({ valor: m.id, texto: m.ativa ? m.nome : `${m.nome} (desativada)` }));
  // Só diz se as variáveis estão no servidor; nunca o conteúdo delas.
  const ambienteDoDrive = {
    google: credenciaisDoGoogleConfiguradas(),
    servico: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    agendador: Boolean(process.env.CRON_SECRET),
  };
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-texto-suave">O que dá para ajustar no Mural sem mexer no sistema. Cada mudança fica registrada nos Logs.</p>
      </div>
      <FormularioDeConfiguracoes valores={valores} marcacoes={opcoes} categoriasDoDrive={categoriasDoDrive} ambienteDoDrive={ambienteDoDrive} />
    </main>
  );
}
