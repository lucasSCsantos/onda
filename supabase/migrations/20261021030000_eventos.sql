-- Eventos: criar e listar (ticket 04). Edição, Status e registro de alterações chegam no ticket 05.
-- As regras espelham src/dominio/eventos.ts; a de criação, src/dominio/catalogo.ts (podeCriarEvento).

create type public.status_do_evento as enum ('rascunho', 'planejado', 'confirmado', 'realizado', 'cancelado', 'adiado');

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (btrim(titulo) <> ''),
  categoria_id uuid not null references public.categorias (id),
  -- Sem hora, o Evento é de dia inteiro: início e fim são meias-noites em Salvador, e o fim é o último dia.
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  local text not null default '',
  -- Desativar uma conta não a apaga, então o Responsável fica para o histórico.
  responsavel_id uuid references public.perfis (id),
  status public.status_do_evento not null default 'rascunho',
  observacoes text not null default '',
  link text check (link ~* '^https?://'),
  -- Do id do campo específico ao valor (ADR 0002); o formato de cada tipo está em ValorDeCampo.
  campos jsonb not null default '{}' check (jsonb_typeof(campos) = 'object'),
  criado_por uuid not null default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio),
  -- Mesma regra de lerEvento: só o Rascunho fica sem Responsável.
  check (status = 'rascunho' or responsavel_id is not null),
  check (
    not dia_inteiro
    or ((inicio at time zone 'America/Bahia')::time = '00:00'
      and (fim is null or (fim at time zone 'America/Bahia')::time = '00:00'))
  )
);

create index eventos_inicio on public.eventos (inicio);

/**
 * O valor de um campo específico tem o formato do tipo dele? Mesma regra de lerCampo, com o formato de ValorDeCampo:
 * textos, links, escolhas e pessoas como texto; o valor em reais em centavos; a data como `AAAA-MM-DD` e a data e
 * hora como `AAAA-MM-DDTHH:MM`; a lista como lista de textos. A pessoa é da Liderança ativa.
 */
create function public.campo_valido(tipo public.tipo_de_campo, opcoes text[], valor jsonb)
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
    else
      -- O checklist só ganha comportamento no ticket 12.
      return true;
  end case;
exception
  -- Uma data que não existe, como 30/02, não converte.
  when invalid_datetime_format or datetime_field_overflow then
    return false;
end;
$$;

/**
 * O que as restrições da tabela não conseguem conferir ao criar: um Evento novo não nasce Realizado, o Responsável
 * é da Liderança ativa, e os campos específicos são da Categoria, com os obrigatórios preenchidos e cada valor no
 * formato do tipo. Mesma regra de lerEvento. Só vale na criação: o que uma edição confere (com Responsável
 * desativado ou campo removido da Categoria) fica para o ticket 05.
 */
create function public.conferir_evento_novo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campo public.campos_das_categorias;
  valor jsonb;
begin
  if new.status = 'realizado' then
    raise exception 'um Evento novo não nasce Realizado' using errcode = 'P0001';
  end if;

  if new.responsavel_id is not null and not exists (
    select 1 from public.perfis p where p.id = new.responsavel_id and p.ativo and p.nivel in ('admin', 'lider')
  ) then
    raise exception 'o Responsável precisa ser da Liderança' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(new.campos) chave
    where not exists (
      select 1 from public.campos_das_categorias c where c.categoria_id = new.categoria_id and c.id::text = chave
    )
  ) then
    raise exception 'campo que não é da Categoria' using errcode = 'P0001';
  end if;

  for campo in select * from public.campos_das_categorias c where c.categoria_id = new.categoria_id and c.tipo <> 'checklist' loop
    valor := new.campos -> campo.id::text;
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

create trigger ao_criar_evento
  before insert on public.eventos
  for each row execute function public.conferir_evento_novo();

alter table public.eventos enable row level security;

-- Mesma regra de podeVerTodosOsEventos. O Professor lê as aulas dele no ticket 11.
create policy "a Liderança lê todos os Eventos" on public.eventos for select to authenticated
  using ((select public.e_lideranca()));

-- Mesma regra de podeCriarEvento; quem cria fica registrado e não pode ser outra pessoa.
create policy "quem tem Função na Área da Categoria cria Eventos dela" on public.eventos for insert to authenticated
  with check (public.pode_criar_evento(categoria_id) and criado_por = (select auth.uid()));

revoke insert, update, delete on public.eventos from anon, authenticated;
grant insert (titulo, categoria_id, inicio, fim, dia_inteiro, local, responsavel_id, status, observacoes, link, campos)
  on public.eventos to authenticated;
