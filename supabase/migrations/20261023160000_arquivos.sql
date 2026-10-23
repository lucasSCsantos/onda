-- Arquivos: navegar (ticket 06 de .scratch/drive-agenda-avisos). Ver ADR 0006.
-- Atalhos que o Admin cadastra para destacar pastas do Drive do ministério, e as Funções que os veem. Só a Liderança lê;
-- o Drive em si nunca passa por aqui (o servidor do app o consulta, conferindo a raiz). Só acréscimos.

create table public.atalhos_de_arquivos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> '' and char_length(nome) <= 40),
  -- Um dos ícones de ICONES_DOS_ATALHOS em src/dominio/arquivos.ts.
  icone text not null default 'folder'
    check (icone in ('folder', 'image', 'palette', 'tent', 'file-text', 'star', 'music', 'camera', 'megaphone', 'heart', 'flag', 'book-open')),
  -- Mesma forma de `configuracoes.drive_pasta_raiz_id`. Que a pasta esteja dentro da raiz é conferido a cada abertura.
  pasta_id text not null check (pasta_id ~ '^[A-Za-z0-9_-]{10,}$'),
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

-- Sem nenhuma linha aqui, o atalho vale para toda a Liderança.
create table public.funcoes_dos_atalhos (
  atalho_id uuid not null references public.atalhos_de_arquivos (id) on delete cascade,
  funcao_id uuid not null references public.funcoes (id),
  primary key (atalho_id, funcao_id)
);

alter table public.atalhos_de_arquivos enable row level security;
alter table public.funcoes_dos_atalhos enable row level security;

/**
 * Quem está logado vê este atalho? A Liderança ativa vê os atalhos sem Função marcada; o Admin e quem tem uma Função da
 * Área Geral veem todos; os demais, os que marcam alguma Função sua. Professor e Pendente não veem nenhum.
 */
create function public.pode_ver_atalho(atalho uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.e_lideranca(), false) and (
    public.e_admin()
    or exists (
      select 1
      from public.funcoes_das_pessoas fp
      join public.funcoes f on f.id = fp.funcao_id
      join public.areas a on a.id = f.area_id
      where fp.pessoa_id = (select auth.uid()) and a.nome = 'Geral'
    )
    or not exists (select 1 from public.funcoes_dos_atalhos x where x.atalho_id = pode_ver_atalho.atalho)
    or exists (
      select 1
      from public.funcoes_dos_atalhos x
      join public.funcoes_das_pessoas fp on fp.funcao_id = x.funcao_id
      where x.atalho_id = pode_ver_atalho.atalho and fp.pessoa_id = (select auth.uid())
    )
  );
$$;

revoke execute on function public.pode_ver_atalho from public, anon;
grant execute on function public.pode_ver_atalho to authenticated;

create policy "a Liderança lê os atalhos que as suas Funções permitem" on public.atalhos_de_arquivos for select to authenticated
  using ((select public.pode_ver_atalho(id)));

create policy "o Admin remove atalhos" on public.atalhos_de_arquivos for delete to authenticated
  using ((select public.e_admin()));

create policy "o Admin lê as Funções dos atalhos" on public.funcoes_dos_atalhos for select to authenticated
  using ((select public.e_admin()));

-- Criar e editar passa só por `salvar_atalho`, que grava o atalho e as Funções juntos.
revoke all on public.atalhos_de_arquivos, public.funcoes_dos_atalhos from anon, authenticated;
grant select, delete on public.atalhos_de_arquivos to authenticated;
grant select on public.funcoes_dos_atalhos to authenticated;

/**
 * O Admin cria (`atalho` nulo) ou edita um atalho com o conjunto de Funções que o veem, tudo ou nada, e a mudança vira
 * Log. Devolve o id. As regras são as de lerAtalho, em src/dominio/arquivos.ts.
 */
create function public.salvar_atalho(atalho uuid, novo_nome text, novo_icone text, nova_pasta text, novas_funcoes uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_do_atalho uuid := salvar_atalho.atalho;
  escolhidas uuid[] := array(select distinct f from unnest(coalesce(novas_funcoes, '{}')) f where f is not null);
  antes public.atalhos_de_arquivos;
  nomes_antes text[];
  nomes_depois text[];
  mudancas jsonb := '[]';
begin
  if not public.e_admin() then
    raise exception 'só o Admin cadastra atalhos' using errcode = '42501';
  end if;

  if id_do_atalho is null then
    insert into public.atalhos_de_arquivos (nome, icone, pasta_id, ordem)
    values (btrim(novo_nome), novo_icone, btrim(nova_pasta), coalesce((select max(ordem) + 1 from public.atalhos_de_arquivos), 0))
    returning id into id_do_atalho;
    insert into public.funcoes_dos_atalhos (atalho_id, funcao_id) select id_do_atalho, f from unnest(escolhidas) f;
    perform public.gravar_log(
      'drive.atalho_criado', 'atalho', id_do_atalho::text, btrim(novo_nome),
      jsonb_build_object('funcoes', (select coalesce(jsonb_agg(f.nome order by f.nome), '[]') from public.funcoes f where f.id = any (escolhidas)))
    );
    return id_do_atalho;
  end if;

  select * into antes from public.atalhos_de_arquivos where id = id_do_atalho for update;
  if not found then
    raise exception 'atalho não encontrado' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(f.nome order by f.nome), '{}') into nomes_antes
  from public.funcoes_dos_atalhos x join public.funcoes f on f.id = x.funcao_id where x.atalho_id = id_do_atalho;
  select coalesce(array_agg(f.nome order by f.nome), '{}') into nomes_depois from public.funcoes f where f.id = any (escolhidas);

  update public.atalhos_de_arquivos
  set nome = btrim(novo_nome), icone = novo_icone, pasta_id = btrim(nova_pasta)
  where id = id_do_atalho;
  delete from public.funcoes_dos_atalhos where atalho_id = id_do_atalho and funcao_id <> all (escolhidas);
  insert into public.funcoes_dos_atalhos (atalho_id, funcao_id) select id_do_atalho, f from unnest(escolhidas) f on conflict do nothing;

  if btrim(novo_nome) <> antes.nome then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Nome', 'tipo', 'texto', 'antes', antes.nome, 'depois', btrim(novo_nome));
  end if;
  if novo_icone <> antes.icone then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Ícone', 'tipo', 'texto', 'antes', antes.icone, 'depois', novo_icone);
  end if;
  if btrim(nova_pasta) <> antes.pasta_id then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Pasta', 'tipo', 'texto', 'antes', antes.pasta_id, 'depois', btrim(nova_pasta));
  end if;
  if nomes_antes <> nomes_depois then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Funções que veem', 'tipo', 'lista', 'antes', to_jsonb(nomes_antes), 'depois', to_jsonb(nomes_depois));
  end if;
  if jsonb_array_length(mudancas) > 0 then
    perform public.gravar_log('drive.atalho_editado', 'atalho', id_do_atalho::text, btrim(novo_nome), jsonb_build_object('mudancas', mudancas));
  end if;
  return id_do_atalho;
end;
$$;

revoke execute on function public.salvar_atalho from public, anon;
grant execute on function public.salvar_atalho to authenticated;

create function public.log_do_atalho_removido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gravar_log('drive.atalho_removido', 'atalho', old.id::text, old.nome);
  return null;
end;
$$;

create trigger ao_remover_atalho
  after delete on public.atalhos_de_arquivos
  for each row execute function public.log_do_atalho_removido();

-- Reverter --------------------------------------------------------------------------
-- Nada some se você parar aqui: sem atalhos a seção Arquivos continua abrindo a raiz. Para desfazer de vez:
-- drop trigger ao_remover_atalho on public.atalhos_de_arquivos;
-- drop function public.log_do_atalho_removido, public.salvar_atalho, public.pode_ver_atalho;
-- drop table public.funcoes_dos_atalhos, public.atalhos_de_arquivos;
