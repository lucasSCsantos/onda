"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/components/formulario";
import { VALIDADE_PADRAO_DIAS, vencimentoDoConvite } from "@/dominio/convites";
import { podeCadastrarProfessor } from "@/dominio/professores";
import { campoTexto } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { areasDaPessoa } from "@/lib/eventos/consultas";
import { supabaseDoServidor } from "@/lib/supabase/servidor";

/** Quem cadastra Professores (podeCadastrarProfessor), com as Áreas das Funções dele. As políticas de `convites` conferem a mesma regra. */
async function quemCadastra() {
  const supabase = await supabaseDoServidor();
  const eu = await perfilAtual();
  const pode = eu !== null && podeCadastrarProfessor(eu, await areasDaPessoa(supabase, eu.id));
  return { supabase, pode };
}

/** Gera o convite de um Professor: nível Professor, sem Função, de uso único. */
export async function gerarConviteDeProfessor(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  let expiraEm: Date;
  try {
    expiraEm = vencimentoDoConvite(new Date(), Number(campoTexto(dados, "validade") || VALIDADE_PADRAO_DIAS));
  } catch (erro) {
    return { erro: (erro as Error).message };
  }

  const { supabase, pode } = await quemCadastra();
  if (!pode) return { erro: "Só o Admin e quem tem Função em Ensino cadastram Professores." };
  const { error } = await supabase.from("convites").insert({ nivel: "professor", expira_em: expiraEm.toISOString() });
  if (error) return { erro: "Não foi possível gerar o convite." };

  revalidatePath("/professores");
  return { aviso: "Convite gerado. Copie o link na lista abaixo e envie para o Professor." };
}

export async function revogarConviteDeProfessor(id: string) {
  const { supabase, pode } = await quemCadastra();
  if (!pode) return;
  await supabase.from("convites").update({ revogado_em: new Date().toISOString() }).eq("id", id).eq("nivel", "professor").is("usado_em", null);
  revalidatePath("/professores");
}

/** Só o Admin inativa e reativa um Professor (podeInativarProfessor); a política de `perfis` confere. */
export async function mudarAtivoDoProfessor(pessoa: string, ativo: boolean) {
  const supabase = await supabaseDoServidor();
  await supabase.from("perfis").update({ ativo }).eq("id", pessoa).eq("nivel", "professor");
  revalidatePath("/professores");
}
