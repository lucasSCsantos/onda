import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { caminhoDentro, enderecoDeArquivos, lerIdDoAtalho, type IconeDeAtalho } from "@/dominio/arquivos";
import { clienteDeArquivos } from "@/lib/drive/servidor";

export type AtalhoDeArquivos = { id: string; nome: string; icone: IconeDeAtalho; pastaId: string };

type Linha = { id: string; nome: string; icone: IconeDeAtalho; pasta_id: string };

const daLinha = (l: Linha): AtalhoDeArquivos => ({ id: l.id, nome: l.nome, icone: l.icone, pastaId: l.pasta_id });

/** Os atalhos que quem está logado pode ver (a política do banco filtra por Função), na ordem do Admin. */
export async function atalhosVisiveis(supabase: SupabaseClient): Promise<AtalhoDeArquivos[]> {
  const { data } = await supabase
    .from("atalhos_de_arquivos")
    .select("id, nome, icone, pasta_id")
    .order("ordem")
    .order("criado_em")
    .overrideTypes<Linha[], { merge: false }>();
  return (data ?? []).map(daLinha);
}

/** Um atalho só se a pessoa pode vê-lo; nulo se não existe ou não é dela (o banco não diz qual dos dois). */
export async function atalhoVisivel(supabase: SupabaseClient, id: string): Promise<AtalhoDeArquivos | null> {
  if (!lerIdDoAtalho(id)) return null;
  const { data } = await supabase
    .from("atalhos_de_arquivos")
    .select("id, nome, icone, pasta_id")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Linha, { merge: false }>();
  return data ? daLinha(data) : null;
}

/** Os atalhos com as Funções que os veem, para a administração (só o Admin lê as ligações). */
export async function atalhosDoAdmin(supabase: SupabaseClient): Promise<(AtalhoDeArquivos & { funcoes: string[] })[]> {
  const [atalhos, ligacoes] = await Promise.all([
    atalhosVisiveis(supabase),
    supabase.from("funcoes_dos_atalhos").select("atalho_id, funcao_id"),
  ]);
  const ligadas = (ligacoes.data ?? []) as { atalho_id: string; funcao_id: string }[];
  return atalhos.map((a) => ({ ...a, funcoes: ligadas.filter((l) => l.atalho_id === a.id).map((l) => l.funcao_id) }));
}

/** As Funções, para marcar quem vê cada atalho. */
export async function funcoesParaMarcar(supabase: SupabaseClient): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabase.from("funcoes").select("id, nome").order("nome");
  return (data ?? []) as { id: string; nome: string }[];
}

/**
 * O endereço de Arquivos na pasta de um Evento, se ela está mesmo dentro da raiz; nulo se o Drive está desligado, a pasta
 * ficou fora da raiz ou o Drive não respondeu (o link do Evento segue sem o atalho, sem quebrar a tela).
 */
export async function arquivosDaPastaDoEvento(pastaId: string | null, raizId: string | null): Promise<string | null> {
  const cliente = clienteDeArquivos();
  if (!pastaId || !raizId || !cliente) return null;
  try {
    return (await caminhoDentro({ limiteId: raizId, itemId: pastaId, cliente })) === null ? null : enderecoDeArquivos({ pasta: pastaId });
  } catch {
    return null;
  }
}
