-- Editar Evento, Status e registro de alterações (ticket 05).
-- As regras espelham src/dominio/eventos.ts (podeEditarEvento, podeExcluirEvento, podeMarcarRealizado,
-- statusNoMomento e lerEdicao).

alter table public.eventos
  add column editado_por uuid references public.perfis (id),
  add column editado_em timestamptz;

/** Quando o Evento termina: no horário de fim; sem fim, ou de dia inteiro, à meia-noite seguinte ao último dia. Mesma regra de fimDoEvento. */
create function public.fim_do_evento(inicio timestamptz, fim timestamptz, dia_inteiro boolean)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when fim is not null and not dia_inteiro then fim
    else ((coalesce(fim, inicio) at time zone 'America/Bahia')::date + 1)::timestamp at time zone 'America/Bahia'
  end;
$$;

/** O Status num momento: um Confirmado que terminou já é Realizado. Mesma regra de statusNoMomento. */
create function public.status_no_momento(status public.status_do_evento, inicio timestamptz, fim timestamptz, dia_inteiro boolean)
returns public.status_do_evento
language sql
stable
set search_path = ''
as $$
  select case
    when status = 'confirmado' and now() >= public.fim_do_evento(inicio, fim, dia_inteiro) then 'realizado'
    else status
  end::public.status_do_evento;
$$;

/** Quem está logado pode marcar o Evento como Realizado? O Admin e o Responsável, depois do fim. Mesma regra de podeMarcarRealizado. */
create function public.pode_marcar_realizado(responsavel uuid, inicio timestamptz, fim timestamptz, dia_inteiro boolean)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (public.e_admin() or (public.e_lideranca() and coalesce(responsavel = (select auth.uid()), false)))
    and now() >= public.fim_do_evento(inicio, fim, dia_inteiro);
$$;

/** Quem está logado pode editar e mudar o Status deste Evento? Mesma regra de podeEditarEvento. */
create function public.pode_editar_evento(categoria uuid, responsavel uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.pode_criar_evento(categoria)
    or (public.e_lideranca() and coalesce(responsavel = (select auth.uid()), false));
$$;

revoke execute on function public.status_no_momento, public.pode_marcar_realizado, public.pode_editar_evento
  from public, anon;
grant execute on function public.status_no_momento, public.pode_marcar_realizado, public.pode_editar_evento
  to authenticated;

/**
 * O que as restrições da tabela não conseguem conferir, ao criar e ao editar. Mesma regra de lerEvento e lerEdicao:
 * - um Evento novo não nasce Realizado, e nenhum fica Realizado antes do fim; o Realizado manual é do Admin e do
 *   Responsável (o que estava gravado); um Confirmado que terminou já é Realizado (`status_no_momento`), mesmo
 *   antes de `realizar_confirmados` gravar a mudança; sem sessão, é o próprio Mural;
 * - remarcar um Adiado (mudar início ou fim) o volta a Planejado;
 * - o Responsável é da Liderança ativa, e um já gravado pode ficar mesmo desativado;
 * - os campos específicos são da Categoria, com os obrigatórios preenchidos e cada valor no formato do tipo.
 *   Numa edição, só o que mudou é conferido: um campo que saiu da Categoria, ou uma pessoa desativada, pode ficar.
 * Numa edição feita por alguém, guarda quem editou por último e quando.
 */
create function public.conferir_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  editando boolean := tg_op = 'UPDATE';
  eu uuid := (select auth.uid());
  campo public.campos_das_categorias;
  valor jsonb;
begin
  if not editando and new.status = 'realizado' then
    raise exception 'um Evento novo não nasce Realizado' using errcode = 'P0001';
  end if;

  if editando then
    if old.status = 'adiado' and new.status = 'adiado'
      and (new.inicio, new.fim, new.dia_inteiro) is distinct from (old.inicio, old.fim, old.dia_inteiro) then
      new.status := 'planejado';
    end if;

    if new.status = 'realizado'
      and public.status_no_momento(old.status, old.inicio, old.fim, old.dia_inteiro) <> 'realizado'
      and eu is not null
      and not public.pode_marcar_realizado(old.responsavel_id, new.inicio, new.fim, new.dia_inteiro) then
      raise exception 'só o Admin e o Responsável marcam Realizado, e só depois do fim' using errcode = '42501';
    end if;

    if new.status = 'realizado' and now() < public.fim_do_evento(new.inicio, new.fim, new.dia_inteiro) then
      raise exception 'um Evento só fica Realizado depois do fim' using errcode = 'P0001';
    end if;

    if eu is not null then
      new.editado_por := eu;
      new.editado_em := now();
    end if;
  end if;

  if new.responsavel_id is not null
    and (not editando or new.responsavel_id is distinct from old.responsavel_id)
    and not exists (
      select 1 from public.perfis p where p.id = new.responsavel_id and p.ativo and p.nivel in ('admin', 'lider')
    ) then
    raise exception 'o Responsável precisa ser da Liderança' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(new.campos) chave
    where not (editando and old.campos ? chave)
      and not exists (
        select 1 from public.campos_das_categorias c where c.categoria_id = new.categoria_id and c.id::text = chave
      )
  ) then
    raise exception 'campo que não é da Categoria' using errcode = 'P0001';
  end if;

  for campo in select * from public.campos_das_categorias c where c.categoria_id = new.categoria_id and c.tipo <> 'checklist' loop
    valor := new.campos -> campo.id::text;
    continue when editando and valor is not distinct from old.campos -> campo.id::text;
    if valor is null or valor = 'null' or valor = '[]' or (jsonb_typeof(valor) = 'string' and btrim(valor #>> '{}') = '') then
      if campo.obrigatorio then
        raise exception 'preencha “%”', campo.nome using errcode = 'P0001';
      end if;
    elsif not public.campo_valido(campo.tipo, campo.opcoes, valor) then
      raise exception '“%” fora do formato do tipo', campo.nome using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger ao_criar_evento on public.eventos;
drop function public.conferir_evento_novo();

create trigger ao_gravar_evento
  before insert or update on public.eventos
  for each row execute function public.conferir_evento();

-- Mesma regra de podeEditarEvento. A Categoria não muda (fora das colunas editáveis), então a checagem da
-- linha nova só exige a Liderança: o Responsável pode passar o Evento a outra pessoa.
create policy "o Admin, quem tem Função na Área e o Responsável editam Eventos" on public.eventos for update to authenticated
  using (public.pode_editar_evento(categoria_id, responsavel_id))
  with check ((select public.e_lideranca()));

-- Mesma regra de podeExcluirEvento; os demais usam Cancelado.
create policy "só o Admin exclui Eventos" on public.eventos for delete to authenticated
  using ((select public.e_admin()));

grant update (titulo, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos), delete
  on public.eventos to authenticated;

-- Realizado automático ------------------------------------------------------

/** Confirmado vira Realizado depois do fim (ou no dia seguinte, sem fim). Mesma regra de statusNoMomento. */
create function public.realizar_confirmados()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  quantos integer;
begin
  update public.eventos set status = 'realizado'
  where status = 'confirmado' and public.status_no_momento(status, inicio, fim, dia_inteiro) = 'realizado';
  get diagnostics quantos = row_count;
  return quantos;
end;
$$;

revoke execute on function public.realizar_confirmados from public, anon, authenticated;
grant execute on function public.realizar_confirmados to service_role;

-- A interface já mostra o Status do momento (statusNoMomento); o agendamento grava a mudança.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('realizar-confirmados', '* * * * *', 'select public.realizar_confirmados()');

-- Registro de alterações ----------------------------------------------------

create type public.operacao_no_evento as enum ('criacao', 'edicao', 'exclusao');

create table public.alteracoes_dos_eventos (
  id bigint generated always as identity primary key,
  -- Sem chave estrangeira: o registro fica depois que o Admin exclui o Evento.
  evento_id uuid not null,
  operacao public.operacao_no_evento not null,
  -- Nulo quando foi o próprio Mural, como no Realizado automático.
  feito_por uuid references public.perfis (id),
  feito_em timestamptz not null default now(),
  -- Cada coluna que mudou, como {"antes": …, "depois": …}; na criação, `antes` é nulo, e na exclusão, `depois`.
  mudancas jsonb not null
);

create index alteracoes_dos_eventos_evento on public.alteracoes_dos_eventos (evento_id, feito_em);

/** Grava cada criação, edição e exclusão de Evento. Uma edição que não muda nada não é gravada. */
create function public.registrar_alteracao_do_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}' end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}' end;
  mudancas jsonb;
begin
  select coalesce(jsonb_object_agg(chave, jsonb_build_object('antes', antes -> chave, 'depois', depois -> chave)), '{}')
  into mudancas
  from (select jsonb_object_keys(antes || depois) chave) colunas
  where chave not in ('editado_por', 'editado_em')
    and (antes -> chave) is distinct from (depois -> chave);

  if mudancas = '{}' then
    return null;
  end if;

  insert into public.alteracoes_dos_eventos (evento_id, operacao, feito_por, mudancas)
  values (
    coalesce(new.id, old.id),
    case tg_op when 'INSERT' then 'criacao' when 'UPDATE' then 'edicao' else 'exclusao' end::public.operacao_no_evento,
    (select auth.uid()),
    mudancas
  );
  return null;
end;
$$;

create trigger ao_alterar_evento
  after insert or update or delete on public.eventos
  for each row execute function public.registrar_alteracao_do_evento();

alter table public.alteracoes_dos_eventos enable row level security;

-- A tela de consulta fica fora do MVP; o registro já é gravado.
create policy "só o Admin lê o registro de alterações" on public.alteracoes_dos_eventos for select to authenticated
  using ((select public.e_admin()));

revoke insert, update, delete, truncate on public.alteracoes_dos_eventos from anon, authenticated;
