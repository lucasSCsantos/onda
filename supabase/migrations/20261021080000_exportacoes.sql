-- Exportação em CSV (ticket 13): cada exportação grava quem e quando, e só o Admin a vê.
-- Registrar é o que autoriza exportar: a rota grava a linha antes de ler os dados, e só o Admin consegue gravá-la.

create type public.tabela_exportada as enum ('eventos', 'adolescentes', 'usuarios');

create table public.exportacoes (
  id uuid primary key default gen_random_uuid(),
  tabela public.tabela_exportada not null,
  -- Desativar ou apagar a conta não apaga o registro.
  feito_por uuid references public.perfis (id) on delete set null default auth.uid(),
  feito_em timestamptz not null default now()
);

alter table public.exportacoes enable row level security;

create policy "o Admin lê as exportações" on public.exportacoes for select to authenticated
  using ((select public.e_admin()));

create policy "o Admin registra a própria exportação" on public.exportacoes for insert to authenticated
  with check ((select public.e_admin()) and feito_por = (select auth.uid()));

-- O registro é imutável: ninguém edita nem apaga.
revoke all on public.exportacoes from anon, authenticated;
grant select on public.exportacoes to authenticated;
grant insert (tabela) on public.exportacoes to authenticated;
