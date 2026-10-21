-- Catálogo de configuração: Funções editáveis, várias Funções por pessoa, Categorias e seus campos (ADR 0002),
-- e a regra de quem cria Evento de qual Categoria (ADR 0001).
-- O conteúdo inicial e as regras espelham src/dominio/catalogo.ts.

-- Funções --------------------------------------------------------------------

alter table public.funcoes add constraint funcoes_nome_preenchido check (btrim(nome) <> '');

create policy "o Admin cria Funções" on public.funcoes for insert to authenticated
  with check ((select public.e_admin()));

create policy "o Admin edita Funções" on public.funcoes for update to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

grant insert (nome, area_id), update (nome, area_id) on public.funcoes to authenticated;

-- As Funções de uma pessoa mudam só por `definir_funcoes`, que confere a regra de erroNasFuncoes.
drop policy "o Admin atribui Funções" on public.funcoes_das_pessoas;
drop policy "o Admin retira Funções" on public.funcoes_das_pessoas;
revoke insert, delete on public.funcoes_das_pessoas from anon, authenticated;

/** O Admin define o conjunto de Funções de uma pessoa da Liderança; um Líder fica com ao menos uma. */
create function public.definir_funcoes(pessoa uuid, novas_funcoes uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nivel_da_pessoa public.nivel_de_acesso;
  escolhidas uuid[] := array(select distinct f from unnest(coalesce(novas_funcoes, '{}')) f where f is not null);
begin
  if not public.e_admin() then
    raise exception 'só o Admin atribui Funções' using errcode = '42501';
  end if;

  select nivel into nivel_da_pessoa from public.perfis where id = pessoa for update;
  if not found then
    raise exception 'pessoa não encontrada' using errcode = 'P0002';
  end if;
  -- Mesma regra de erroNasFuncoes.
  if nivel_da_pessoa = 'lider' and cardinality(escolhidas) = 0 then
    raise exception 'um Líder precisa de uma Função' using errcode = 'P0001';
  end if;
  if nivel_da_pessoa not in ('lider', 'admin') and cardinality(escolhidas) > 0 then
    raise exception 'só a Liderança tem Funções' using errcode = 'P0001';
  end if;

  delete from public.funcoes_das_pessoas where pessoa_id = pessoa and funcao_id <> all (escolhidas);
  insert into public.funcoes_das_pessoas (pessoa_id, funcao_id)
  select pessoa, f from unnest(escolhidas) f
  on conflict do nothing;
end;
$$;

revoke execute on function public.definir_funcoes from public, anon;
grant execute on function public.definir_funcoes to authenticated;

-- Categorias e campos --------------------------------------------------------

create type public.tipo_de_campo as enum (
  'texto_curto', 'texto_longo', 'link', 'valor', 'data', 'data_hora', 'escolha', 'lista', 'pessoa', 'checklist'
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (btrim(nome) <> ''),
  area_id uuid not null references public.areas (id),
  cor text not null check (cor ~* '^#[0-9a-f]{6}$')
);

-- Campos específicos são dados, não colunas: uma Categoria nova não muda a estrutura do banco.
create table public.campos_das_categorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  tipo public.tipo_de_campo not null,
  obrigatorio boolean not null default false,
  -- Mesma regra de erroNoCampo: só a escolha tem opções, e ela precisa de ao menos uma.
  opcoes text[] not null default '{}',
  ordem integer not null default 0,
  check ((tipo = 'escolha') = (cardinality(opcoes) > 0)),
  check (array_position(opcoes, null) is null)
);

create unique index categorias_nome_unico on public.categorias (lower(btrim(nome)));

create unique index campos_das_categorias_nome_unico
  on public.campos_das_categorias (categoria_id, lower(btrim(nome)));

alter table public.categorias enable row level security;
alter table public.campos_das_categorias enable row level security;

create policy "a Liderança lê as Categorias" on public.categorias for select to authenticated
  using ((select public.e_lideranca()));

create policy "o Admin cria Categorias" on public.categorias for insert to authenticated
  with check ((select public.e_admin()));

create policy "o Admin edita Categorias" on public.categorias for update to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

create policy "a Liderança lê os campos" on public.campos_das_categorias for select to authenticated
  using ((select public.e_lideranca()));

create policy "o Admin cria campos" on public.campos_das_categorias for insert to authenticated
  with check ((select public.e_admin()));

create policy "o Admin edita campos" on public.campos_das_categorias for update to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

create policy "o Admin remove campos" on public.campos_das_categorias for delete to authenticated
  using ((select public.e_admin()));

revoke insert, update, delete on public.categorias, public.campos_das_categorias from anon, authenticated;
grant insert (nome, area_id, cor), update (nome, area_id, cor) on public.categorias to authenticated;
grant insert (categoria_id, nome, tipo, obrigatorio, opcoes, ordem),
  update (nome, tipo, obrigatorio, opcoes, ordem),
  delete
  on public.campos_das_categorias to authenticated;

-- Permissão de criar Evento --------------------------------------------------

/**
 * Quem está logado pode criar Evento (e Série) desta Categoria? O Admin cria todas; o Líder cria as Categorias
 * das Áreas das suas Funções, e uma Função Geral cria todas. Mesma regra de podeCriarEvento.
 */
create function public.pode_criar_evento(categoria uuid)
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
      join public.categorias c on c.id = pode_criar_evento.categoria
      where fp.pessoa_id = (select auth.uid())
        and (a.nome = 'Geral' or a.id = c.area_id)
    ),
    false
  );
$$;

revoke execute on function public.pode_criar_evento from public, anon;
grant execute on function public.pode_criar_evento to authenticated;

-- Catálogo inicial -----------------------------------------------------------

insert into public.categorias (nome, area_id, cor)
select c.nome, a.id, c.cor
from (values
  ('EBD', 'Ensino', '#2f6fb5'),
  ('Pequeno grupo', 'Ensino', '#2a9d8f'),
  ('Culto', 'Programação', '#6a4c93'),
  ('Ensaio de louvor', 'Louvor', '#c2407a'),
  ('Reunião de liderança', 'Geral', '#1d3557'),
  ('Postagem', 'Comunicação', '#e07a3f'),
  ('Evento extra', 'Programação', '#c9a227'),
  ('Acampamento', 'Acampamento', '#3a7d44'),
  ('Serviço', 'Programação', '#8d6e63')
) as c (nome, area, cor)
join public.areas a on a.nome = c.area;

insert into public.campos_das_categorias (categoria_id, nome, tipo, obrigatorio, opcoes, ordem)
select c.id, f.nome, f.tipo::public.tipo_de_campo, f.obrigatorio, f.opcoes, f.ordem
from (values
  ('EBD', 0, 'Tema', 'texto_curto', true, '{}'::text[]),
  ('EBD', 1, 'Professor', 'pessoa', false, '{}'),
  ('EBD', 2, 'Auxiliar', 'pessoa', false, '{}'),
  ('EBD', 3, 'Link do material', 'link', false, '{}'),
  ('Pequeno grupo', 0, 'Grupo', 'escolha', true, '{Grupo único}'),
  ('Pequeno grupo', 1, 'Anfitrião', 'texto_curto', false, '{}'),
  ('Pequeno grupo', 2, 'Tema', 'texto_curto', false, '{}'),
  ('Culto', 0, 'Quem prega', 'texto_curto', false, '{}'),
  ('Culto', 1, 'Observações da liturgia', 'texto_longo', false, '{}'),
  ('Ensaio de louvor', 0, 'Repertório', 'link', false, '{}'),
  ('Ensaio de louvor', 1, 'Observações', 'texto_longo', false, '{}'),
  ('Reunião de liderança', 0, 'Pauta', 'texto_longo', false, '{}'),
  ('Reunião de liderança', 1, 'Link da ata', 'link', false, '{}'),
  ('Postagem', 0, 'Plataforma', 'escolha', true, '{Instagram,WhatsApp,YouTube,Outra}'),
  ('Postagem', 1, 'Link da arte ou do post', 'link', false, '{}'),
  ('Evento extra', 0, 'Tipo', 'escolha', true, '{Gincana,Intercâmbio,Campeonato,Outro}'),
  ('Evento extra', 1, 'Parceiro', 'texto_curto', false, '{}'),
  ('Evento extra', 2, 'Valor', 'valor', false, '{}'),
  ('Evento extra', 3, 'Link de inscrição', 'link', false, '{}'),
  ('Evento extra', 4, 'O que levar', 'lista', true, '{}'),
  ('Acampamento', 0, 'Tema', 'texto_curto', false, '{}'),
  ('Acampamento', 1, 'Valor', 'valor', false, '{}'),
  ('Acampamento', 2, 'Link de inscrição', 'link', false, '{}'),
  ('Acampamento', 3, 'Link da autorização dos pais', 'link', false, '{}'),
  ('Acampamento', 4, 'Itens a levar', 'lista', false, '{}'),
  ('Acampamento', 5, 'Checklist', 'checklist', false, '{}'),
  ('Acampamento', 6, 'Anotações', 'texto_longo', false, '{}'),
  ('Acampamento', 7, 'Link dos materiais', 'link', false, '{}'),
  ('Serviço', 0, 'Descrição da ação', 'texto_longo', true, '{}')
) as f (categoria, ordem, nome, tipo, obrigatorio, opcoes)
join public.categorias c on c.nome = f.categoria;
