-- Checklist (ticket 12): lista de tarefas `{texto, feito}` dentro de `eventos.campos`, em qualquer Categoria.
-- Quem edita o Evento (`pode_editar_evento`) marca as tarefas pela mesma política de edição; o Professor não edita.
-- Mesma regra de eChecklist, em src/dominio/checklist.ts.

create or replace function public.campo_valido(tipo public.tipo_de_campo, opcoes text[], valor jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  texto text := valor #>> '{}';
begin
  case tipo
    when 'texto_curto', 'texto_longo' then
      return jsonb_typeof(valor) = 'string';
    when 'link' then
      return jsonb_typeof(valor) = 'string' and texto ~* '^https?://\S+$';
    when 'valor' then
      return jsonb_typeof(valor) = 'number' and texto::numeric >= 0 and texto::numeric = trunc(texto::numeric);
    when 'data' then
      return jsonb_typeof(valor) = 'string' and texto ~ '^\d{4}-\d{2}-\d{2}$' and texto::date is not null;
    when 'data_hora' then
      return jsonb_typeof(valor) = 'string' and texto ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' and texto::timestamp is not null;
    when 'escolha' then
      return jsonb_typeof(valor) = 'string' and texto = any (opcoes);
    when 'lista' then
      return jsonb_typeof(valor) = 'array' and not exists (
        select 1 from jsonb_array_elements(valor) item where jsonb_typeof(item) <> 'string' or btrim(item #>> '{}') = ''
      );
    when 'pessoa' then
      return jsonb_typeof(valor) = 'string' and exists (
        select 1 from public.perfis p where p.id::text = texto and p.ativo and p.nivel in ('admin', 'lider')
      );
    when 'checklist' then
      return jsonb_typeof(valor) = 'array' and not exists (
        select 1 from jsonb_array_elements(valor) item
        where jsonb_typeof(item) <> 'object'
          or jsonb_typeof(item -> 'texto') is distinct from 'string'
          or btrim(item ->> 'texto') = ''
          or jsonb_typeof(item -> 'feito') is distinct from 'boolean'
      );
  end case;
exception
  -- Uma data que não existe, como 30/02, não converte.
  when invalid_datetime_format or datetime_field_overflow then
    return false;
end;
$$;

/**
 * Mesma `conferir_evento` do ticket 08 (Séries), agora conferindo também o formato do checklist. O checklist nunca
 * é obrigatório: ele não está no formulário, é mexido na página do Evento.
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

  for campo in select * from public.campos_das_categorias c where c.categoria_id = new.categoria_id loop
    valor := new.campos -> campo.id::text;
    continue when editando and valor is not distinct from old.campos -> campo.id::text;
    if valor is null or valor = 'null' or valor = '[]' or (jsonb_typeof(valor) = 'string' and btrim(valor #>> '{}') = '') then
      if campo.obrigatorio and campo.tipo <> 'checklist' then
        raise exception 'preencha “%”', campo.nome using errcode = 'P0001';
      end if;
    elsif not public.campo_valido(campo.tipo, campo.opcoes, valor) then
      raise exception '“%” fora do formato do tipo', campo.nome using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;
