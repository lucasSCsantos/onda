import type { SupabaseClient } from "@supabase/supabase-js";
import { JANELA_PADRAO } from "@/dominio/cartao-de-chamada";
import { notificacoesDevidas, type EventoDoPlano, type PessoaDoPlano } from "@/dominio/notificacoes";
import { professoresDaAula } from "@/dominio/professores";
import { somarDias } from "@/dominio/fuso";

// O que está devido com o passar do tempo (lembretes, resumo semanal, Chamada pendente, Eventos sem Responsável): lê o que o
// planejador precisa, pergunta a ele o que é devido agora (src/dominio/notificacoes.ts) e grava na fila. Quem já recebeu é
// ignorado pela chave única do banco, então rodar duas vezes seguidas não envia nada em dobro. Fala com o banco pela chave de
// serviço que a rota passa; não importa `server-only` de propósito, como `processar.ts`.

type LinhaDoEvento = {
  id: string;
  titulo: string;
  numero_da_ocorrencia: number | null;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  local: string;
  status: EventoDoPlano["status"];
  responsavel_id: string | null;
  campos: Record<string, unknown>;
  categorias: { nome: string; tem_chamada: boolean; campos_das_categorias: { id: string; nome: string; tipo: string }[] } | null;
};

const PAGINA = 1000;

/** Todas as linhas de uma consulta: o Supabase devolve no máximo 1000 por chamada, e a ordem estável evita pular ou repetir linhas. */
async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>, o: string): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw falhou(o, error);
    linhas.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) return linhas;
  }
}

const falhou = (o: string, erro: { code?: string } | null) => new Error(`não foi possível ${o} (${erro?.code ?? "sem código"})`);

/** Gera as Notificações devidas em `agora` e devolve quantas nasceram agora. */
export async function gerarNotificacoes(db: SupabaseClient, agora = new Date()): Promise<number> {
  const [config, perfis, preferencias, linhas] = await Promise.all([
    db.from("configuracoes").select("janela_da_chamada_dias").maybeSingle(),
    lerTudo((de, ate) => db.from("perfis").select("id, nivel, ativo").in("nivel", ["admin", "lider", "professor"]).order("id").range(de, ate), "ler as pessoas"),
    lerTudo((de, ate) => db.from("preferencias_de_notificacao").select("pessoa_id, tipos_desligados").order("pessoa_id").range(de, ate), "ler as preferências"),
    // De oito dias atrás (a Chamada pendente) a oito dias à frente (o resumo da semana seguinte).
    lerTudo(
      (de, ate) =>
        db
          .from("eventos")
          .select(
            "id, titulo, numero_da_ocorrencia, inicio, fim, dia_inteiro, local, status, responsavel_id, campos, categorias(nome, tem_chamada, campos_das_categorias(id, nome, tipo))",
          )
          .gte("inicio", somarDias(agora, -8).toISOString())
          .lte("inicio", somarDias(agora, 8).toISOString())
          .order("id")
          .range(de, ate)
          .overrideTypes<LinhaDoEvento[], { merge: false }>(),
      "ler os Eventos",
    ),
  ]);
  if (config.error) throw falhou("ler as configurações", config.error);

  const desligados = new Map(preferencias.map((p) => [p.pessoa_id as string, p.tipos_desligados as string[]]));
  const pessoas: PessoaDoPlano[] = perfis.map((p) => ({
    id: p.id as string,
    nivel: p.nivel as string,
    ativo: p.ativo as boolean,
    tiposDesligados: desligados.get(p.id as string) ?? [],
  }));

  const professoresDe = (e: LinhaDoEvento) => professoresDaAula(e.campos, e.categorias?.campos_das_categorias ?? []);

  // Presenças só das aulas que podem estar pendentes (acabaram e têm Professor), para não ler a tabela inteira.
  const comChamada = linhas.filter((e) => e.categorias?.tem_chamada && new Date(e.inicio) <= agora && professoresDe(e).length > 0).map((e) => e.id);
  const feitas = new Set<string>();
  if (comChamada.length > 0) {
    const { data, error } = await db.from("presencas").select("evento_id").in("evento_id", comChamada);
    if (error) throw falhou("ler as Chamadas", error);
    for (const p of data ?? []) feitas.add(p.evento_id as string);
  }

  const eventos: EventoDoPlano[] = linhas.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    numero: e.numero_da_ocorrencia,
    inicio: new Date(e.inicio),
    fim: e.fim ? new Date(e.fim) : null,
    diaInteiro: e.dia_inteiro,
    local: e.local,
    categoria: e.categorias?.nome ?? "",
    status: e.status,
    responsavelId: e.responsavel_id,
    professores: professoresDe(e),
    temChamada: e.categorias?.tem_chamada ?? false,
    chamadaFeita: feitas.has(e.id),
  }));

  const devidas = notificacoesDevidas({
    agora,
    eventos,
    pessoas,
    janelaDaChamadaDias: (config.data?.janela_da_chamada_dias as number | undefined) ?? JANELA_PADRAO,
  });
  if (devidas.length === 0) return 0;

  const itens = devidas.map((d) => ({
    pessoa_id: d.pessoaId,
    tipo: d.tipo,
    evento_id: d.eventoId,
    janela: d.janela,
    valida_ate: d.validaAte.toISOString(),
    titulo: d.conteudo?.titulo ?? null,
    texto: d.conteudo?.texto ?? null,
    tag: d.conteudo?.tag ?? null,
    url: d.conteudo?.url ?? null,
  }));
  const { data, error } = await db.rpc("criar_notificacoes_agendadas", { itens });
  if (error) throw falhou("gravar as Notificações devidas", error);
  return typeof data === "number" ? data : 0;
}
