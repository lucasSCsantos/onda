import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import type { NivelDeAcesso, Pessoa } from "@/dominio/acesso";

/** Lê URL e chaves do Supabase local (`supabase start` precisa estar rodando). */
function ambienteLocal() {
  const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
  const valor = (nome: string) => {
    const linha = saida.split(/\r?\n/).find((l) => l.startsWith(`${nome}=`));
    if (!linha) throw new Error(`Supabase local sem ${nome}. Rode \`pnpm exec supabase start\`.`);
    return linha.slice(nome.length + 1).replace(/^"|"$/g, "");
  };
  return { url: valor("API_URL"), anon: valor("ANON_KEY"), servico: valor("SERVICE_ROLE_KEY") };
}

const ambiente = ambienteLocal();
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(ambiente.url, ambiente.servico, semSessao);

export function anonimo(): SupabaseClient {
  return createClient(ambiente.url, ambiente.anon, semSessao);
}

export const SENHA = "senha-de-teste-123";
export const emailNovo = () => `${crypto.randomUUID()}@teste.onda`;

/** Cria uma conta nova no nível pedido e devolve um cliente já autenticado como ela. */
export async function contaNova(nome: string, nivel: NivelDeAcesso = "pendente") {
  const email = emailNovo();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) throw error;

  if (nivel !== "pendente") {
    const promocao = await admin.from("perfis").update({ nivel }).eq("id", data.user.id);
    if (promocao.error) throw promocao.error;
  }

  const cliente = anonimo();
  const login = await cliente.auth.signInWithPassword({ email, password: SENHA });
  if (login.error) throw login.error;
  return { id: data.user.id, email, cliente };
}

/** Cadastro pelo app, como faria quem abre a tela de cadastro (com ou sem convite). */
export async function cadastrar(nome: string, convite?: string, genero?: string) {
  const cliente = anonimo();
  const email = emailNovo();
  const { data, error } = await cliente.auth.signUp({
    email,
    password: SENHA,
    options: { data: { nome, data_nascimento: "2000-05-10", ...(genero ? { genero } : {}), ...(convite ? { convite } : {}) } },
  });
  return { cliente, email, id: data.user?.id, error };
}

/** Id de uma Função pelo nome. */
export async function funcao(nome: string): Promise<string> {
  const { data, error } = await admin.from("funcoes").select("id").eq("nome", nome).single();
  if (error) throw error;
  return data.id;
}

/** Conta nova no nível pedido, já com as Funções dadas (pelo nome). */
export async function comFuncoes(nome: string, nivel: NivelDeAcesso, funcoes: string[], ativo = true) {
  const conta = await contaNova(nome, nivel);
  for (const f of funcoes) {
    await admin.from("funcoes_das_pessoas").insert({ pessoa_id: conta.id, funcao_id: await funcao(f) }).throwOnError();
  }
  if (!ativo) await admin.from("perfis").update({ ativo: false }).eq("id", conta.id).throwOnError();
  return { ...conta, pessoa: { id: conta.id, nivel, ativo } satisfies Pessoa, funcoes };
}

export type Cliente = Awaited<ReturnType<typeof contaNova>>["cliente"];

/** Id, Área e campos (pelo nome) de uma Categoria. */
export async function categoria(nome: string) {
  const { data } = await admin
    .from("categorias")
    .select("id, areas(nome), campos_das_categorias(id, nome)")
    .eq("nome", nome)
    .single()
    .overrideTypes<{ id: string; areas: { nome: string }; campos_das_categorias: { id: string; nome: string }[] }, { merge: false }>()
    .throwOnError();
  const campo = (nomeDoCampo: string) => data.campos_das_categorias.find((c) => c.nome === nomeDoCampo)!.id;
  return { id: data.id, area: data.areas.nome, campo };
}

/** Um Evento simples, das 19h às 21h de 24/10/2026 em Salvador, com o Responsável dado. */
export const eventoDe = (categoriaId: string, responsavel: string | null, mudancas: Record<string, unknown> = {}) => ({
  titulo: "Evento de teste",
  categoria_id: categoriaId,
  inicio: "2026-10-24T22:00:00Z",
  fim: "2026-10-25T00:00:00Z",
  dia_inteiro: false,
  local: "Templo",
  responsavel_id: responsavel,
  status: "planejado",
  observacoes: "",
  link: null,
  campos: {},
  ...mudancas,
});

export async function criar(cliente: Cliente, evento: ReturnType<typeof eventoDe>) {
  return cliente.from("eventos").insert(evento).select("id, criado_por, criado_em").single();
}
