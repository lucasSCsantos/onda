import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/contas/perfil";
import { ConteudoDeProfessores } from "../../professores/conteudo";

export const metadata: Metadata = { title: "Professores" };

/** Professores dentro do Admin: o layout de `/admin` traz o cabeçalho e a barra lateral com o item ativo. */
export default async function PaginaProfessoresNoAdmin() {
  const eu = await exigirAdmin();
  return <ConteudoDeProfessores eu={eu} />;
}
