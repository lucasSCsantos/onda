-- Séries semanais com número (ticket 03 de "campos por Categoria, Drive, semana, calendário e avisos").
-- A Série repete no máximo toda semana, por até 6 meses a partir do primeiro dia (teto de segurança: 52 Ocorrências),
-- e cada Ocorrência leva um número na ordem das datas. As regras espelham src/dominio/series.ts.
-- Só adições: uma coluna opcional, vazia nos Eventos avulsos e nos existentes; não há Séries em produção.
--
-- Para reverter: restaurar `criar_serie` de 20261021060000_series.sql, e então
--   alter table public.series drop constraint series_regra_semanal;
--   alter table public.eventos drop column numero_da_ocorrencia;

alter table public.eventos
  add column numero_da_ocorrencia integer check (numero_da_ocorrencia > 0),
  add constraint eventos_numero_so_em_serie check (numero_da_ocorrencia is null or serie_id is not null);

-- Só `criar_serie` numera; nenhuma edição reescreve o número, então cancelar não renumera.
grant insert (numero_da_ocorrencia) on public.eventos to authenticated;

-- A regra guardada é semanal, com no máximo um dia da semana por semana. `not valid`: vale para as Séries novas e
-- não recusa a migração se houver alguma antiga fora da regra.
alter table public.series
  add constraint series_regra_semanal check (
    regra ->> 'frequencia' = 'semanal'
    and (regra -> 'dias' is null or (jsonb_typeof(regra -> 'dias') = 'array' and jsonb_array_length(regra -> 'dias') <= 1))
  ) not valid;

/**
 * Cria a Série e todas as Ocorrências de uma vez, com as permissões de quem chama, e devolve o id da Série.
 * Novidades: recusa mais de 52 Ocorrências ou Ocorrência além de 6 meses depois do primeiro dia, e numera as
 * Ocorrências na ordem das datas (o número que vier no JSON é ignorado).
 */
create or replace function public.criar_serie(categoria uuid, regra jsonb, primeiro_dia date, ocorrencias jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  nova uuid;
  quantas integer;
  ultima timestamptz;
begin
  select count(*), max(o.inicio) into quantas, ultima
  from jsonb_to_recordset(ocorrencias) as o(inicio timestamptz);

  if quantas > 52 or (ultima at time zone 'America/Bahia')::date > (primeiro_dia + interval '6 months')::date then
    raise exception 'A Série repete no máximo toda semana, por até 6 meses.' using errcode = 'P0001';
  end if;

  insert into public.series (categoria_id, regra, primeiro_dia)
  values (categoria, regra, primeiro_dia)
  returning id into nova;

  insert into public.eventos (titulo, categoria_id, serie_id, numero_da_ocorrencia, inicio, fim, dia_inteiro, "local", responsavel_id, status, observacoes, link, campos)
  select o.titulo, categoria, nova, row_number() over (order by o.inicio), o.inicio, o.fim, coalesce(o.dia_inteiro, false), coalesce(o."local", ''), o.responsavel_id,
    o.status, coalesce(o.observacoes, ''), o.link, coalesce(o.campos, '{}')
  from jsonb_to_recordset(ocorrencias) as o(
    titulo text, inicio timestamptz, fim timestamptz, dia_inteiro boolean, "local" text, responsavel_id uuid,
    status public.status_do_evento, observacoes text, link text, campos jsonb
  )
  order by o.inicio;

  return nova;
end;
$$;
