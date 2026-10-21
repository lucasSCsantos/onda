-- Perfil de cada conta. Nível de acesso, Funções e aprovação chegam no ticket 02.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  criado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;

create policy "cada pessoa lê o próprio perfil"
  on public.perfis for select
  to authenticated
  using (id = (select auth.uid()));

-- Toda conta nova ganha um perfil, com o nome informado no cadastro.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end;
$$;

create trigger ao_criar_conta
  after insert on auth.users
  for each row execute function public.criar_perfil();
