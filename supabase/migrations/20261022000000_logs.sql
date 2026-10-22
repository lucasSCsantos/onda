-- Logs do sistema (ticket 01 de .scratch/logs-presenca-ranking): quem fez o quê, quando e com qual resultado.
-- As frases, os textos e os filtros da tela ficam em src/dominio/logs.ts; aqui ficam a tabela, a gravação e o acesso.
--
-- Só de inserção: ninguém tem permissão de escrita na tabela, e um gatilho recusa edição e exclusão (a não ser a
-- limpeza da retenção). As gravações vêm de dois lugares:
-- - gatilhos nas tabelas principais (Eventos, Séries, Adolescentes, contas, convites, Funções, catálogo,
--   configurações e exportações), para que alterações feitas fora da interface também fiquem registradas;
-- - a RPC `registrar_log`, para o que não passa pelo banco (entrar, sair, senha) e para as falhas, que o banco não
--   consegue gravar porque a transação que falha é desfeita junto com o log.
-- Uma falha ao gravar o log nunca derruba a ação: `gravar_log` engole o erro e só deixa um aviso no Postgres.
-- Nunca vão para o log: senhas, tokens, chaves, e-mail e data de nascimento (de ninguém). Do Adolescente fica só o
-- nome, como rótulo; da data de nascimento, só que ela mudou.

-- Configurações --------------------------------------------------------------

-- Uma linha só, com o que o Admin ajusta sem mexer em código. As próximas fases acrescentam colunas.
create table public.configuracoes (
  id boolean primary key default true check (id),
  retencao_dos_logs_meses integer not null default 12 check (retencao_dos_logs_meses between 1 and 120),
  -- Opcional: o líder vê, dentro do Evento, o histórico dos Eventos que ele pode editar.
  lideres_veem_historico_do_evento boolean not null default false,
  -- Quando os logs entraram no ar; o que aconteceu antes não foi registrado.
  logs_desde timestamptz not null default now(),
  editado_por uuid references public.perfis (id) on delete set null,
  editado_em timestamptz
);

insert into public.configuracoes default values;

alter table public.configuracoes enable row level security;

create policy "a Liderança lê as configurações" on public.configuracoes for select to authenticated
  using ((select public.e_lideranca()));

create policy "o Admin edita as configurações" on public.configuracoes for update to authenticated
  using ((select public.e_admin()))
  with check ((select public.e_admin()));

revoke all on public.configuracoes from anon, authenticated;
grant select on public.configuracoes to authenticated;
grant update (retencao_dos_logs_meses, lideres_veem_historico_do_evento) on public.configuracoes to authenticated;

create function public.carimbar_configuracoes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.editado_por := (select auth.uid());
  new.editado_em := now();
  return new;
end;
$$;

create trigger ao_editar_configuracoes
  before update on public.configuracoes
  for each row execute function public.carimbar_configuracoes();

-- Tabela ---------------------------------------------------------------------

create table public.logs (
  id bigint generated always as identity primary key,
  feito_em timestamptz not null default now(),
  -- Sem chave estrangeira: o log fica mesmo quando a conta é apagada (recusa de Pendente). Nulo é o próprio Mural
  -- (agendamentos, banco) ou alguém que não entrou (tentativa de login).
  usuario_id uuid,
  -- O nome no momento da ação.
  usuario_nome text,
  -- Código padronizado `modulo.acao`, como `evento.criado`; os textos de cada um estão em src/dominio/logs.ts.
  acao text not null check (acao ~ '^[a-z_]+\.[a-z_]+$'),
  modulo text not null check (modulo in ('contas', 'eventos', 'adolescentes', 'presenca', 'ranking', 'administracao')),
  objeto_tipo text,
  objeto_id text,
  -- Rótulo legível do objeto no momento da ação, como o título do Evento.
  objeto_rotulo text,
  resultado text not null default 'sucesso' check (resultado in ('sucesso', 'falha')),
  severidade text not null default 'info' check (severidade in ('info', 'aviso', 'erro')),
  -- Campos alterados (`mudancas`, com rótulo, tipo, valor anterior e novo, já sem dados proibidos) e o contexto.
  detalhes jsonb not null default '{}' check (jsonb_typeof(detalhes) = 'object'),
  origem text not null check (origem in ('interface', 'sistema'))
);

create index logs_feito_em on public.logs (feito_em desc, id desc);
create index logs_usuario on public.logs (usuario_id, feito_em desc);
create index logs_acao on public.logs (acao, feito_em desc);
create index logs_modulo on public.logs (modulo, feito_em desc);
create index logs_objeto on public.logs (objeto_tipo, objeto_id, feito_em desc);
create index logs_alertas on public.logs (feito_em desc, id desc) where resultado = 'falha' or severidade <> 'info';

/** O módulo de uma ação, pelo prefixo do código. */
create function public.modulo_da_acao(acao text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case split_part(acao, '.', 1)
    when 'acesso' then 'contas'
    when 'conta' then 'contas'
    when 'convite' then 'contas'
    when 'evento' then 'eventos'
    when 'serie' then 'eventos'
    when 'adolescente' then 'adolescentes'
    when 'presenca' then 'presenca'
    when 'marcacao' then 'presenca'
    when 'ranking' then 'ranking'
    else 'administracao'
  end;
$$;

/**
 * Grava um log. Quem fez é `usuario` ou, sem ele, quem está logado; a origem é a interface quando a ação veio de uma
 * sessão do app (anônima ou não) e o sistema quando veio de um agendamento, do banco ou da chave de serviço.
 * Nunca falha: se o log não puder ser gravado, a ação que o chamou segue.
 */
create function public.gravar_log(
  acao text,
  objeto_tipo text default null,
  objeto_id text default null,
  objeto_rotulo text default null,
  detalhes jsonb default '{}',
  resultado text default 'sucesso',
  severidade text default 'info',
  usuario uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := coalesce(gravar_log.usuario, (select auth.uid()));
  papel text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  insert into public.logs (usuario_id, usuario_nome, acao, modulo, objeto_tipo, objeto_id, objeto_rotulo, resultado, severidade, detalhes, origem)
  values (
    quem,
    (select nullif(btrim(p.nome), '') from public.perfis p where p.id = quem),
    gravar_log.acao,
    public.modulo_da_acao(gravar_log.acao),
    gravar_log.objeto_tipo,
    gravar_log.objeto_id,
    gravar_log.objeto_rotulo,
    gravar_log.resultado,
    gravar_log.severidade,
    coalesce(gravar_log.detalhes, '{}'),
    case when papel in ('anon', 'authenticated') then 'interface' else 'sistema' end
  );
exception when others then
  raise warning 'log % não gravado: %', gravar_log.acao, sqlerrm;
end;
$$;

revoke execute on function public.gravar_log from public, anon, authenticated;

-- Só de inserção --------------------------------------------------------------

/** Ninguém edita nem apaga log; só a limpeza da retenção (`limpar_logs`) apaga os antigos. */
create function public.proteger_logs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('onda.limpando_logs', true) = 'sim' then
    return old;
  end if;
  raise exception 'os logs não podem ser alterados nem apagados' using errcode = '42501';
end;
$$;

create trigger proteger_logs
  before update or delete on public.logs
  for each row execute function public.proteger_logs();

create trigger proteger_logs_de_truncate
  before truncate on public.logs
  for each statement execute function public.proteger_logs();

alter table public.logs enable row level security;

create policy "o Admin lê os logs" on public.logs for select to authenticated
  using ((select public.e_admin()));

/**
 * Se o Admin ligar, o líder lê o histórico dos Eventos que pode editar (e o da Série deles), dentro do Evento. Mesma
 * regra de podeVerHistoricoDoEvento.
 */
create function public.pode_ver_historico(objeto_tipo text, objeto_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.lideres_veem_historico_do_evento from public.configuracoes c), false)
    and public.e_lideranca()
    and exists (
      select 1
      from public.eventos e
      where (pode_ver_historico.objeto_tipo = 'evento' and e.id::text = pode_ver_historico.objeto_id)
         or (pode_ver_historico.objeto_tipo = 'serie' and e.serie_id::text = pode_ver_historico.objeto_id)
      having bool_or(public.pode_editar_evento(e.categoria_id, e.responsavel_id))
    );
$$;

revoke execute on function public.pode_ver_historico from public, anon;
grant execute on function public.pode_ver_historico to authenticated;

create policy "o líder lê o histórico dos Eventos que edita, se o Admin ligar" on public.logs for select to authenticated
  using (objeto_tipo in ('evento', 'serie') and public.pode_ver_historico(objeto_tipo, objeto_id));

revoke all on public.logs from anon, authenticated;
grant select on public.logs to authenticated;

-- Lotes ----------------------------------------------------------------------

-- Uma operação que mexe em várias linhas (criar uma Série, aprovar uma conta com a Função) vira um log só. Quem
-- grava o resumo marca o lote numa variável da transação, e os gatilhos de cada linha pulam o que já foi contado.

create function public.no_lote(chave text, valor text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(no_lote.valor = any (string_to_array(nullif(current_setting('onda.' || no_lote.chave, true), ''), ' ')), false);
$$;

create function public.marcar_no_lote(chave text, valor text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config(
    'onda.' || marcar_no_lote.chave,
    concat_ws(' ', nullif(current_setting('onda.' || marcar_no_lote.chave, true), ''), marcar_no_lote.valor),
    true
  );
end;
$$;

revoke execute on function public.no_lote, public.marcar_no_lote from public, anon, authenticated;

-- Eventos e Séries ------------------------------------------------------------

/**
 * As mudanças de um Evento em linguagem de gente, a partir do diff do registro de alterações: o rótulo de cada coluna
 * e de cada campo específico (pelo nome que tem na Categoria), o tipo (para a tela formatar o valor) e os valores,
 * com as pessoas já trocadas pelo nome.
 */
create function public.mudancas_do_evento(mudancas jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with fixas (chave, rotulo, tipo, ordem) as (
    values ('titulo', 'Título', 'texto', 1), ('inicio', 'Início', 'instante', 2), ('fim', 'Fim', 'instante', 3),
      ('dia_inteiro', 'Dia inteiro', 'booleano', 4), ('local', 'Local', 'texto', 5),
      ('responsavel_id', 'Responsável', 'pessoa', 6), ('status', 'Status', 'status', 7),
      ('observacoes', 'Observações', 'texto', 8), ('link', 'Link', 'link', 9)
  ),
  especificos as (
    select k as chave, mudancas #> array['campos', 'antes', k] as antes, mudancas #> array['campos', 'depois', k] as depois
    from jsonb_object_keys(
      case when jsonb_typeof(mudancas #> '{campos,antes}') = 'object' then mudancas #> '{campos,antes}' else '{}' end
      || case when jsonb_typeof(mudancas #> '{campos,depois}') = 'object' then mudancas #> '{campos,depois}' else '{}' end
    ) k
  ),
  nome (id, valor) as (select p.id::text, to_jsonb(p.nome) from public.perfis p),
  itens as (
    select f.ordem, f.rotulo, f.tipo,
      case when f.tipo = 'pessoa' then (select n.valor from nome n where n.id = mudancas #>> array[f.chave, 'antes']) else mudancas #> array[f.chave, 'antes'] end as antes,
      case when f.tipo = 'pessoa' then (select n.valor from nome n where n.id = mudancas #>> array[f.chave, 'depois']) else mudancas #> array[f.chave, 'depois'] end as depois
    from fixas f
    where mudancas ? f.chave
    union all
    select 100 + coalesce(c.ordem, 0), coalesce(c.nome, 'Campo removido da Categoria'), coalesce(c.tipo::text, 'texto'),
      case when c.tipo = 'pessoa' then (select n.valor from nome n where n.id = e.antes #>> '{}') else e.antes end,
      case when c.tipo = 'pessoa' then (select n.valor from nome n where n.id = e.depois #>> '{}') else e.depois end
    from especificos e
    left join public.campos_das_categorias c on c.id::text = e.chave
    where e.antes is distinct from e.depois
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('rotulo', rotulo, 'tipo', tipo, 'antes', coalesce(antes, 'null'), 'depois', coalesce(depois, 'null')) order by ordem, rotulo),
    '[]'
  )
  from itens;
$$;

revoke execute on function public.mudancas_do_evento from public, anon, authenticated;

/**
 * Um log para cada linha do registro de alterações dos Eventos (`alteracoes_dos_eventos`), que já guarda o diff.
 * Assim o registro antigo e o log nunca divergem. As Ocorrências de uma operação de Série viram o log da Série.
 */
create function public.log_da_alteracao_do_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := new.mudancas;
  atual public.eventos;
  serie text;
  categoria_id text;
  edicao jsonb := nullif(current_setting('onda.serie_em_edicao', true), '')::jsonb;
  chaves text[];
  acao text;
  detalhes jsonb;
begin
  select * into atual from public.eventos e where e.id = new.evento_id;
  serie := coalesce(atual.serie_id::text, m #>> '{serie_id,depois}', m #>> '{serie_id,antes}');
  categoria_id := coalesce(atual.categoria_id::text, m #>> '{categoria_id,depois}', m #>> '{categoria_id,antes}');

  if serie is not null and public.no_lote('serie_em_lote', serie) then
    return null;
  end if;

  detalhes := jsonb_build_object(
    'categoria', (select c.nome from public.categorias c where c.id::text = categoria_id),
    'inicio', coalesce(to_jsonb(atual.inicio), m #> '{inicio,antes}'),
    'dia_inteiro', coalesce(to_jsonb(atual.dia_inteiro), m #> '{dia_inteiro,antes}'),
    'serie_id', serie
  );

  if new.operacao = 'edicao' then
    detalhes := detalhes || jsonb_build_object('mudancas', public.mudancas_do_evento(m));
  end if;

  -- Edição de Série (`editar_serie`): a primeira Ocorrência que muda grava o log da Série, e as outras são puladas.
  if serie is not null and edicao ->> 'serie' = serie then
    perform public.marcar_no_lote('serie_em_lote', serie);
    perform public.gravar_log(
      'serie.editada', 'serie', serie, coalesce(atual.titulo, m #>> '{titulo,antes}'),
      detalhes || jsonb_build_object('escopo', edicao ->> 'escopo', 'ocorrencias', (edicao ->> 'ocorrencias')::integer)
    );
    return null;
  end if;

  chaves := array(select k from jsonb_object_keys(m) k where k not in ('editada', 'editado_por', 'editado_em'));
  acao := case
    when new.operacao = 'criacao' then 'evento.criado'
    when new.operacao = 'exclusao' then 'evento.excluido'
    when m #>> '{status,depois}' = 'cancelado' then 'evento.cancelado'
    when chaves = array['status'] then 'evento.status_alterado'
    else 'evento.editado'
  end;

  perform public.gravar_log(
    acao, 'evento', new.evento_id::text,
    coalesce(atual.titulo, m #>> '{titulo,depois}', m #>> '{titulo,antes}'),
    detalhes,
    usuario => new.feito_por
  );
  return null;
end;
$$;

create trigger ao_registrar_alteracao_do_evento
  after insert on public.alteracoes_dos_eventos
  for each row execute function public.log_da_alteracao_do_evento();

/**
 * Grava várias Ocorrências de uma Série de uma vez, como `editar_eventos` (com as permissões de quem chama), e um log
 * só para a operação, com o escopo e quantas Ocorrências foram alteradas. `escopo` é o de EscopoDeEdicao, ou
 * `cancelar_futuras`.
 */
create function public.editar_serie(serie uuid, escopo text, alteracoes jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if escopo not in ('esta', 'esta_e_seguintes', 'toda', 'cancelar_futuras') then
    raise exception 'escopo desconhecido' using errcode = 'P0001';
  end if;
  perform set_config(
    'onda.serie_em_edicao',
    jsonb_build_object('serie', serie, 'escopo', escopo, 'ocorrencias', jsonb_array_length(alteracoes))::text,
    true
  );
  perform public.editar_eventos(alteracoes);
  perform set_config('onda.serie_em_edicao', '', true);
end;
$$;

revoke execute on function public.editar_serie from public, anon;
grant execute on function public.editar_serie to authenticated;

/** Título e Categoria de uma Série, pela primeira Ocorrência. */
create function public.rotulo_da_serie(serie uuid)
returns table (titulo text, categoria text, ocorrencias integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select e.titulo from public.eventos e where e.serie_id = rotulo_da_serie.serie order by e.inicio limit 1),
    (select c.nome from public.series s join public.categorias c on c.id = s.categoria_id where s.id = rotulo_da_serie.serie),
    (select count(*)::integer from public.eventos e where e.serie_id = rotulo_da_serie.serie);
$$;

revoke execute on function public.rotulo_da_serie from public, anon, authenticated;

/** Ao criar a Série, as Ocorrências que nascem com ela não ganham um log cada; o resumo sai no fim da transação. */
create function public.marcar_serie_nova()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.marcar_no_lote('serie_em_lote', new.id::text);
  return null;
end;
$$;

create trigger ao_criar_serie
  after insert on public.series
  for each row execute function public.marcar_serie_nova();

create function public.log_da_serie_criada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rotulo record;
begin
  select * into rotulo from public.rotulo_da_serie(new.id);
  perform public.gravar_log(
    'serie.criada', 'serie', new.id::text, rotulo.titulo,
    jsonb_build_object('categoria', rotulo.categoria, 'ocorrencias', rotulo.ocorrencias, 'regra', new.regra, 'serie_id', new.id)
  );
  return null;
end;
$$;

-- No fim da transação, quando as Ocorrências já existem e dá para contá-las.
create constraint trigger log_da_serie_criada
  after insert on public.series
  deferrable initially deferred
  for each row execute function public.log_da_serie_criada();

/** Encerrar e excluir a Série: um log, e as Ocorrências canceladas ou excluídas junto não ganham um cada. */
create function public.log_da_serie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rotulo record;
begin
  select * into rotulo from public.rotulo_da_serie(old.id);
  if tg_op = 'DELETE' then
    perform public.marcar_no_lote('serie_em_lote', old.id::text);
    perform public.gravar_log(
      'serie.excluida', 'serie', old.id::text, rotulo.titulo,
      jsonb_build_object('categoria', rotulo.categoria, 'ocorrencias', rotulo.ocorrencias, 'serie_id', old.id)
    );
    return old;
  end if;

  if new.encerrada_em is distinct from old.encerrada_em then
    perform public.marcar_no_lote('serie_em_lote', new.id::text);
    perform public.gravar_log(
      'serie.encerrada', 'serie', new.id::text, rotulo.titulo,
      jsonb_build_object('categoria', rotulo.categoria, 'encerrada_em', new.encerrada_em, 'serie_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Antes de excluir: as Ocorrências saem em cascata depois, e precisam achar o lote marcado.
create trigger ao_excluir_serie
  before delete on public.series
  for each row execute function public.log_da_serie();

create trigger ao_encerrar_serie
  after update of encerrada_em on public.series
  for each row execute function public.log_da_serie();

-- Adolescentes ----------------------------------------------------------------

/** Do Adolescente vai só o nome, como rótulo; da data de nascimento, só que mudou (sem os valores). */
create function public.log_do_adolescente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mudancas jsonb := '[]';
begin
  if tg_op = 'INSERT' then
    perform public.gravar_log('adolescente.cadastrado', 'adolescente', new.id::text, new.nome);
    return null;
  end if;

  if new.nome is distinct from old.nome then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Nome', 'tipo', 'texto', 'antes', old.nome, 'depois', new.nome);
  end if;
  if new.nascimento is distinct from old.nascimento then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Data de nascimento', 'tipo', 'oculto');
  end if;
  if jsonb_array_length(mudancas) > 0 then
    perform public.gravar_log('adolescente.editado', 'adolescente', new.id::text, new.nome, jsonb_build_object('mudancas', mudancas));
  end if;

  if new.ativo is distinct from old.ativo then
    perform public.gravar_log(
      case when new.ativo then 'adolescente.reativado' else 'adolescente.inativado' end,
      'adolescente', new.id::text, new.nome
    );
  end if;
  return null;
end;
$$;

create trigger ao_alterar_adolescente
  after insert or update on public.adolescentes
  for each row execute function public.log_do_adolescente();

-- Contas ------------------------------------------------------------------------

/** Nível e Funções de uma pessoa, para os logs de cadastro e aprovação. */
create function public.acesso_da_pessoa(pessoa uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nivel', (select p.nivel from public.perfis p where p.id = acesso_da_pessoa.pessoa),
    'funcoes', coalesce((
      select jsonb_agg(f.nome order by f.nome)
      from public.funcoes_das_pessoas fp join public.funcoes f on f.id = fp.funcao_id
      where fp.pessoa_id = acesso_da_pessoa.pessoa
    ), '[]')
  );
$$;

revoke execute on function public.acesso_da_pessoa from public, anon, authenticated;

/**
 * Cadastro, aprovação, mudança de nível, desativação e recusa. O e-mail e a data de nascimento nunca entram: deles,
 * só que mudaram. O cadastro (com o convite, o nível e a Função dele) e a aprovação (com a Função) saem no fim da
 * transação, num log só; até lá, os gatilhos de Função e de convite pulam essa pessoa.
 */
create function public.log_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mudancas jsonb := '[]';
begin
  if tg_op = 'INSERT' then
    perform public.marcar_no_lote('conta_nova', new.id::text);
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.gravar_log(
      case when old.nivel = 'pendente' then 'conta.recusada' else 'conta.excluida' end,
      'conta', old.id::text, nullif(btrim(old.nome), '')
    );
    return null;
  end if;

  if new.nivel is distinct from old.nivel and not public.no_lote('conta_nova', new.id::text) then
    if old.nivel = 'pendente' then
      perform public.marcar_no_lote('conta_aprovada', new.id::text);
    else
      perform public.gravar_log(
        'conta.nivel_alterado', 'conta', new.id::text, nullif(btrim(new.nome), ''),
        jsonb_build_object('antes', old.nivel, 'depois', new.nivel)
      );
    end if;
  end if;

  if new.ativo is distinct from old.ativo then
    perform public.gravar_log(
      case when new.ativo then 'conta.reativada' else 'conta.desativada' end,
      'conta', new.id::text, nullif(btrim(new.nome), '')
    );
  end if;

  if new.nome is distinct from old.nome then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Nome', 'tipo', 'texto', 'antes', old.nome, 'depois', new.nome);
  end if;
  if new.email is distinct from old.email then
    mudancas := mudancas || jsonb_build_object('rotulo', 'E-mail', 'tipo', 'oculto');
  end if;
  if new.data_nascimento is distinct from old.data_nascimento then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Data de nascimento', 'tipo', 'oculto');
  end if;
  if jsonb_array_length(mudancas) > 0 and not public.no_lote('conta_nova', new.id::text) then
    perform public.gravar_log('conta.editada', 'conta', new.id::text, nullif(btrim(new.nome), ''), jsonb_build_object('mudancas', mudancas));
  end if;
  return null;
end;
$$;

create trigger ao_alterar_perfil
  after insert or update or delete on public.perfis
  for each row execute function public.log_do_perfil();

/** No fim da transação: a conta nova (com ou sem convite) e a aprovação, já com nível e Funções. */
create function public.log_da_conta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.gravar_log(
      case when exists (select 1 from public.convites c where c.usado_por = new.id) then 'convite.usado' else 'conta.cadastrada' end,
      'conta', new.id::text, nullif(btrim(new.nome), ''),
      public.acesso_da_pessoa(new.id),
      usuario => coalesce((select auth.uid()), new.id)
    );
  elsif public.no_lote('conta_aprovada', new.id::text) and not public.no_lote('conta_nova', new.id::text) then
    perform public.gravar_log('conta.aprovada', 'conta', new.id::text, nullif(btrim(new.nome), ''), public.acesso_da_pessoa(new.id));
  end if;
  return null;
end;
$$;

create constraint trigger log_da_conta_nova
  after insert on public.perfis
  deferrable initially deferred
  for each row execute function public.log_da_conta();

create constraint trigger log_da_conta_aprovada
  after update on public.perfis
  deferrable initially deferred
  for each row
  when (old.nivel = 'pendente' and new.nivel <> 'pendente')
  execute function public.log_da_conta();

create function public.log_da_funcao_da_pessoa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha public.funcoes_das_pessoas := case when tg_op = 'INSERT' then new else old end;
begin
  if public.no_lote('conta_nova', linha.pessoa_id::text) or public.no_lote('conta_aprovada', linha.pessoa_id::text) then
    return null;
  end if;
  perform public.gravar_log(
    case when tg_op = 'INSERT' then 'conta.funcao_adicionada' else 'conta.funcao_removida' end,
    'conta', linha.pessoa_id::text,
    (select nullif(btrim(p.nome), '') from public.perfis p where p.id = linha.pessoa_id),
    jsonb_build_object('funcao', (select f.nome from public.funcoes f where f.id = linha.funcao_id))
  );
  return null;
end;
$$;

create trigger ao_alterar_funcao_da_pessoa
  after insert or delete on public.funcoes_das_pessoas
  for each row execute function public.log_da_funcao_da_pessoa();

-- Convites ----------------------------------------------------------------------

/** Criado e revogado. O uso sai junto com o cadastro (`log_da_conta`); o vencimento, do agendamento abaixo. */
create function public.log_do_convite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  detalhes jsonb := jsonb_build_object(
    'nivel', new.nivel,
    'funcao', (select f.nome from public.funcoes f where f.id = new.funcao_id),
    'expira_em', new.expira_em
  );
begin
  if tg_op = 'INSERT' then
    perform public.gravar_log('convite.criado', 'convite', new.id::text, null, detalhes);
  elsif new.revogado_em is not null and old.revogado_em is null then
    perform public.gravar_log('convite.revogado', 'convite', new.id::text, null, detalhes);
  end if;
  return null;
end;
$$;

create trigger ao_alterar_convite
  after insert or update on public.convites
  for each row execute function public.log_do_convite();

/** Registra os convites que venceram sem uso desde a última passada. Roda pelo agendamento. */
create function public.registrar_convites_vencidos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  convite public.convites;
  quantos integer := 0;
begin
  for convite in
    select * from public.convites c
    where c.expira_em <= now() and c.usado_em is null and c.revogado_em is null
      and c.expira_em >= (select cf.logs_desde from public.configuracoes cf)
      and not exists (select 1 from public.logs l where l.objeto_tipo = 'convite' and l.objeto_id = c.id::text and l.acao = 'convite.expirado')
  loop
    perform public.gravar_log(
      'convite.expirado', 'convite', convite.id::text, null,
      jsonb_build_object('nivel', convite.nivel, 'funcao', (select f.nome from public.funcoes f where f.id = convite.funcao_id), 'expira_em', convite.expira_em)
    );
    quantos := quantos + 1;
  end loop;
  return quantos;
end;
$$;

revoke execute on function public.registrar_convites_vencidos from public, anon, authenticated;
grant execute on function public.registrar_convites_vencidos to service_role;

select cron.schedule('registrar-convites-vencidos', '*/30 * * * *', 'select public.registrar_convites_vencidos()');

-- Administração -----------------------------------------------------------------

/** Funções, Categorias e campos das Categorias: quem cria Eventos de quê, e o que cada Evento tem. */
create function public.log_do_catalogo()
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
        when 'obrigatorio' then 'Obrigatório' when 'opcoes' then 'Opções' else chave end,
      'tipo', case chave when 'obrigatorio' then 'booleano' when 'opcoes' then 'lista' else 'texto' end,
      'antes', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = antes ->> chave) else coalesce(antes -> chave, 'null') end,
      'depois', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = depois ->> chave) else coalesce(depois -> chave, 'null') end
    )), '[]')
  into mudancas
  from jsonb_object_keys(antes || depois) chave
  where chave in ('nome', 'area_id', 'cor', 'tipo', 'obrigatorio', 'opcoes')
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

create trigger ao_alterar_funcao
  after insert or update on public.funcoes
  for each row execute function public.log_do_catalogo();

create trigger ao_alterar_categoria
  after insert or update on public.categorias
  for each row execute function public.log_do_catalogo();

create trigger ao_alterar_campo_da_categoria
  after insert or update or delete on public.campos_das_categorias
  for each row execute function public.log_do_catalogo();

/**
 * Cada configuração alterada vira um log, com o valor anterior e o novo. A retenção dos logs tem ação própria.
 * As próximas fases acrescentam colunas e as mapeiam em `acao_da_configuracao`.
 */
create function public.acao_da_configuracao(chave text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case chave when 'retencao_dos_logs_meses' then 'logs.retencao_alterada' else 'configuracao.alterada' end;
$$;

create function public.log_das_configuracoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := to_jsonb(old);
  depois jsonb := to_jsonb(new);
  chave text;
begin
  for chave in
    select k from jsonb_object_keys(depois) k
    where k not in ('id', 'logs_desde', 'editado_por', 'editado_em') and (antes -> k) is distinct from (depois -> k)
    order by k
  loop
    perform public.gravar_log(
      public.acao_da_configuracao(chave), 'configuracao', chave, null,
      jsonb_build_object('chave', chave, 'antes', antes -> chave, 'depois', depois -> chave)
    );
  end loop;
  return null;
end;
$$;

create trigger ao_alterar_configuracoes
  after update on public.configuracoes
  for each row execute function public.log_das_configuracoes();

create function public.log_da_exportacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gravar_log('dados.exportados', 'exportacao', new.id::text, null, jsonb_build_object('tabela', new.tabela));
  return null;
end;
$$;

create trigger ao_exportar
  after insert on public.exportacoes
  for each row execute function public.log_da_exportacao();

-- A exportação dos próprios logs também fica registrada.
alter type public.tabela_exportada add value if not exists 'logs';

-- Retenção ----------------------------------------------------------------------

/** Apaga os logs mais antigos que a retenção configurada e registra quantos saíram. Roda pelo agendamento. */
create function public.limpar_logs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  meses integer := (select c.retencao_dos_logs_meses from public.configuracoes c);
  quantos integer;
begin
  perform set_config('onda.limpando_logs', 'sim', true);
  delete from public.logs where feito_em < now() - make_interval(months => meses);
  get diagnostics quantos = row_count;
  perform set_config('onda.limpando_logs', '', true);
  if quantos > 0 then
    perform public.gravar_log('logs.limpeza', null, null, null, jsonb_build_object('removidos', quantos, 'meses', meses));
  end if;
  return quantos;
end;
$$;

revoke execute on function public.limpar_logs from public, anon, authenticated;
grant execute on function public.limpar_logs to service_role;

select cron.schedule('limpar-logs', '15 3 * * *', 'select public.limpar_logs()');

-- Registro pela interface ----------------------------------------------------------

/**
 * O que o servidor do app registra por aqui: entrar, sair, trocar a senha, a tentativa de login com falha, o pedido de
 * nova senha e as falhas de qualquer ação. Quem fez é sempre quem está logado (ou ninguém, nas tentativas de quem
 * ainda não entrou); não dá para registrar em nome de outra pessoa nem gravar um sucesso de outra ação.
 * O e-mail digitado só serve para achar a conta: ele não é gravado (de um e-mail sem conta fica só o domínio).
 * Há um limite de registros por minuto, para que a chave pública não sirva para encher a tabela.
 */
create function public.registrar_log(
  acao text,
  resultado text default 'sucesso',
  objeto_tipo text default null,
  objeto_id text default null,
  objeto_rotulo text default null,
  email text default null,
  mensagem text default null,
  codigo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  conta public.perfis;
  tentativas integer;
  detalhes jsonb := '{}';
begin
  if acao is null or acao !~ '^[a-z_]+\.[a-z_]+$' or resultado not in ('sucesso', 'falha') then
    raise exception 'registro inválido' using errcode = 'P0001';
  end if;

  -- Limite: 30 por pessoa (ou 120 de quem não entrou) a cada 10 minutos.
  if (
    select count(*) from public.logs l
    where l.feito_em > now() - interval '10 minutes'
      and l.origem = 'interface'
      and (l.acao like 'acesso.%' or l.resultado = 'falha')
      and l.usuario_id is not distinct from eu
  ) >= (case when eu is null then 120 else 30 end) then
    return;
  end if;

  if acao in ('acesso.login_falhou', 'acesso.senha_pedida') then
    if resultado <> (case when acao = 'acesso.login_falhou' then 'falha' else 'sucesso' end) then
      raise exception 'registro inválido' using errcode = 'P0001';
    end if;
    select * into conta from public.perfis p where lower(p.email) = lower(btrim(registrar_log.email)) and p.email <> '';
    if acao = 'acesso.login_falhou' then
      select count(*) + 1 into tentativas from public.logs l
      where l.acao = 'acesso.login_falhou' and l.feito_em > now() - interval '1 hour'
        and l.objeto_id is not distinct from conta.id::text
        and (conta.id is not null or l.objeto_rotulo = '@' || split_part(lower(btrim(registrar_log.email)), '@', 2));
      detalhes := jsonb_build_object('tentativas', tentativas, 'codigo', left(codigo, 60));
    end if;
    perform public.gravar_log(
      acao, 'conta', conta.id::text,
      coalesce(nullif(btrim(conta.nome), ''), '@' || split_part(lower(btrim(registrar_log.email)), '@', 2)),
      detalhes || jsonb_build_object('conta_existe', conta.id is not null),
      resultado,
      case when acao = 'acesso.login_falhou' then 'aviso' else 'info' end
    );
    return;
  end if;

  if eu is null then
    raise exception 'entre para registrar' using errcode = '42501';
  end if;

  if resultado = 'sucesso' then
    if acao not in ('acesso.login', 'acesso.logout', 'acesso.senha_redefinida') then
      raise exception 'só o banco registra o sucesso desta ação' using errcode = '42501';
    end if;
    perform public.gravar_log(acao, 'conta', eu::text, (select nullif(btrim(p.nome), '') from public.perfis p where p.id = eu));
    return;
  end if;

  perform public.gravar_log(
    acao, left(objeto_tipo, 40), left(objeto_id, 80), left(objeto_rotulo, 200),
    jsonb_strip_nulls(jsonb_build_object('mensagem', left(mensagem, 500), 'codigo', left(codigo, 60))),
    'falha',
    case when codigo = '42501' then 'aviso' else 'erro' end
  );
end;
$$;

revoke execute on function public.registrar_log from public;
grant execute on function public.registrar_log to anon, authenticated;

-- Reverter --------------------------------------------------------------------------
-- Os logs são só acrescentados; nada do que já existia muda de forma (a exceção é o valor 'logs' em
-- `tabela_exportada`, que o Postgres não remove de um enum e pode ficar). Para desfazer:
--
-- select cron.unschedule('limpar-logs');
-- select cron.unschedule('registrar-convites-vencidos');
-- drop trigger ao_exportar on public.exportacoes;
-- drop trigger ao_alterar_configuracoes on public.configuracoes;
-- drop trigger ao_alterar_campo_da_categoria on public.campos_das_categorias;
-- drop trigger ao_alterar_categoria on public.categorias;
-- drop trigger ao_alterar_funcao on public.funcoes;
-- drop trigger ao_alterar_convite on public.convites;
-- drop trigger ao_alterar_funcao_da_pessoa on public.funcoes_das_pessoas;
-- drop trigger log_da_conta_aprovada on public.perfis;
-- drop trigger log_da_conta_nova on public.perfis;
-- drop trigger ao_alterar_perfil on public.perfis;
-- drop trigger ao_alterar_adolescente on public.adolescentes;
-- drop trigger ao_encerrar_serie on public.series;
-- drop trigger ao_excluir_serie on public.series;
-- drop trigger log_da_serie_criada on public.series;
-- drop trigger ao_criar_serie on public.series;
-- drop trigger ao_registrar_alteracao_do_evento on public.alteracoes_dos_eventos;
-- drop function public.registrar_log, public.limpar_logs, public.log_da_exportacao, public.log_das_configuracoes,
--   public.acao_da_configuracao, public.log_do_catalogo, public.registrar_convites_vencidos, public.log_do_convite,
--   public.log_da_funcao_da_pessoa, public.log_da_conta, public.log_do_perfil, public.acesso_da_pessoa,
--   public.log_do_adolescente, public.log_da_serie, public.log_da_serie_criada, public.marcar_serie_nova,
--   public.rotulo_da_serie, public.editar_serie, public.log_da_alteracao_do_evento, public.mudancas_do_evento,
--   public.marcar_no_lote, public.no_lote, public.pode_ver_historico, public.proteger_logs, public.gravar_log,
--   public.modulo_da_acao, public.carimbar_configuracoes;
-- drop table public.logs;
-- drop table public.configuracoes;
-- (e voltar o app para a versão anterior, que chama `editar_eventos` direto)
