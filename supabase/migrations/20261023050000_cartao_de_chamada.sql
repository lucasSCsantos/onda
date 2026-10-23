-- Cartão de Chamada (ticket 10 de .scratch/drive-agenda-avisos): a tela principal lembra o Professor e o Auxiliar de
-- fazer a Chamada. O estado do cartão é calculado em src/dominio/cartao-de-chamada.ts; o banco guarda a janela e diz
-- quais Chamadas já foram feitas. Só acréscimos.

-- Quantos dias depois do dia da aula o cartão continua à vista (1 = até o fim do dia seguinte). A mudança vira log
-- pelo gatilho que já olha toda coluna de `configuracoes` (`log_das_configuracoes`).
alter table public.configuracoes
  add column janela_da_chamada_dias integer not null default 1 check (janela_da_chamada_dias between 0 and 7);
grant update (janela_da_chamada_dias) on public.configuracoes to authenticated;

/**
 * A janela do cartão, para qualquer pessoa aprovada: o Professor não lê `configuracoes`, que é da Liderança, e só
 * precisa deste número.
 */
create function public.janela_da_chamada_dias()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select c.janela_da_chamada_dias from public.configuracoes c where public.meu_nivel() in ('admin', 'lider', 'professor');
$$;

/**
 * Das aulas dadas, as que já têm Chamada feita (ao menos uma presença). Só responde sobre as aulas cuja Chamada a
 * pessoa pode fazer (`pode_fazer_chamada`): o Professor sabe que a dele foi feita, sem ler presenças nem Adolescentes.
 */
create function public.chamadas_feitas(eventos uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from unnest(chamadas_feitas.eventos) as e (id)
  where public.pode_fazer_chamada(e.id)
    and exists (select 1 from public.presencas p where p.evento_id = e.id);
$$;

revoke execute on function public.janela_da_chamada_dias, public.chamadas_feitas from public, anon;
grant execute on function public.janela_da_chamada_dias, public.chamadas_feitas to authenticated;

-- Reverter --------------------------------------------------------------------------
-- Nada some dos dados além da janela.
--
-- drop function public.chamadas_feitas, public.janela_da_chamada_dias;
-- alter table public.configuracoes drop column janela_da_chamada_dias;
