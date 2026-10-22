import type { Metadata } from "next";
import { IconeDaMarcacao } from "@/components/icone-da-marcacao";
import { exigirAdmin } from "@/lib/contas/perfil";
import { marcacoes } from "@/lib/presenca/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioDeMarcacao } from "./formulario";

export const metadata: Metadata = { title: "Marcações" };

export default async function PaginaDeMarcacoes() {
  await exigirAdmin();
  const lista = await marcacoes(await supabaseDoServidor());
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Marcações</h1>
        <p className="text-sm text-texto-suave">
          O que se marca para cada Adolescente na Chamada, e quantos pontos vale no ranking. Mudar os pontos refaz o ranking de todos os anos,
          porque ele é calculado na hora.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
        {lista.map((m) => (
          <li key={m.id} className={m.ativa ? "" : "opacity-70"}>
            <details>
              <summary className="toque flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 hover:bg-fundo [&::-webkit-details-marker]:hidden">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fundo text-marca">
                  <IconeDaMarcacao icone={m.icone} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">
                    {m.nome}
                    {!m.ativa && <span className="ml-2 text-sm font-normal text-texto-suave">(desativada)</span>}
                  </span>
                  <span className="text-sm text-texto-suave">
                    {m.pontos} {m.pontos === 1 ? "ponto" : "pontos"}
                    {m.contaPresenca && " · conta como presença"}
                    {m.pedeVisitante && " · pede o nome do visitante"}
                  </span>
                </span>
                <span className="text-sm text-texto-suave">Editar</span>
              </summary>
              <div className="border-t border-borda p-4">
                <FormularioDeMarcacao marcacao={m} />
              </div>
            </details>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="font-semibold">Nova Marcação</h2>
        <FormularioDeMarcacao />
      </div>
    </main>
  );
}
