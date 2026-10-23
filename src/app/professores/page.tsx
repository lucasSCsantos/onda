import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { CAMINHO_DOS_PROFESSORES, caminhoDosProfessores, podeCadastrarProfessor } from "@/dominio/professores";
import { perfilAtual } from "@/lib/contas/perfil";
import { areasDaPessoa } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { ConteudoDeProfessores } from "./conteudo";

export const metadata: Metadata = { title: "Professores" };

/** Professores fora do Admin, para quem tem Função em Ensino; o Admin é levado à tela dentro do Admin, com a barra lateral. */
export default async function PaginaProfessores() {
  const eu = await perfilAtual();
  const supabase = await supabaseDoServidor();
  const areas = eu ? await areasDaPessoa(supabase, eu.id) : [];
  if (!eu || !podeCadastrarProfessor(eu, areas)) redirect("/");
  const destino = caminhoDosProfessores(eu);
  if (destino !== CAMINHO_DOS_PROFESSORES) redirect(destino);

  return (
    <>
      <Cabecalho lideranca calendario professores />
      <ConteudoDeProfessores eu={eu} />
    </>
  );
}
