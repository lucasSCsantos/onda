"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/components/formulario";
import { eChecklist, lerMudancaDoChecklist, mudarChecklist } from "@/dominio/checklist";
import { podeCriarEvento } from "@/dominio/catalogo";
import { camposChecklist, lerEdicao, lerEvento, podeEditarEvento, type CategoriaDoEvento, type EntradaDeEvento, type Evento } from "@/dominio/eventos";
import { editarSerie, escoposDeEdicao, lerSerie, type EntradaDeRegra, type EscopoDeEdicao } from "@/dominio/series";
import { podeEditarSoAsObservacoes } from "@/dominio/professores";
import { campoTexto, nomeDoCampoEspecifico } from "@/lib/campos";
import { perfilAtual } from "@/lib/contas/perfil";
import { registrarFalha } from "@/lib/logs/registrar";
import { supabaseDoServidor } from "@/lib/supabase/servidor";
import { colunas, linhaDaAlteracao } from "./colunas";
import { areasDaPessoa, categoria as buscarCategoria, evento as buscarEvento, opcoesDaLideranca, opcoesDeProfessores, serie as buscarSerie } from "./consultas";

/** Em caso de erro, devolve o que foi digitado para o formulário não perder nada. */
export type EstadoDoEvento = EstadoFormulario & { valores?: Record<string, string>; tentativa?: number };

const SEM_PERMISSAO = "42501";
const REFERENCIADO = "23503";
/** Uma edição que a política por linha barrou não dá erro: só não altera nada. Para o log, é falta de permissão. */
const SEM_LINHA = { code: SEM_PERMISSAO, message: "nenhuma linha alterada" };

const valoresDigitados = (dados: FormData) =>
  Object.fromEntries([...dados.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

function entradaDoFormulario(dados: FormData, categoria: CategoriaDoEvento): EntradaDeEvento {
  return {
    titulo: campoTexto(dados, "titulo"),
    data: campoTexto(dados, "data"),
    hora: campoTexto(dados, "hora"),
    dataFim: campoTexto(dados, "data_fim"),
    horaFim: campoTexto(dados, "hora_fim"),
    local: campoTexto(dados, "local"),
    responsavel: campoTexto(dados, "responsavel"),
    status: campoTexto(dados, "status"),
    observacoes: campoTexto(dados, "observacoes"),
    link: campoTexto(dados, "link"),
    campos: Object.fromEntries(categoria.campos.map((c) => [c.id, campoTexto(dados, nomeDoCampoEspecifico(c.id))])),
  };
}

function entradaDaRegra(dados: FormData): EntradaDeRegra {
  return {
    frequencia: campoTexto(dados, "repeticao"),
    dias: [],
    terminoPor: campoTexto(dados, "termino_por"),
    terminoData: campoTexto(dados, "termino_data"),
    terminoOcorrencias: campoTexto(dados, "termino_ocorrencias"),
  };
}

/** Só o Evento: o que o módulo de domínio compara, sem o que a consulta acrescenta. */
const soOEvento = (e: Evento): Evento => ({
  titulo: e.titulo,
  inicio: e.inicio,
  fim: e.fim,
  diaInteiro: e.diaInteiro,
  local: e.local,
  responsavel: e.responsavel,
  status: e.status,
  observacoes: e.observacoes,
  link: e.link,
  campos: e.campos,
});

export async function criarEvento(categoriaId: string, anterior: EstadoDoEvento, dados: FormData): Promise<EstadoDoEvento> {
  const valores = valoresDigitados(dados);
  const falhou = (erro: string): EstadoDoEvento => ({ erro, valores, tentativa: (anterior.tentativa ?? 0) + 1 });

  const supabase = await supabaseDoServidor();
  const [categoria, lideranca, professores] = await Promise.all([
    buscarCategoria(supabase, categoriaId),
    opcoesDaLideranca(supabase),
    opcoesDeProfessores(supabase),
  ]);
  if (!categoria) return falhou("Categoria não encontrada.");

  const lido = lerEvento(
    entradaDoFormulario(dados, categoria),
    categoria,
    lideranca.map((p) => p.valor),
    professores.map((p) => p.valor),
  );
  if ("erro" in lido) return falhou(lido.erro);

  // Com repetição, o Evento do formulário é o modelo de uma Série, criada com todas as Ocorrências de uma vez.
  const emSerie = Boolean(campoTexto(dados, "repeticao"));
  const { error } = emSerie
    ? await criarSerie(supabase, categoria.id, lido.evento, dados)
    : await supabase.from("eventos").insert({ ...colunas(lido.evento), categoria_id: categoria.id });
  if (error && "erro" in error) return falhou(error.erro);
  if (error) registrarFalha(supabase, emSerie ? "serie.criada" : "evento.criado", { tipo: emSerie ? "serie" : "evento", rotulo: lido.evento.titulo }, error);
  if (error?.code === SEM_PERMISSAO) return falhou("Você não tem Função na Área desta Categoria.");
  if (error) return falhou("Não foi possível criar o Evento.");

  revalidatePath("/");
  redirect("/");
}

type Supabase = Awaited<ReturnType<typeof supabaseDoServidor>>;

async function criarSerie(supabase: Supabase, categoria: string, modelo: Evento, dados: FormData) {
  const serie = lerSerie(modelo, entradaDaRegra(dados));
  if ("erro" in serie) return { error: serie };
  return supabase.rpc("criar_serie", {
    categoria,
    regra: serie.regra,
    primeiro_dia: serie.primeiroDia,
    ocorrencias: serie.ocorrencias.map(colunas),
  });
}

export async function editarEvento(id: string, anterior: EstadoDoEvento, dados: FormData): Promise<EstadoDoEvento> {
  const valores = valoresDigitados(dados);
  const falhou = (erro: string): EstadoDoEvento => ({ erro, valores, tentativa: (anterior.tentativa ?? 0) + 1 });

  const supabase = await supabaseDoServidor();
  const eu = await perfilAtual();
  if (!eu) return falhou("Entre de novo para editar.");
  const [gravado, areas, lideranca, professores] = await Promise.all([
    buscarEvento(supabase, id),
    areasDaPessoa(supabase, eu.id),
    opcoesDaLideranca(supabase),
    opcoesDeProfessores(supabase),
  ]);
  if (!gravado) return falhou("Evento não encontrado.");
  if (!podeEditarEvento(eu, areas, gravado)) return falhou("Você não pode editar este Evento.");

  const lido = lerEdicao(
    entradaDoFormulario(dados, gravado.categoria),
    gravado.categoria,
    lideranca.map((p) => p.valor),
    { anterior: gravado, quem: eu, agora: new Date() },
    professores.map((p) => p.valor),
  );
  if ("erro" in lido) return falhou(lido.erro);

  if (gravado.serieId) {
    // Uma Ocorrência: o escopo diz quais outras da Série levam a mudança. Só quem edita a Categoria escolhe além de "só esta".
    const escopos = escoposDeEdicao(podeCriarEvento(eu, areas, gravado.categoria));
    const escopo = escopos.find((e: EscopoDeEdicao) => e === campoTexto(dados, "escopo")) ?? "esta";
    const serie = await buscarSerie(supabase, gravado.serieId);
    if (!serie) return falhou("Série não encontrada.");

    const edicao = editarSerie({
      ocorrencias: serie.ocorrencias,
      alvo: id,
      escopo,
      anterior: soOEvento(gravado),
      novo: lido.evento,
      quem: eu,
      agora: new Date(),
    });
    if ("erro" in edicao) return falhou(edicao.erro);

    // `editar_serie` grava como `editar_eventos` e registra a operação num log só, com o escopo.
    const { error } = await supabase.rpc("editar_serie", {
      serie: gravado.serieId,
      escopo,
      alteracoes: edicao.alteracoes.map(linhaDaAlteracao),
    });
    if (error) registrarFalha(supabase, "serie.editada", { tipo: "serie", id: gravado.serieId, rotulo: gravado.titulo }, error);
    if (error?.code === SEM_PERMISSAO) return falhou("Você não pode alterar todas essas Ocorrências.");
    if (error) return falhou("Não foi possível salvar o Evento.");
  } else {
    const { data, error } = await supabase.from("eventos").update(colunas(lido.evento)).eq("id", id).select("id");
    if (error || data?.length === 0) registrarFalha(supabase, "evento.editado", { tipo: "evento", id, rotulo: gravado.titulo }, error ?? SEM_LINHA);
    if (error?.code === SEM_PERMISSAO || data?.length === 0) return falhou("Você não pode fazer esta alteração.");
    if (error) return falhou("Não foi possível salvar o Evento.");
  }

  revalidatePath("/", "layout");
  redirect(`/eventos/${id}`);
}

/**
 * O Professor e o Auxiliar de uma aula editam só as observações dela (`podeEditarSoAsObservacoes`); o banco confere,
 * recusando qualquer outra coluna, e a política de edição, qualquer aula que não seja deles.
 */
export async function editarObservacoes(id: string, _anterior: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const eu = await perfilAtual();
  if (!eu) return { erro: "Entre de novo para editar." };
  const gravado = await buscarEvento(supabase, id);
  if (!gravado) return { erro: "Evento não encontrado." };
  if (!podeEditarSoAsObservacoes(eu, { campos: gravado.campos, definicoes: gravado.categoria.campos })) {
    return { erro: "Você não pode editar as observações desta aula." };
  }

  const { data, error } = await supabase.from("eventos").update({ observacoes: campoTexto(dados, "observacoes") }).eq("id", id).select("id");
  if (error || data?.length === 0) registrarFalha(supabase, "evento.editado", { tipo: "evento", id, rotulo: gravado.titulo }, error ?? SEM_LINHA);
  if (error?.code === SEM_PERMISSAO || data?.length === 0) return { erro: "Você não pode fazer esta alteração." };
  if (error) return { erro: "Não foi possível salvar as observações." };

  revalidatePath("/", "layout");
  return { aviso: "Observações salvas." };
}

/** Só o Admin exclui (podeExcluirEvento); a política de exclusão confere. */
export async function excluirEvento(id: string): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const { data, error } = await supabase.from("eventos").delete().eq("id", id).select("id");
  if (error || data.length === 0) {
    registrarFalha(supabase, "evento.excluido", { tipo: "evento", id }, error ?? SEM_LINHA);
    // A presença da aula prende o Evento (o ranking perderia pontos).
    if (error?.code === REFERENCIADO) return { erro: "Esta aula já tem chamada. Em vez de excluir, mude o Status para Cancelado." };
    return { erro: "Não foi possível excluir o Evento." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/** Marca, desmarca, adiciona ou remove uma tarefa do checklist; só quem edita o Evento (`podeEditarEvento`), e a política de edição confere. */
export async function mudarChecklistDoEvento(
  eventoId: string,
  campoId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const supabase = await supabaseDoServidor();
  const eu = await perfilAtual();
  if (!eu) return { erro: "Entre de novo para mexer no checklist." };
  const [gravado, areas] = await Promise.all([buscarEvento(supabase, eventoId), areasDaPessoa(supabase, eu.id)]);
  if (!gravado) return { erro: "Evento não encontrado." };
  if (!podeEditarEvento(eu, areas, gravado)) return { erro: "Você não pode editar este Evento." };
  if (!camposChecklist(gravado.categoria).some((c) => c.id === campoId)) return { erro: "Checklist não encontrado." };

  const atual = gravado.campos[campoId];
  const mudanca = lerMudancaDoChecklist(campoTexto(dados, "mudanca"), campoTexto(dados, "texto"));
  const itens = mudarChecklist(Array.isArray(atual) && eChecklist(atual) ? atual : [], mudanca);
  if ("erro" in itens) return { erro: itens.erro };

  // Um checklist vazio sai do Evento, como os demais campos opcionais vazios.
  const campos = { ...gravado.campos };
  if (itens.itens.length > 0) campos[campoId] = itens.itens;
  else delete campos[campoId];

  const { data, error } = await supabase.from("eventos").update({ campos }).eq("id", eventoId).select("id");
  if (error || data?.length === 0) registrarFalha(supabase, "evento.editado", { tipo: "evento", id: eventoId, rotulo: gravado.titulo }, error ?? SEM_LINHA);
  if (error?.code === SEM_PERMISSAO || data?.length === 0) return { erro: "Você não pode fazer esta alteração." };
  if (error) return { erro: "Não foi possível salvar o checklist." };

  revalidatePath(`/eventos/${eventoId}`);
  return {};
}
