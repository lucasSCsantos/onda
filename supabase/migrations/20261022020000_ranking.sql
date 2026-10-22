-- Ranking anual dos Adolescentes (ticket 03 de .scratch/logs-presenca-ranking). Ver ADR 0005.
-- O ranking não é guardado: `pontos_do_ano` soma, na hora, as Marcações das presenças do ano com os pontos ATUAIS de
-- cada Marcação. Por isso mudar a pontuação vale também para o passado, e os anos anteriores continuam consultáveis.
-- A classificação e o desempate ficam em src/dominio/ranking.ts. Só acréscimos.

-- O desempate: quem tem mais desta Marcação fica na frente. Sem uma, o empate divide a posição. Padrão: Presente.
alter table public.configuracoes
  add column desempate_por uuid references public.marcacoes (id) on delete set null;
update public.configuracoes set desempate_por = (select m.id from public.marcacoes m where m.conta_presenca limit 1);
grant update (desempate_por) on public.configuracoes to authenticated;

/**
 * Os pontos de cada Adolescente num ano (no fuso do Mural), Marcação por Marcação: quantas vezes foi marcada e quanto
 * soma com os pontos atuais dela. Aulas Canceladas não contam. Segue as políticas de quem chama: só a Liderança lê.
 */
create function public.pontos_do_ano(ano integer)
returns table (adolescente_id uuid, nome text, ativo boolean, marcacao_id uuid, quantas integer, pontos integer)
language sql
stable
set search_path = ''
as $$
  select a.id, a.nome, a.ativo, m.id, count(*)::integer, (count(*) * m.pontos)::integer
  from public.presencas p
  join public.eventos e on e.id = p.evento_id
  join public.adolescentes a on a.id = p.adolescente_id
  join public.marcacoes_das_presencas mp on mp.presenca_id = p.id
  join public.marcacoes m on m.id = mp.marcacao_id
  where e.status <> 'cancelado'
    and extract(year from e.inicio at time zone 'America/Bahia') = pontos_do_ano.ano
  group by a.id, a.nome, a.ativo, m.id, m.pontos;
$$;

/** Os anos que têm alguma presença, do mais recente ao mais antigo, para o seletor de ano. */
create function public.anos_com_presenca()
returns setof integer
language sql
stable
set search_path = ''
as $$
  select distinct extract(year from e.inicio at time zone 'America/Bahia')::integer
  from public.presencas p
  join public.eventos e on e.id = p.evento_id
  order by 1 desc;
$$;

revoke execute on function public.pontos_do_ano, public.anos_com_presenca from public, anon;
grant execute on function public.pontos_do_ano, public.anos_com_presenca to authenticated;

-- Logs -------------------------------------------------------------------------------

create or replace function public.acao_da_configuracao(chave text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case chave
    when 'retencao_dos_logs_meses' then 'logs.retencao_alterada'
    when 'desempate_por' then 'ranking.desempate_alterado'
    else 'configuracao.alterada'
  end;
$$;

/** A mesma de 20261022000000_logs.sql, com a Marcação do desempate pelo nome, e não pelo id. */
create or replace function public.log_das_configuracoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := to_jsonb(old);
  depois jsonb := to_jsonb(new);
  chave text;
  valor_antes jsonb;
  valor_depois jsonb;
begin
  for chave in
    select k from jsonb_object_keys(depois) k
    where k not in ('id', 'logs_desde', 'editado_por', 'editado_em') and (antes -> k) is distinct from (depois -> k)
    order by k
  loop
    valor_antes := antes -> chave;
    valor_depois := depois -> chave;
    if chave = 'desempate_por' then
      valor_antes := (select to_jsonb(m.nome) from public.marcacoes m where m.id::text = antes ->> chave);
      valor_depois := (select to_jsonb(m.nome) from public.marcacoes m where m.id::text = depois ->> chave);
    end if;
    perform public.gravar_log(
      public.acao_da_configuracao(chave), 'configuracao', chave, null,
      jsonb_build_object('chave', chave, 'antes', coalesce(valor_antes, 'null'), 'depois', coalesce(valor_depois, 'null'))
    );
  end loop;
  return null;
end;
$$;

-- Reverter --------------------------------------------------------------------------
-- Nada a desfazer nos dados: o ranking não é guardado.
--
-- drop function public.pontos_do_ano, public.anos_com_presenca;
-- alter table public.configuracoes drop column desempate_por;
-- (e recriar `acao_da_configuracao` e `log_das_configuracoes` como em 20261022000000_logs.sql)
