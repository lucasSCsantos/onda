-- Assinatura de calendário (ticket 11 de .scratch/drive-agenda-avisos): o endereço pessoal `.ics` que mostra os Eventos no
-- calendário do celular. O endereço funciona como senha de leitura: o banco guarda só o hash (SHA-256) do token, que o app
-- mostra uma única vez. O arquivo em si é gerado pelo app (src/dominio/assinatura-de-calendario.ts); aqui ficam a tabela,
-- a conferência do que cada pessoa pode escolher, o log e a abertura do feed com o limite de consultas por token.

create table public.assinaturas_de_calendario (
  -- Uma por pessoa: regerar troca o hash, revogar apaga a linha.
  pessoa_id uuid primary key references public.perfis (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  escopo text not null default 'todos' check (escopo in ('todos', 'meus')),
  -- Vazio vale para todas as Categorias.
  categorias uuid[] not null default '{}',
  aniversarios boolean not null default false,
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  -- O limite de consultas por token: quantas houve desde o começo da janela de uma hora.
  janela_inicio timestamptz,
  consultas_na_janela integer not null default 0 check (consultas_na_janela >= 0)
);

alter table public.assinaturas_de_calendario enable row level security;

-- Só o dono, e só enquanto a conta está aprovada e ativa.
create function public.pode_assinar_calendario()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.meu_nivel() in ('admin', 'lider', 'professor'), false);
$$;

create policy "o dono lê a própria assinatura" on public.assinaturas_de_calendario for select to authenticated
  using (pessoa_id = (select auth.uid()));

create policy "o dono cria a própria assinatura" on public.assinaturas_de_calendario for insert to authenticated
  with check (pessoa_id = (select auth.uid()) and (select public.pode_assinar_calendario()));

create policy "o dono edita a própria assinatura" on public.assinaturas_de_calendario for update to authenticated
  using (pessoa_id = (select auth.uid()))
  with check (pessoa_id = (select auth.uid()) and (select public.pode_assinar_calendario()));

create policy "o dono revoga a própria assinatura" on public.assinaturas_de_calendario for delete to authenticated
  using (pessoa_id = (select auth.uid()));

-- O hash nunca volta para a interface: nem o dono o lê.
revoke all on public.assinaturas_de_calendario from anon, authenticated;
grant select (pessoa_id, escopo, categorias, aniversarios, criado_em, usado_em) on public.assinaturas_de_calendario to authenticated;
grant insert (pessoa_id, token_hash, escopo, categorias, aniversarios) on public.assinaturas_de_calendario to authenticated;
grant update (token_hash, escopo, categorias, aniversarios) on public.assinaturas_de_calendario to authenticated;
grant delete on public.assinaturas_de_calendario to authenticated;

/**
 * O que as políticas não conferem. Mesma regra de lerOpcoes: o Professor recebe só as próprias aulas e nunca aniversários,
 * e aniversários são só da Liderança. Regerar (trocar o hash) recomeça a contagem: o token novo é outro endereço.
 */
create function public.conferir_assinatura()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  nivel public.nivel_de_acesso := public.meu_nivel();
begin
  if nivel = 'professor' and (new.escopo <> 'meus' or new.aniversarios) then
    raise exception 'o Professor recebe só as próprias aulas, sem aniversários' using errcode = 'P0001';
  end if;
  if new.aniversarios and nivel not in ('admin', 'lider') then
    raise exception 'aniversários são só da Liderança' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and new.token_hash <> old.token_hash then
    new.criado_em := now();
    new.usado_em := null;
    new.janela_inicio := null;
    new.consultas_na_janela := 0;
  end if;
  return new;
end;
$$;

create trigger conferir_assinatura
  before insert or update on public.assinaturas_de_calendario
  for each row execute function public.conferir_assinatura();

-- Log: gerar, regerar e revogar. Nem o token nem o endereço (nem o hash) entram no registro: só quem e quando.
create function public.log_da_assinatura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha public.assinaturas_de_calendario := case tg_op when 'DELETE' then old else new end;
begin
  perform public.gravar_log(
    case tg_op when 'INSERT' then 'calendario.gerado' when 'UPDATE' then 'calendario.regerado' else 'calendario.revogado' end,
    'assinatura', linha.pessoa_id::text,
    (select nullif(btrim(p.nome), '') from public.perfis p where p.id = linha.pessoa_id)
  );
  return null;
end;
$$;

create trigger ao_gerar_assinatura
  after insert on public.assinaturas_de_calendario
  for each row execute function public.log_da_assinatura();

create trigger ao_regerar_assinatura
  after update on public.assinaturas_de_calendario
  for each row when (old.token_hash is distinct from new.token_hash)
  execute function public.log_da_assinatura();

create trigger ao_revogar_assinatura
  after delete on public.assinaturas_de_calendario
  for each row execute function public.log_da_assinatura();

/**
 * Abre o feed de um token (pelo hash) e conta a consulta. Só a chave service-role chama. O estado diz o que a rota faz:
 * `ok` (com a pessoa e as opções), `limite` (acima de `limite` consultas na janela de uma hora, com a espera em segundos)
 * ou `invalido` (hash desconhecido, revogado, ou conta que deixou de estar aprovada e ativa). Consulta recusada não conta.
 */
create function public.abrir_feed(hash text, limite integer default 60)
returns table (estado text, pessoa_id uuid, escopo text, categorias uuid[], aniversarios boolean, espera integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.assinaturas_de_calendario;
begin
  select s.* into a
  from public.assinaturas_de_calendario s
  join public.perfis p on p.id = s.pessoa_id
  where s.token_hash = abrir_feed.hash and p.ativo and p.nivel in ('admin', 'lider', 'professor')
  for update of s;

  if not found then
    return query select 'invalido'::text, null::uuid, null::text, null::uuid[], null::boolean, null::integer;
    return;
  end if;

  if a.janela_inicio is null or a.janela_inicio <= now() - interval '1 hour' then
    a.janela_inicio := now();
    a.consultas_na_janela := 0;
  end if;

  if a.consultas_na_janela >= limite then
    return query select
      'limite'::text, null::uuid, null::text, null::uuid[], null::boolean,
      greatest(1, ceil(extract(epoch from (a.janela_inicio + interval '1 hour' - now())))::integer);
    return;
  end if;

  update public.assinaturas_de_calendario s
  set janela_inicio = a.janela_inicio, consultas_na_janela = a.consultas_na_janela + 1, usado_em = now()
  where s.pessoa_id = a.pessoa_id;

  return query select 'ok'::text, a.pessoa_id, a.escopo, a.categorias, a.aniversarios, null::integer;
end;
$$;

revoke execute on function public.abrir_feed from public, anon, authenticated;
grant execute on function public.abrir_feed to service_role;

-- Como reverter:
-- drop function public.abrir_feed, public.log_da_assinatura, public.conferir_assinatura, public.pode_assinar_calendario;
-- drop table public.assinaturas_de_calendario;
