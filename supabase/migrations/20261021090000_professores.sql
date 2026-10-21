-- Professores e Auxiliares (ticket 11).
-- As regras espelham src/dominio/professores.ts. O Professor e o Auxiliar de uma aula são os campos pessoa "Professor"
-- e "Auxiliar" da Categoria (EBD); o Professor, nível de acesso sem Função, lê só as aulas em que foi colocado.

-- Cadastro e convite -----------------------------------------------------------

/** Quem está logado cadastra Professores e gera o convite deles? O Admin e quem tem Função em Ensino. Mesma regra de podeCadastrarProfessor. */
create function public.pode_cadastrar_professor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_admin() or coalesce(
    public.meu_nivel() = 'lider'
    and exists (
      select 1
      from public.funcoes_das_pessoas fp
      join public.funcoes f on f.id = fp.funcao_id
      join public.areas a on a.id = f.area_id
      where fp.pessoa_id = (select auth.uid()) and a.nome = 'Ensino'
    ),
    false
  );
$$;

revoke execute on function public.pode_cadastrar_professor from public, anon;
grant execute on function public.pode_cadastrar_professor to authenticated;

-- Quem tem Função em Ensino lê, gera e revoga só convites de Professor (sem Função); o Admin segue com todos.
create policy "quem cadastra Professores lê os convites de Professor" on public.convites for select to authenticated
  using (nivel = 'professor' and (select public.pode_cadastrar_professor()));

create policy "quem cadastra Professores gera convites de Professor" on public.convites for insert to authenticated
  with check (
    nivel = 'professor' and funcao_id is null
    and (select public.pode_cadastrar_professor())
    and criado_por = (select auth.uid())
  );

create policy "quem cadastra Professores revoga convites de Professor" on public.convites for update to authenticated
  using (nivel = 'professor' and (select public.pode_cadastrar_professor()))
  with check (nivel = 'professor' and (select public.pode_cadastrar_professor()));

-- Aulas -----------------------------------------------------------------------

/**
 * O Professor logado foi colocado nesta aula, como Professor ou Auxiliar? Os campos pessoa com esses nomes na
 * Categoria guardam o id. Mesma regra de podeVerEvento.
 */
create function public.e_professor_da_aula(categoria uuid, campos jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.meu_nivel() = 'professor', false) and exists (
    select 1
    from public.campos_das_categorias c
    where c.categoria_id = e_professor_da_aula.categoria
      and c.tipo = 'pessoa'
      and c.nome in ('Professor', 'Auxiliar')
      and e_professor_da_aula.campos ->> c.id::text = (select auth.uid())::text
  );
$$;

revoke execute on function public.e_professor_da_aula from public, anon;
grant execute on function public.e_professor_da_aula to authenticated;

create policy "o Professor lê as aulas em que foi colocado" on public.eventos for select to authenticated
  using (public.e_professor_da_aula(categoria_id, campos));

-- Ele edita só as observações: a política deixa chegar à linha, e `conferir_evento` recusa qualquer outra coluna.
create policy "o Professor edita as aulas em que foi colocado" on public.eventos for update to authenticated
  using (public.e_professor_da_aula(categoria_id, campos))
  with check (public.e_professor_da_aula(categoria_id, campos));

-- Para mostrar a aula, ele lê a Categoria, os campos e a Área dos Eventos que enxerga (e só deles).
create policy "o Professor lê a Categoria das aulas dele" on public.categorias for select to authenticated
  using (exists (select 1 from public.eventos e where e.categoria_id = categorias.id));

create policy "o Professor lê os campos da Categoria das aulas dele" on public.campos_das_categorias for select to authenticated
  using (exists (select 1 from public.eventos e where e.categoria_id = campos_das_categorias.categoria_id));

create policy "o Professor lê a Área das aulas dele" on public.areas for select to authenticated
  using (exists (select 1 from public.categorias c where c.area_id = areas.id));

/**
 * Nome e situação do Responsável, do Professor e do Auxiliar de um Evento que quem chama enxerga. O Professor não
 * lê `perfis` (e-mail e data de nascimento são da Liderança); por aqui ele só descobre quem está na aula dele.
 */
create function public.pessoas_da_aula(evento uuid)
returns table (id uuid, nome text, ativo boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.ativo
  from public.eventos e
  join public.perfis p on p.id = e.responsavel_id or exists (
    select 1
    from public.campos_das_categorias c
    where c.categoria_id = e.categoria_id
      and c.tipo = 'pessoa'
      and c.nome in ('Professor', 'Auxiliar')
      and e.campos ->> c.id::text = p.id::text
  )
  where e.id = pessoas_da_aula.evento
    and (public.e_lideranca() or public.e_professor_da_aula(e.categoria_id, e.campos));
$$;

revoke execute on function public.pessoas_da_aula from public, anon;
grant execute on function public.pessoas_da_aula to authenticated;

-- Conferências ----------------------------------------------------------------

/**
 * O campo pessoa "Professor" ou "Auxiliar" aceita também um Professor ativo; os demais campos pessoa, só a Liderança.
 * O resto é igual ao do ticket 12 (checklist); `nome` é o nome do campo na Categoria.
 */
drop function public.campo_valido(public.tipo_de_campo, text[], jsonb);

create function public.campo_valido(tipo public.tipo_de_campo, opcoes text[], valor jsonb, nome text default '')
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
        select 1 from public.perfis p
        where p.id::text = texto and p.ativo
          and (p.nivel in ('admin', 'lider') or (p.nivel = 'professor' and campo_valido.nome in ('Professor', 'Auxiliar')))
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
 * A mesma `conferir_evento` do ticket 12, com duas mudanças: o Professor edita só as observações da aula dele (sem
 * sessão, ou sendo da Liderança, nada muda), e o nome do campo chega a `campo_valido`.
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
    -- O Professor não muda Status, data nem Responsável, nem nada além das observações.
    if eu is not null and public.meu_nivel() = 'professor'
      and (to_jsonb(new) - 'observacoes') is distinct from (to_jsonb(old) - 'observacoes') then
      raise exception 'o Professor edita só as observações' using errcode = '42501';
    end if;

    -- Diante da Série, uma Ocorrência Realizada ou Cancelada fica congelada: só o Admin a edita, e só ela.
    -- O Professor fica de fora: ele só mexe nas observações (conferido acima), e é depois da aula que as escreve.
    if old.serie_id is not null
      and eu is not null
      and not public.e_admin()
      and public.meu_nivel() is distinct from 'professor'
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
    elsif not public.campo_valido(campo.tipo, campo.opcoes, valor, campo.nome) then
      raise exception '“%” fora do formato do tipo', campo.nome using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;
