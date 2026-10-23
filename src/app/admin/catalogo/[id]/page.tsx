import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { NativosDaCategoria } from "@/dominio/campos-nativos";
import { NOMES_DOS_TIPOS, type TipoDeCampo } from "@/dominio/catalogo";
import { removerCampo } from "@/lib/catalogo/acoes";
import { OPCOES_DE_TIPO, opcoesDeArea } from "@/lib/catalogo/consultas";
import { nativosDoBanco } from "@/lib/eventos/consultas";
import { exigirAdmin } from "@/lib/contas/perfil";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { FormularioCampo, FormularioCategoria } from "../formularios";

export const metadata: Metadata = { title: "Categoria" };

type CampoListado = { id: string; nome: string; tipo: TipoDeCampo; obrigatorio: boolean; opcoes: string[]; ordem: number };
type CategoriaEditada = {
  id: string;
  nome: string;
  area_id: string;
  cor: string;
  tem_chamada: boolean;
  nativo_local: NativosDaCategoria["local"];
  nativo_fim: NativosDaCategoria["fim"];
  nativo_observacoes: NativosDaCategoria["observacoes"];
  nativo_link: NativosDaCategoria["link"];
  campos_das_categorias: CampoListado[];
};

export default async function PaginaCategoria(props: PageProps<"/admin/catalogo/[id]">) {
  await exigirAdmin();
  const { id } = await props.params;
  const supabase = await supabaseDoServidor();
  const [{ data: categoria }, areas] = await Promise.all([
    supabase
      .from("categorias")
      .select(
        "id, nome, area_id, cor, tem_chamada, nativo_local, nativo_fim, nativo_observacoes, nativo_link, campos_das_categorias(id, nome, tipo, obrigatorio, opcoes, ordem)",
      )
      .eq("id", id)
      .order("ordem", { referencedTable: "campos_das_categorias" })
      .maybeSingle()
      .overrideTypes<CategoriaEditada, { merge: false }>(),
    opcoesDeArea(supabase),
  ]);
  if (!categoria) notFound();

  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-6">
          <Link href="/admin/catalogo" className="text-sm text-texto-suave hover:text-texto">
            ‹ Catálogo
          </Link>
          <h1 className="text-2xl font-semibold">{categoria.nome}</h1>
          <p className="text-sm text-texto-suave">
            A Área decide quem cria Eventos desta Categoria; a cor aparece no calendário.
          </p>
          <FormularioCategoria categoria={{ ...categoria, nativos: nativosDoBanco(categoria) }} areas={areas} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Campos específicos</h2>
          {categoria.campos_das_categorias.length === 0 && (
            <p className="text-texto-suave">Nenhum campo ainda. Os campos comuns (título, data, Responsável…) já existem.</p>
          )}
          <ul className="flex flex-col gap-3">
            {categoria.campos_das_categorias.map((campo) => (
              <li key={campo.id}>
                <details className="rounded-2xl border border-borda bg-superficie">
                  <summary className="cursor-pointer p-4">
                    <span className="font-semibold">{campo.nome}</span>
                    <span className="text-sm text-texto-suave">
                      {" "}
                      · {NOMES_DOS_TIPOS[campo.tipo]}
                      {campo.obrigatorio && " · obrigatório"}
                      {campo.opcoes.length > 0 && ` · ${campo.opcoes.join(", ")}`}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-borda p-4">
                    <FormularioCampo categoria={categoria.id} campo={campo} tipos={OPCOES_DE_TIPO} />
                    <form action={removerCampo.bind(null, categoria.id, campo.id)}>
                      <button type="submit" className="botao-discreto text-erro">
                        Remover campo
                      </button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
            <h3 className="font-semibold">Novo campo</h3>
            <FormularioCampo categoria={categoria.id} tipos={OPCOES_DE_TIPO} />
          </div>
        </section>
      </main>
    </>
  );
}
