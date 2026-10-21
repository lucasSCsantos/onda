-- Séries e Ocorrências (ticket 08).
-- As regras espelham src/dominio/series.ts. A Série guarda a regra; as Ocorrências são Eventos comuns (`serie_id`),
-- geradas na criação. `editada` marca as alteradas individualmente, que uma edição de série não sobrescreve.

create table public.series (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id),
  -- A regra de expansão (RegraDaSerie em series.ts) e a data da primeira Ocorrência possível.
  regra jsonb not null check (jsonb_typeof(regra) = 'object'),
  primeiro_dia date not null,
  -- Dia em que a Série foi encerrada: as Ocorrências depois dele viraram Canceladas.
  encerrada_em date,
  criado_por uuid not null default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);

alter table public.eventos
  -- Excluir a Série (só o Admin) leva as Ocorrências junto.
  add column serie_id uuid references public.series (id) on delete cascade,
  add column editada boolean not null default false,
  add check (not editada or serie_id is not null);

create index eventos_serie on public.eventos (serie_id);

alter table public.series enable row level security;

create policy "a Liderança lê todas as Séries" on public.series for select to authenticated
  using ((select public.e_lideranca()));

-- Criar Série segue a permissão da Categoria (podeCriarEvento).
create policy "quem tem Função na Área da Categoria cria Séries dela" on public.series for insert to authenticated
  with check (public.pode_criar_evento(categoria_id) and criado_por = (select auth.uid()));

-- Encerrar a Série é de quem a cria.
create policy "quem cria Séries da Categoria as encerra" on public.series for update to authenticated
  using (public.pode_criar_evento(categoria_id))
  with check (public.pode_criar_evento(categoria_id));

create policy "só o Admin exclui Séries" on public.series for delete to authenticated
  using ((select public.e_admin()));

revoke insert, update, delete on public.series from anon, authenticated;
grant insert (categoria_id, regra, primeiro_dia) on public.series to authenticated;
grant update (encerrada_em) on public.series to authenticated;
grant delete on public.series to authenticated;

grant insert (serie_id) on public.eventos to authenticated;
grant update (editada) on public.eventos to authenticated;

/**
 * A mesma conferência de antes, com duas regras de Série: a Série de um Evento novo é da mesma Categoria, e uma
 * Ocorrência Realizada ou Cancelada só o Admin edita (o Realizado automático, sem sessão, segue valendo).
 */
create or replace function public.conferir_evento()
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

  if not editando and new.serie_id is not null and not exists (
    select 1 from public.series s where s.id = new.serie_id and s.categoria_id = new.categoria_id
  ) then
    raise exception 'a Série precisa ser da mesma Categoria do Evento' using errcode = 'P0001';
  end if;

  if editando then
    -- Diante da Série, uma Ocorrência Realizada ou Cancelada fica congelada: só o Admin a edita, e só ela.
    if old.serie_id is not null
      and eu is not null
      and not public.e_admin()
      and public.status_no_momento(old.status, old.inicio, old.fim, old.dia_inteiro) in ('realizado', 'cancelado') then
      raise exception 'uma Ocorrência Realizada ou Cancelada só o Admin edita' using errcode = '42501';
    end if;

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

/** Cria a Série e todas as suas Ocorrências de uma vez, com as permissões de quem chama. Devolve o id da Série. */
create function public.criar_serie(categoria uuid, regra jsonb, primeiro_dia date, ocorrencias jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  nova uuid;
begin
  insert into public.series (categoria_id, regra, primeiro_dia)
  values (categoria, regra, primeiro_dia)
  returning id into nova;

  insert into public.eventos (titulo, categoria_id, serie_id, inicio, fim, dia_inteiro, "local", responsavel_id, status, observacoes, link, campos)
  select o.titulo, categoria, nova, o.inicio, o.fim, coalesce(o.dia_inteiro, false), coalesce(o."local", ''), o.responsavel_id,
    o.status, coalesce(o.observacoes, ''), o.link, coalesce(o.campos, '{}')
  from jsonb_to_recordset(ocorrencias) as o(
    titulo text, inicio timestamptz, fim timestamptz, dia_inteiro boolean, "local" text, responsavel_id uuid,
    status public.status_do_evento, observacoes text, link text, campos jsonb
  );

  return nova;
end;
$$;

/**
 * Grava várias Ocorrências de uma vez (edição de série, cancelamentos), com as permissões de quem chama: se alguma
 * não puder ser alterada, nenhuma é. `editada` ausente deixa a marca como está.
 */
create function public.editar_eventos(alteracoes jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  a record;
  linhas integer;
begin
  for a in
    select * from jsonb_to_recordset(alteracoes) as x(
      id uuid, titulo text, inicio timestamptz, fim timestamptz, dia_inteiro boolean, "local" text, responsavel_id uuid,
      status public.status_do_evento, observacoes text, link text, campos jsonb, editada boolean
    )
  loop
    update public.eventos e
    set titulo = a.titulo, inicio = a.inicio, fim = a.fim, dia_inteiro = coalesce(a.dia_inteiro, false),
      "local" = coalesce(a."local", ''), responsavel_id = a.responsavel_id, status = a.status,
      observacoes = coalesce(a.observacoes, ''), link = a.link, campos = coalesce(a.campos, '{}'),
      editada = coalesce(a.editada, e.editada)
    where e.id = a.id;
    get diagnostics linhas = row_count;
    if linhas <> 1 then
      raise exception 'sem permissão para alterar o Evento %', a.id using errcode = '42501';
    end if;
  end loop;
end;
$$;

/** Encerra a Série em um dia e grava as Ocorrências canceladas depois dele, tudo ou nada. */
create function public.encerrar_serie(serie uuid, ate date, alteracoes jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  linhas integer;
begin
  update public.series set encerrada_em = ate where id = serie;
  get diagnostics linhas = row_count;
  if linhas <> 1 then
    raise exception 'sem permissão para encerrar a Série' using errcode = '42501';
  end if;
  perform public.editar_eventos(alteracoes);
end;
$$;

revoke execute on function public.criar_serie, public.editar_eventos, public.encerrar_serie from public, anon;
grant execute on function public.criar_serie, public.editar_eventos, public.encerrar_serie to authenticated;
