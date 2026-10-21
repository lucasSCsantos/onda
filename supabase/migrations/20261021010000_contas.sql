-- Ciclo de contas: nível de acesso, Funções, convites, aprovação e desativação.
-- As regras espelham src/dominio/acesso.ts e src/dominio/convites.ts.

create type public.nivel_de_acesso as enum ('admin', 'lider', 'professor', 'pendente');

alter table public.perfis
  add column email text not null default '',
  add column data_nascimento date,
  add column nivel public.nivel_de_acesso not null default 'pendente',
  -- Desativar não apaga: a conta fica para o histórico dos Eventos, mas perde o acesso.
  add column ativo boolean not null default true;

-- Áreas e Funções. A edição pelo Admin e o restante do catálogo chegam no ticket 03.
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table public.funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  area_id uuid not null references public.areas (id)
);

create table public.funcoes_das_pessoas (
  pessoa_id uuid not null references public.perfis (id) on delete cascade,
  funcao_id uuid not null references public.funcoes (id),
  primary key (pessoa_id, funcao_id)
);

insert into public.areas (nome) values
  ('Geral'), ('Ensino'), ('Programação'), ('Comunicação'), ('Louvor'), ('Acampamento');

insert into public.funcoes (nome, area_id)
select f.nome, a.id
from (values
  ('Líder do ministério', 'Geral'),
  ('Co-líder do ministério', 'Geral'),
  ('Líder do ensino', 'Ensino'),
  ('Líder do louvor', 'Louvor'),
  ('Líder do louvor dos adolescentes', 'Louvor'),
  ('Líder de comunicação e mídia', 'Comunicação'),
  ('Líder de integração e programação', 'Programação'),
  ('Co-líder de integração e programação', 'Programação')
) as f (nome, area)
join public.areas a on a.nome = f.area;

-- Convite de uso único. O código vai no link enviado pelo Admin.
create table public.convites (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default gen_random_uuid()::text,
  nivel public.nivel_de_acesso not null check (nivel <> 'pendente'),
  funcao_id uuid references public.funcoes (id),
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references public.perfis (id) on delete set null,
  usado_em timestamptz,
  revogado_em timestamptz,
  check (expira_em > criado_em),
  check (nivel <> 'lider' or funcao_id is not null)
);

-- Funções auxiliares das políticas. `security definer` para ler perfis sem cair nas próprias políticas.

/** Nível de quem está logado; nulo para quem não entrou ou foi desativado. */
create function public.meu_nivel()
returns public.nivel_de_acesso
language sql
stable
security definer
set search_path = ''
as $$
  select nivel from public.perfis where id = (select auth.uid()) and ativo;
$$;

create function public.e_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.meu_nivel() = 'admin', false);
$$;

create function public.e_lideranca()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.meu_nivel() in ('admin', 'lider'), false);
$$;

create function public.situacao_do_convite(convite public.convites)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when convite.usado_em is not null then 'usado'
    when convite.revogado_em is not null then 'revogado'
    when convite.expira_em <= now() then 'vencido'
    else 'valido'
  end;
$$;

-- Perfis --------------------------------------------------------------------

drop policy "cada pessoa lê o próprio perfil" on public.perfis;

create policy "cada pessoa lê o próprio perfil; a Liderança lê quem já foi aprovado; o Admin lê todos"
  on public.perfis for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.e_admin())
    or ((select public.e_lideranca()) and nivel <> 'pendente')
  );

-- O Admin muda nível e ativo dos outros (aprova, promove, desativa), nunca os próprios,
-- para não se trancar fora por engano.
create policy "o Admin muda o acesso dos outros"
  on public.perfis for update
  to authenticated
  using ((select public.e_admin()) and id <> (select auth.uid()))
  with check ((select public.e_admin()) and id <> (select auth.uid()));

revoke insert, update, delete on public.perfis from anon, authenticated;
grant update (nivel, ativo) on public.perfis to authenticated;

-- Áreas e Funções -----------------------------------------------------------

alter table public.areas enable row level security;
alter table public.funcoes enable row level security;
alter table public.funcoes_das_pessoas enable row level security;

create policy "a Liderança lê as Áreas" on public.areas for select to authenticated
  using ((select public.e_lideranca()));

create policy "a Liderança lê as Funções" on public.funcoes for select to authenticated
  using ((select public.e_lideranca()));

create policy "cada pessoa lê as próprias Funções; a Liderança lê as de todos"
  on public.funcoes_das_pessoas for select to authenticated
  using (pessoa_id = (select auth.uid()) or (select public.e_lideranca()));

create policy "o Admin atribui Funções" on public.funcoes_das_pessoas for insert to authenticated
  with check ((select public.e_admin()));

create policy "o Admin retira Funções" on public.funcoes_das_pessoas for delete to authenticated
  using ((select public.e_admin()));

revoke insert, update, delete on public.areas, public.funcoes from anon, authenticated;
revoke update on public.funcoes_das_pessoas from anon, authenticated;

-- Convites ------------------------------------------------------------------

alter table public.convites enable row level security;

create policy "o Admin lê os convites" on public.convites for select to authenticated
  using ((select public.e_admin()));

create policy "o Admin gera convites" on public.convites for insert to authenticated
  with check ((select public.e_admin()) and criado_por = (select auth.uid()));

create policy "o Admin revoga convites" on public.convites for update to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

revoke insert, update, delete on public.convites from anon, authenticated;
grant insert (nivel, funcao_id, expira_em) on public.convites to authenticated;
grant update (revogado_em) on public.convites to authenticated;

/** O que a tela de cadastro mostra sobre um convite, sem exigir login. */
create function public.consultar_convite(codigo text)
returns table (situacao text, nivel public.nivel_de_acesso, funcao text)
language sql
stable
security definer
set search_path = ''
as $$
  select public.situacao_do_convite(c), c.nivel, f.nome
  from public.convites c
  left join public.funcoes f on f.id = c.funcao_id
  where c.codigo = consultar_convite.codigo;
$$;

revoke execute on function public.consultar_convite from public;
grant execute on function public.consultar_convite to anon, authenticated;

-- Cadastro ------------------------------------------------------------------

-- Toda conta nova ganha um perfil. Com convite válido, entra já com o nível e a Função dele;
-- com convite usado, vencido, revogado ou inexistente, o cadastro é recusado; sem convite, fica Pendente.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  codigo_do_convite text := nullif(dados ->> 'convite', '');
  convite public.convites;
begin
  insert into public.perfis (id, nome, email, data_nascimento)
  values (
    new.id,
    coalesce(dados ->> 'nome', ''),
    coalesce(new.email, ''),
    nullif(dados ->> 'data_nascimento', '')::date
  );

  if codigo_do_convite is null then
    return new;
  end if;

  select * into convite from public.convites c where c.codigo = codigo_do_convite for update;
  if not found or public.situacao_do_convite(convite) <> 'valido' then
    raise exception 'convite inválido' using errcode = 'P0001';
  end if;

  update public.perfis set nivel = convite.nivel where id = new.id;
  if convite.funcao_id is not null then
    insert into public.funcoes_das_pessoas (pessoa_id, funcao_id) values (new.id, convite.funcao_id);
  end if;
  update public.convites set usado_por = new.id, usado_em = now() where id = convite.id;

  return new;
end;
$$;

-- Mantém o e-mail do perfil igual ao da conta.
create function public.atualizar_email_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfis set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger ao_mudar_email
  after update of email on auth.users
  for each row execute function public.atualizar_email_do_perfil();

-- Aprovação -----------------------------------------------------------------

/** O Admin aprova um Pendente definindo nível e Função. Roda com as permissões de quem chama. */
create function public.aprovar_pendente(
  pessoa uuid,
  novo_nivel public.nivel_de_acesso,
  funcao uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if novo_nivel = 'pendente' then
    raise exception 'escolha um nível para aprovar' using errcode = 'P0001';
  end if;
  if novo_nivel = 'lider' and funcao is null then
    raise exception 'um Líder precisa de uma Função' using errcode = 'P0001';
  end if;

  update public.perfis set nivel = novo_nivel where id = pessoa and nivel = 'pendente' and ativo;
  if not found then
    raise exception 'Pendente não encontrado' using errcode = 'P0002';
  end if;

  if funcao is not null then
    insert into public.funcoes_das_pessoas (pessoa_id, funcao_id) values (pessoa, funcao);
  end if;
end;
$$;

revoke execute on function public.aprovar_pendente from public, anon;
grant execute on function public.aprovar_pendente to authenticated;

/** O Admin recusa um Pendente: a conta é apagada, pois não tem histórico. */
create function public.recusar_pendente(pessoa uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_admin() then
    raise exception 'só o Admin recusa Pendentes' using errcode = '42501';
  end if;

  delete from auth.users u
  using public.perfis p
  where u.id = pessoa and p.id = u.id and p.nivel = 'pendente';
  if not found then
    raise exception 'Pendente não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.recusar_pendente from public, anon;
grant execute on function public.recusar_pendente to authenticated;
