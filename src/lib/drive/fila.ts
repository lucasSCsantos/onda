import type { SupabaseClient } from "@supabase/supabase-js";
import { MAXIMO_DE_TENTATIVAS } from "@/dominio/drive";
import { tituloDeExibicao } from "@/dominio/eventos";
import { criarPastaDoEvento, renomearPastaDoEvento, type ClienteDoDrive } from "@/dominio/pastas";

type TarefaReservada = {
  tarefa_id: string;
  evento_id: string;
  operacao: "criar" | "renomear";
  /** O ID da pasta já criada; só as tarefas de renomear precisam dele. */
  pasta_id: string | null;
  categoria: string;
  inicio: string;
  titulo: string;
  numero: number | null;
  tentativas: number;
  raiz: string;
};

/** `semResposta`: o Drive respondeu, mas o banco não aceitou o resultado; a tarefa segue pendente e é refeita depois. */
export type ContagemDaFila = {
  reservadas: number;
  criadas: number;
  renomeadas: number;
  adiadas: number;
  falhas: number;
  semResposta: number;
};

/** Faz o que a tarefa pede: criar a pasta do Evento ou trocar o nome da que já existe. */
function executar(tarefa: TarefaReservada, cliente: ClienteDoDrive) {
  const titulo = tituloDeExibicao({ titulo: tarefa.titulo, numero: tarefa.numero });
  const inicio = new Date(tarefa.inicio);
  if (tarefa.operacao === "renomear" && tarefa.pasta_id) {
    return renomearPastaDoEvento({ tarefa: { pastaId: tarefa.pasta_id, inicio, titulo, tentativas: tarefa.tentativas }, cliente });
  }
  return criarPastaDoEvento({ tarefa: { categoria: tarefa.categoria, inicio, titulo, tentativas: tarefa.tentativas }, raizId: tarefa.raiz, cliente });
}

/**
 * Uma rodada do agendador: reserva as tarefas devidas, cria cada pasta no Drive e devolve o resultado ao banco (que grava
 * o link, o estado e os Logs). Recebe os dois lados de fora, o banco com a chave de serviço e o Drive, então serve igual
 * ao app e aos testes. Uma tarefa que dá erro não impede as outras. Se nem a resposta ao banco passar, a reserva vence em
 * 10 minutos e a próxima rodada tenta de novo (as pastas já criadas são reaproveitadas); depois de tentativas demais sem
 * resposta, o banco fecha a tarefa com erro.
 */
export async function processarFilaDePastas(supabase: SupabaseClient, cliente: ClienteDoDrive, limite = 10): Promise<ContagemDaFila> {
  const contagem: ContagemDaFila = { reservadas: 0, criadas: 0, renomeadas: 0, adiadas: 0, falhas: 0, semResposta: 0 };
  const { data, error } = await supabase.rpc("reservar_tarefas_de_pasta", { limite, maximo_de_tentativas: MAXIMO_DE_TENTATIVAS });
  if (error) throw new Error(`não foi possível reservar as tarefas de pasta: ${error.message}`);

  for (const tarefa of (data ?? []) as TarefaReservada[]) {
    contagem.reservadas++;
    const resultado = await executar(tarefa, cliente);

    const resposta =
      resultado.estado === "criada" || resultado.estado === "renomeada"
        ? await supabase.rpc("concluir_tarefa_de_pasta", {
            tarefa: tarefa.tarefa_id,
            pasta: resultado.estado === "criada" ? resultado.pastaId : tarefa.pasta_id,
            link: resultado.estado === "criada" ? resultado.link : null,
          })
        : await supabase.rpc("falhar_tarefa_de_pasta", {
            tarefa: tarefa.tarefa_id,
            erro: resultado.erro,
            definitiva: resultado.estado === "falhou",
            depois_de_minutos: resultado.estado === "adiada" ? resultado.depoisDeMinutos : 0,
          });
    if (resposta.error) {
      // Só a mensagem do banco: nada de credencial nos logs da hospedagem.
      console.error(`agendador de pastas: o banco não aceitou o resultado da tarefa ${tarefa.tarefa_id}: ${resposta.error.message}`);
      contagem.semResposta++;
      continue;
    }

    if (resultado.estado === "criada") contagem.criadas++;
    else if (resultado.estado === "renomeada") contagem.renomeadas++;
    else if (resultado.estado === "adiada") contagem.adiadas++;
    else contagem.falhas++;
  }
  return contagem;
}
