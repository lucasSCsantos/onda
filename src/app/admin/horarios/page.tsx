import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/contas/perfil";
import { categorias } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioDeHorarios } from "./formulario";

export const metadata: Metadata = { title: "Horários padrão" };

export default async function PaginaDeHorariosPadrao() {
  await exigirAdmin();
  const todas = await categorias(await supabaseDoServidor());
  // A Postagem usa a data de publicação e nunca ganha horário.
  const linhas = todas.filter((c) => c.nome !== "Postagem").map((c) => ({ id: c.id, nome: c.nome, cor: c.cor, padrao: c.horarioPadrao }));
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Horários padrão</h1>
        <p className="text-sm text-texto-suave">
          O início e a duração que o formulário de Evento novo já traz preenchidos em cada Categoria. A duração só preenche o fim quando a
          Categoria mostra esse campo. Eventos já criados e a edição não mudam, e dá para alterar o horário em cada Evento. Cada mudança
          fica registrada nos Logs.
        </p>
      </div>
      <FormularioDeHorarios categorias={linhas} />
    </main>
  );
}
