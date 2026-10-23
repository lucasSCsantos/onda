import type { Metadata } from "next";
import { IconeDoAtalho } from "@/components/icone-do-atalho";
import { removerAtalho } from "@/lib/arquivos/acoes";
import { atalhosDoAdmin, funcoesParaMarcar } from "@/lib/arquivos/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioDeAtalho } from "./formulario";

export const metadata: Metadata = { title: "Arquivos" };

export default async function PaginaDeAtalhosDeArquivos() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const [atalhos, funcoes] = await Promise.all([atalhosDoAdmin(supabase), funcoesParaMarcar(supabase)]);
  const nomeDaFuncao = new Map(funcoes.map((f) => [f.id, f.nome]));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Arquivos</h1>
        <p className="text-sm text-texto-suave">
          Atalhos para pastas do Drive do ministério, no topo da seção Arquivos. Os atalhos só abrem pastas que estão dentro da pasta raiz
          informada em Configurações. Remover um atalho não mexe em nada no Drive.
        </p>
      </div>

      {atalhos.length === 0 ? (
        <p className="rounded-2xl border border-borda bg-superficie p-4 text-sm text-texto-suave">Nenhum atalho ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
          {atalhos.map((a) => (
            <li key={a.id}>
              <details>
                <summary className="toque flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 hover:bg-fundo [&::-webkit-details-marker]:hidden">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fundo text-marca">
                    <IconeDoAtalho icone={a.icone} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{a.nome}</span>
                    <span className="text-sm text-texto-suave">
                      {a.funcoes.length === 0
                        ? "Toda a Liderança"
                        : a.funcoes
                            .map((id) => nomeDaFuncao.get(id))
                            .filter(Boolean)
                            .join(", ")}
                    </span>
                  </span>
                  <span className="text-sm text-texto-suave">Editar</span>
                </summary>
                <div className="flex flex-col gap-4 border-t border-borda p-4">
                  <FormularioDeAtalho atalho={a} funcoes={funcoes} marcadas={a.funcoes} />
                  <form action={removerAtalho.bind(null, a.id)}>
                    <button type="submit" className="toque min-h-11 rounded-lg border border-borda px-4 text-sm text-erro">
                      Remover atalho
                    </button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="font-semibold">Novo atalho</h2>
        <FormularioDeAtalho funcoes={funcoes} />
      </div>
    </main>
  );
}
