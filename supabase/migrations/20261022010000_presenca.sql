-- Presença na EBD (ticket 02 de .scratch/logs-presenca-ranking): a Chamada de cada aula, com Marcações configuráveis.
-- As regras espelham src/dominio/presenca.ts. Só acréscimos: tabelas novas, uma coluna com padrão em `categorias` e
-- outra em `configuracoes`; a única mudança de dado é ligar a chamada na Categoria EBD.

-- Categorias com chamada -----------------------------------------------------------

-- Quais Categorias têm Chamada; o Admin liga e desliga no catálogo. Começa ligada só na EBD.
alter table public.categorias add column tem_chamada boolean not null default false;
update public.categorias set tem_chamada = true where nome = 'EBD';
grant insert (tem_chamada), update (tem_chamada) on public.categorias to authenticated;

-- O alerta de ausência: quantas aulas seguidas sem presença.
alter table public.configuracoes
  add column faltas_para_alerta integer not null default 3 check (faltas_para_alerta between 1 and 52);
grant update (faltas_para_alerta) on public.configuracoes to authenticated;

-- Marcações -------------------------------------------------------------------------

-- O que se marca para cada Adolescente numa aula. Não se apagam (a presença guarda o histórico): desativam-se.
create table public.marcacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> '' and char_length(nome) <= 40),
  -- Um dos ícones de ICONES_DAS_MARCACOES em src/dominio/presenca.ts.
  icone text not null default 'check'
    check (icone in ('check', 'book-open', 'user-plus', 'pencil', 'star', 'music', 'heart', 'smile', 'award', 'hand-heart', 'sparkles', 'flame')),
  -- Pontos no ranking anual (ticket 03); vale também para o passado, porque o ranking é calculado na hora.
  pontos integer not null default 0 check (pontos between 0 and 100),
  ativa boolean not null default true,
  -- A Marcação que diz que o Adolescente veio; marcar qualquer outra marca esta junto. No máximo uma.
  conta_presenca boolean not null default false,
  -- Pede o nome do visitante (texto livre, opcional, e nada mais).
  pede_visitante boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create unique index marcacoes_nome_unico on public.marcacoes (lower(btrim(nome)));
create unique index marcacoes_uma_de_presenca on public.marcacoes (conta_presenca) where conta_presenca;

insert into public.marcacoes (nome, icone, pontos, conta_presenca, pede_visitante, ordem) values
  ('Presente', 'check', 1, true, false, 0),
  ('Trouxe bíblia', 'book-open', 1, false, false, 1),
  ('Trouxe visitante', 'user-plus', 3, false, true, 2),
  ('Fez atividade', 'pencil', 2, false, false, 3);

alter table public.marcacoes enable row level security;

create policy "a Liderança lê as Marcações" on public.marcacoes for select to authenticated
  using ((select public.e_lideranca()));

create policy "o Admin cria Marcações" on public.marcacoes for insert to authenticated
  with check ((select public.e_admin()));

create policy "o Admin edita Marcações" on public.marcacoes for update to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

revoke all on public.marcacoes from anon, authenticated;
grant select on public.marcacoes to authenticated;
grant insert (nome, icone, pontos, ativa, conta_presenca, pede_visitante, ordem),
  update (nome, icone, pontos, ativa, conta_presenca, pede_visitante, ordem)
  on public.marcacoes to authenticated;

-- Presenças ---------------------------------------------------------------------------

-- Um Adolescente numa aula. Sem Marcação nenhuma, é falta. Uma aula com chamada não pode ser excluída (o ranking
-- perderia pontos): cancela-se. O Adolescente inativado continua com o histórico.
create table public.presencas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete restrict,
  adolescente_id uuid not null references public.adolescentes (id),
  registrado_por uuid not null references public.perfis (id),
  registrado_em timestamptz not null default now(),
  editado_por uuid references public.perfis (id),
  editado_em timestamptz,
  unique (evento_id, adolescente_id)
);

create index presencas_adolescente on public.presencas (adolescente_id);

create table public.marcacoes_das_presencas (
  presenca_id uuid not null references public.presencas (id) on delete cascade,
  marcacao_id uuid not null references public.marcacoes (id),
  -- Só o nome do visitante, se quiserem anotar; nenhum outro dado dele.
  visitante text check (visitante is null or (btrim(visitante) <> '' and char_length(visitante) <= 80)),
  primary key (presenca_id, marcacao_id)
);

create index marcacoes_das_presencas_marcacao on public.marcacoes_das_presencas (marcacao_id);

alter table public.presencas enable row level security;
alter table public.marcacoes_das_presencas enable row level security;

-- Dados de menores: só a Liderança aprovada lê. Escrever, só por `salvar_presenca`.
create policy "a Liderança lê as presenças" on public.presencas for select to authenticated
  using ((select public.e_lideranca()));

create policy "a Liderança lê as Marcações das presenças" on public.marcacoes_das_presencas for select to authenticated
  using ((select public.e_lideranca()));

revoke all on public.presencas, public.marcacoes_das_presencas from anon, authenticated;
grant select on public.presencas, public.marcacoes_das_presencas to authenticated;

-- Chamada ---------------------------------------------------------------------------------

/**
 * Quem está logado pode fazer (e corrigir) a Chamada desta aula? O Admin e quem tem Função na Área da Categoria
 * (`pode_criar_evento`), numa Categoria com chamada, numa aula não Cancelada que já chegou ao dia (no fuso do Mural).
 * Mesma regra de podeFazerChamada.
 */
create function public.pode_fazer_chamada(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.tem_chamada
      and public.pode_criar_evento(e.categoria_id)
      and e.status <> 'cancelado'
      and (e.inicio at time zone 'America/Bahia')::date <= (now() at time zone 'America/Bahia')::date
    from public.eventos e
    join public.categorias c on c.id = e.categoria_id
    where e.id = pode_fazer_chamada.evento
  ), false);
$$;

revoke execute on function public.pode_fazer_chamada from public, anon;
grant execute on function public.pode_fazer_chamada to authenticated;

/**
 * Grava as Marcações de um Adolescente numa aula, de uma vez (o que não vier é desmarcado). Marcar qualquer Marcação
 * marca também a de presença. As Marcações desativadas que já estavam ficam como estão. O nome do visitante só vale com
 * uma Marcação que o pede. Guarda quem registrou e quem corrigiu por último, e grava o log:
 * - no dia da aula, a chamada é "registrada": um log por pessoa e aula naquele dia, sem um por toque;
 * - depois do dia, cada mudança é uma "correção", com o Adolescente e as Marcações de antes e depois.
 * Mesma regra de marcacoesASalvar e tipoDeRegistroDaChamada.
 */
create function public.salvar_presenca(evento uuid, adolescente uuid, marcacoes uuid[], visitante text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  aula public.eventos;
  aluno public.adolescentes;
  presenca public.presencas;
  nova boolean;
  escolhidas uuid[] := array(select distinct m from unnest(coalesce(salvar_presenca.marcacoes, '{}')) m where m is not null);
  antes text[];
  depois text[];
  nome_do_visitante text := nullif(btrim(coalesce(salvar_presenca.visitante, '')), '');
  dia_da_aula date;
  hoje date := (now() at time zone 'America/Bahia')::date;
begin
  if eu is null or not public.pode_fazer_chamada(evento) then
    raise exception 'sem permissão para fazer a chamada desta aula' using errcode = '42501';
  end if;
  select * into aula from public.eventos e where e.id = salvar_presenca.evento;
  select * into aluno from public.adolescentes a where a.id = salvar_presenca.adolescente;
  if not found or not aluno.ativo then
    raise exception 'Adolescente inativo ou inexistente' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(escolhidas) m where not exists (select 1 from public.marcacoes x where x.id = m and x.ativa)) then
    raise exception 'Marcação inativa ou inexistente' using errcode = 'P0001';
  end if;
  if cardinality(escolhidas) > 0 then
    escolhidas := escolhidas || array(
      select x.id from public.marcacoes x where x.conta_presenca and x.ativa and x.id <> all (escolhidas)
    );
  end if;
  if nome_do_visitante is not null and (
    char_length(nome_do_visitante) > 80
    or not exists (select 1 from public.marcacoes x where x.id = any (escolhidas) and x.pede_visitante)
  ) then
    raise exception 'nome de visitante sem a Marcação de visitante' using errcode = 'P0001';
  end if;

  select * into presenca from public.presencas p where p.evento_id = aula.id and p.adolescente_id = aluno.id for update;
  antes := array(
    select x.nome from public.marcacoes_das_presencas mp join public.marcacoes x on x.id = mp.marcacao_id
    where mp.presenca_id = presenca.id order by x.ordem, x.nome
  );

  nova := presenca.id is null;
  if nova then
    if cardinality(escolhidas) = 0 then
      return;
    end if;
    insert into public.presencas (evento_id, adolescente_id, registrado_por)
    values (aula.id, aluno.id, eu)
    returning * into presenca;
  end if;

  -- Só as ativas são trocadas; as desativadas que já estavam ficam.
  delete from public.marcacoes_das_presencas mp
  using public.marcacoes x
  where mp.presenca_id = presenca.id and x.id = mp.marcacao_id and x.ativa and mp.marcacao_id <> all (escolhidas);
  insert into public.marcacoes_das_presencas (presenca_id, marcacao_id, visitante)
  select presenca.id, m, case when x.pede_visitante then nome_do_visitante end
  from unnest(escolhidas) m join public.marcacoes x on x.id = m
  on conflict (presenca_id, marcacao_id) do update set visitante = excluded.visitante;

  depois := array(
    select x.nome from public.marcacoes_das_presencas mp join public.marcacoes x on x.id = mp.marcacao_id
    where mp.presenca_id = presenca.id order by x.ordem, x.nome
  );
  if not nova then
    update public.presencas set editado_por = eu, editado_em = now() where id = presenca.id;
  end if;
  -- Só o nome do visitante mudou, ou nada: ele não vai para o log.
  if antes = depois then
    return;
  end if;

  dia_da_aula := (aula.inicio at time zone 'America/Bahia')::date;
  if hoje > dia_da_aula then
    perform public.gravar_log(
      'presenca.chamada_corrigida', 'evento', aula.id::text, aula.titulo,
      jsonb_build_object(
        'categoria', (select c.nome from public.categorias c where c.id = aula.categoria_id),
        'inicio', aula.inicio, 'dia_inteiro', aula.dia_inteiro, 'adolescente', aluno.nome,
        'mudancas', jsonb_build_array(jsonb_build_object('rotulo', aluno.nome, 'tipo', 'lista', 'antes', to_jsonb(antes), 'depois', to_jsonb(depois)))
      )
    );
  elsif not exists (
    select 1 from public.logs l
    where l.acao = 'presenca.chamada_registrada' and l.objeto_id = aula.id::text and l.usuario_id = eu
      and (l.feito_em at time zone 'America/Bahia')::date = hoje
  ) then
    perform public.gravar_log(
      'presenca.chamada_registrada', 'evento', aula.id::text, aula.titulo,
      jsonb_build_object(
        'categoria', (select c.nome from public.categorias c where c.id = aula.categoria_id),
        'inicio', aula.inicio, 'dia_inteiro', aula.dia_inteiro
      )
    );
  end if;
end;
$$;

revoke execute on function public.salvar_presenca from public, anon;
grant execute on function public.salvar_presenca to authenticated;

-- Logs ----------------------------------------------------------------------------------

/** Marcação criada, editada, desativada e reativada; a pontuação tem log próprio, do ranking. */
create function public.log_da_marcacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mudancas jsonb := '[]';
begin
  if tg_op = 'INSERT' then
    perform public.gravar_log('marcacao.criada', 'marcacao', new.id::text, new.nome, jsonb_build_object('pontos', new.pontos));
    return null;
  end if;

  if new.pontos is distinct from old.pontos then
    perform public.gravar_log(
      'ranking.pontuacao_alterada', 'marcacao', new.id::text, new.nome,
      jsonb_build_object('antes', old.pontos, 'depois', new.pontos)
    );
  end if;
  if new.ativa is distinct from old.ativa then
    perform public.gravar_log(case when new.ativa then 'marcacao.reativada' else 'marcacao.desativada' end, 'marcacao', new.id::text, new.nome);
  end if;

  if new.nome is distinct from old.nome then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Nome', 'tipo', 'texto', 'antes', old.nome, 'depois', new.nome);
  end if;
  if new.icone is distinct from old.icone then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Ícone', 'tipo', 'texto', 'antes', old.icone, 'depois', new.icone);
  end if;
  if new.conta_presenca is distinct from old.conta_presenca then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Conta como presença', 'tipo', 'booleano', 'antes', old.conta_presenca, 'depois', new.conta_presenca);
  end if;
  if new.pede_visitante is distinct from old.pede_visitante then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Pede o nome do visitante', 'tipo', 'booleano', 'antes', old.pede_visitante, 'depois', new.pede_visitante);
  end if;
  if new.ordem is distinct from old.ordem then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Ordem', 'tipo', 'texto', 'antes', old.ordem, 'depois', new.ordem);
  end if;
  if jsonb_array_length(mudancas) > 0 then
    perform public.gravar_log('marcacao.editada', 'marcacao', new.id::text, new.nome, jsonb_build_object('mudancas', mudancas));
  end if;
  return null;
end;
$$;

create trigger ao_alterar_marcacao
  after insert or update on public.marcacoes
  for each row execute function public.log_da_marcacao();

/** A mesma `log_do_catalogo` dos Logs, agora com a chamada ligada ou desligada na Categoria. */
create or replace function public.log_do_catalogo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}' end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}' end;
  linha jsonb := case when tg_op = 'DELETE' then antes else depois end;
  mudancas jsonb;
begin
  -- `area_id` vira o nome da Área; `categoria_id` e `ordem` não interessam a quem lê.
  select coalesce(jsonb_agg(jsonb_build_object(
      'rotulo', case chave when 'nome' then 'Nome' when 'area_id' then 'Área' when 'cor' then 'Cor' when 'tipo' then 'Tipo'
        when 'obrigatorio' then 'Obrigatório' when 'opcoes' then 'Opções' when 'tem_chamada' then 'Tem chamada' else chave end,
      'tipo', case chave when 'obrigatorio' then 'booleano' when 'tem_chamada' then 'booleano' when 'opcoes' then 'lista' else 'texto' end,
      'antes', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = antes ->> chave) else coalesce(antes -> chave, 'null') end,
      'depois', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = depois ->> chave) else coalesce(depois -> chave, 'null') end
    )), '[]')
  into mudancas
  from jsonb_object_keys(antes || depois) chave
  where chave in ('nome', 'area_id', 'cor', 'tipo', 'obrigatorio', 'opcoes', 'tem_chamada')
    and tg_op = 'UPDATE'
    and (antes -> chave) is distinct from (depois -> chave);

  if tg_op = 'UPDATE' and mudancas = '[]' then
    return null;
  end if;

  if tg_table_name = 'funcoes' then
    perform public.gravar_log(
      case tg_op when 'INSERT' then 'funcao.criada' else 'funcao.editada' end,
      'funcao', linha ->> 'id', linha ->> 'nome',
      jsonb_build_object('area', (select a.nome from public.areas a where a.id::text = linha ->> 'area_id'), 'mudancas', mudancas)
    );
  elsif tg_table_name = 'categorias' then
    perform public.gravar_log(
      case tg_op when 'INSERT' then 'categoria.criada' else 'categoria.editada' end,
      'categoria', linha ->> 'id', linha ->> 'nome',
      jsonb_build_object('area', (select a.nome from public.areas a where a.id::text = linha ->> 'area_id'), 'mudancas', mudancas)
    );
  else
    perform public.gravar_log(
      case tg_op when 'INSERT' then 'categoria.campo_adicionado' when 'UPDATE' then 'categoria.campo_editado' else 'categoria.campo_removido' end,
      'categoria', linha ->> 'categoria_id',
      (select c.nome from public.categorias c where c.id::text = linha ->> 'categoria_id'),
      jsonb_build_object('campo', linha ->> 'nome', 'mudancas', mudancas)
    );
  end if;
  return null;
end;
$$;

-- Reverter --------------------------------------------------------------------------
-- Apaga a presença registrada desde o deploy; exporte antes, se precisar guardar.
--
-- drop trigger ao_alterar_marcacao on public.marcacoes;
-- drop function public.log_da_marcacao, public.salvar_presenca, public.pode_fazer_chamada;
-- drop table public.marcacoes_das_presencas, public.presencas, public.marcacoes;
-- alter table public.configuracoes drop column faltas_para_alerta;
-- alter table public.categorias drop column tem_chamada;
-- (e recriar `log_do_catalogo` como em 20261022000000_logs.sql)
