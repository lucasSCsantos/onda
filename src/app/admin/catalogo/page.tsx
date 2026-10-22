import type { Metadata } from "next";
import Link from "next/link";
import { opcoesDeArea } from "@/lib/catalogo/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioCategoria, FormularioFuncao } from "./formularios";

export const metadata: Metadata = { title: "Catálogo" };

type Funcao = { id: string; nome: string; area_id: string };
type CategoriaListada = { id: string; nome: string; cor: string; areas: { nome: string }; campos_das_categorias: { count: number }[] };

export default async function PaginaCatalogo() {
  await exigirAdmin();
  const supabase = await supabaseDoServidor();
  const [{ data: funcoes }, { data: categorias }, areas] = await Promise.all([
    supabase.from("funcoes").select("id, nome, area_id").order("nome").overrideTypes<Funcao[], { merge: false }>(),
    supabase
      .from("categorias")
      .select("id, nome, cor, areas(nome), campos_das_categorias(count)")
      .order("nome")
      .overrideTypes<CategoriaListada[], { merge: false }>(),
    opcoesDeArea(supabase),
  ]);

  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Funções</h1>
          <p className="text-sm text-texto-suave">
            Quem tem uma Função cria Eventos de todas as Categorias da Área dela. A Área Geral cria todas. As Funções de
            cada pessoa se definem em Usuários.
          </p>
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {(funcoes ?? []).map((f) => (
              <li key={f.id} className="p-4">
                <FormularioFuncao funcao={f} areas={areas} />
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
            <h2 className="font-semibold">Nova Função</h2>
            <FormularioFuncao areas={areas} />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Categorias</h2>
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {(categorias ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/admin/catalogo/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-fundo">
                  <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                  <span className="flex-1">
                    <span className="font-semibold">{c.nome}</span>
                    <span className="text-sm text-texto-suave">
                      {" "}
                      · {c.areas.nome} · {c.campos_das_categorias[0]?.count ?? 0} campos
                    </span>
                  </span>
                  <span aria-hidden className="text-texto-suave">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
            <h3 className="font-semibold">Nova Categoria</h3>
            <p className="text-sm text-texto-suave">Depois de criar, você define os campos dela.</p>
            <FormularioCategoria areas={areas} />
          </div>
        </section>
      </main>
    </>
  );
}
