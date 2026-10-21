import type { Evento } from "@/dominio/eventos";
import type { Alteracao } from "@/dominio/series";

/** As colunas de `public.eventos` que a criação e a edição gravam. */
export const colunas = (evento: Evento) => ({
  titulo: evento.titulo,
  inicio: evento.inicio.toISOString(),
  fim: evento.fim?.toISOString() ?? null,
  dia_inteiro: evento.diaInteiro,
  local: evento.local,
  responsavel_id: evento.responsavel,
  status: evento.status,
  observacoes: evento.observacoes,
  link: evento.link,
  campos: evento.campos,
});

/** Uma alteração de Ocorrência como `editar_eventos` a recebe; `editada` ausente deixa a marca como está. */
export const linhaDaAlteracao = ({ id, evento, editada }: Alteracao) => ({ id, ...colunas(evento), editada });
