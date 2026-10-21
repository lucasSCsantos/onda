-- Cadastro de Adolescentes (ticket 09, ADR 0003): separado dos usuários, sem login.
-- Só a Liderança aprovada lê e escreve; ninguém apaga, porque inativar preserva o histórico.

create table public.adolescentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  nascimento date not null check (nascimento <= (now() at time zone 'America/Bahia')::date),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.adolescentes enable row level security;

create policy "a Liderança lê os Adolescentes" on public.adolescentes for select to authenticated
  using ((select public.e_lideranca()));

create policy "a Liderança cadastra Adolescentes" on public.adolescentes for insert to authenticated
  with check ((select public.e_lideranca()));

create policy "a Liderança edita Adolescentes" on public.adolescentes for update to authenticated
  using ((select public.e_lideranca()))
  with check ((select public.e_lideranca()));

revoke all on public.adolescentes from anon, authenticated;
grant select on public.adolescentes to authenticated;
grant insert (nome, nascimento), update (nome, nascimento, ativo) on public.adolescentes to authenticated;
