-- Pasta do Evento no Drive (ticket 04 de .scratch/drive-agenda-avisos). Ver ADRs 0006 e 0007.
-- Ao criar um Evento avulso de uma Categoria com pasta automática, o banco enfileira uma tarefa; o agendador (`pg_cron`
-- chama, com `pg_net`, uma rota do app protegida por segredo) cria a pasta no Drive e devolve o link, que entra no campo
-- "Link do material" do Evento. Só acréscimos: nenhuma coluna ou dado existente muda.

create extension if not exists pg_net with schema extensions;

-- Configuração ---------------------------------------------------------------------

alter table public.configuracoes
  add column drive_ligado boolean not null default false,
  -- ID da pasta compartilhada do ministério no Drive (a service account é Editora dela).
  add column drive_pasta_raiz_id text check (drive_pasta_raiz_id ~ '^[A-Za-z0-9_-]{10,}$'),
  -- As Categorias que ganham pasta sozinhas; só valem as que têm um campo "Link do material" (`campo_da_pasta`).
  add column drive_categorias uuid[] not null default '{}',
  add constraint drive_ligado_precisa_de_raiz check (not drive_ligado or drive_pasta_raiz_id is not null);

update public.configuracoes
set drive_categorias = array(select c.id from public.categorias c where c.nome in ('EBD', 'Pequeno grupo'));

grant update (drive_ligado, drive_pasta_raiz_id, drive_categorias) on public.configuracoes to authenticated;

-- O Evento ---------------------------------------------------------------------------

-- Sem grant de escrita: só o banco (gatilho e funções do agendador) mexe nestas colunas.
alter table public.eventos
  add column pasta_id text,
  add column pasta_estado text check (pasta_estado in ('pendente', 'criada', 'falhou'));

/**
 * O campo onde o link da pasta mora: o primeiro campo de link da Categoria chamado "Link do material" (ou "Link dos
 * materiais", no Acampamento). Mesmos nomes de NOMES_DO_CAMPO_DA_PASTA em src/dominio/drive.ts. Nulo se não tem.
 */
create function public.campo_da_pasta(categoria uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.campos_das_categorias c
  where c.categoria_id = campo_da_pasta.categoria
    and c.tipo = 'link'
    and c.nome in ('Link do material', 'Link dos materiais')
  order by c.ordem
  limit 1;
$$;

/**
 * Este Evento ganha uma pasta sozinho? Só o avulso (as Séries são de outro ticket), com o Drive ligado, a Categoria na
 * lista do Admin, um campo para o link e esse campo ainda vazio: um link digitado à mão vale mais que a pasta.
 */
create function public.pasta_automatica(categoria uuid, serie uuid, campos jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  campo uuid;
begin
  if pasta_automatica.serie is not null then
    return false;
  end if;
  if not exists (
    select 1 from public.configuracoes c
    where c.drive_ligado and c.drive_pasta_raiz_id is not null and pasta_automatica.categoria = any (c.drive_categorias)
  ) then
    return false;
  end if;
  campo := public.campo_da_pasta(pasta_automatica.categoria);
  if campo is null then
    return false;
  end if;
  return btrim(coalesce(pasta_automatica.campos ->> campo::text, '')) = '';
end;
$$;

-- Na criação o Evento já nasce com a pasta pendente (antes de gravar, para não contar como edição de ninguém).
create function public.marcar_pasta_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.pasta_automatica(new.categoria_id, new.serie_id, new.campos) then
    new.pasta_estado := 'pendente';
  end if;
  return new;
end;
$$;

create trigger ao_criar_evento_marcar_pasta
  before insert on public.eventos
  for each row execute function public.marcar_pasta_pendente();

-- A fila -------------------------------------------------------------------------------

-- Só o servidor lê e escreve (sem política: a interface não enxerga a tabela).
create table public.tarefas_de_pasta (
  id uuid primary key default gen_random_uuid(),
  -- Uma tarefa por Evento: criar de novo a mesma pasta nunca vira duas.
  evento_id uuid not null unique references public.eventos (id) on delete cascade,
  estado text not null default 'pendente' check (estado in ('pendente', 'feita', 'falhou')),
  tentativas integer not null default 0,
  proxima_tentativa timestamptz not null default now(),
  -- Texto curto, sem segredo; o que o Drive respondeu na última falha.
  erro text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index tarefas_de_pasta_devidas on public.tarefas_de_pasta (proxima_tentativa) where estado = 'pendente';

alter table public.tarefas_de_pasta enable row level security;
revoke all on public.tarefas_de_pasta from anon, authenticated;

create function public.enfileirar_pasta_do_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pasta_estado = 'pendente' then
    insert into public.tarefas_de_pasta (evento_id) values (new.id) on conflict (evento_id) do nothing;
  end if;
  return null;
end;
$$;

create trigger ao_criar_evento_enfileirar_pasta
  after insert on public.eventos
  for each row execute function public.enfileirar_pasta_do_evento();

-- O agendador ---------------------------------------------------------------------------

/**
 * Reserva as tarefas devidas (Drive ligado, pasta raiz informada): conta a tentativa e empurra a próxima 10 minutos
 * para a frente, então outra rodada do agendador não pega a mesma tarefa enquanto esta roda. Devolve o que precisa
 * para montar o caminho. Só o servidor chama.
 *
 * Tarefa que já gastou todas as tentativas sem nunca receber resposta (a rota caiu depois de reservar, de novo e de
 * novo) fecha aqui com erro, em vez de ficar pendente para sempre. A que chega a falhar no Drive já fecha em
 * `falhar_tarefa_de_pasta`; isto só pega as que nunca chegaram lá.
 */
create function public.reservar_tarefas_de_pasta(limite integer default 10, maximo_de_tentativas integer default 5)
returns table (tarefa_id uuid, evento_id uuid, categoria text, inicio timestamptz, titulo text, numero integer, tentativas integer, raiz text)
language plpgsql
security definer
set search_path = ''
as $$
-- Os nomes das colunas de saída (`evento_id`, `titulo`…) repetem os das tabelas: onde houver dúvida, vale a coluna.
#variable_conflict use_column
declare
  pasta_raiz text := (select c.drive_pasta_raiz_id from public.configuracoes c where c.drive_ligado);
  esgotada record;
  motivo constant text := 'a rodada do agendador não respondeu';
begin
  if pasta_raiz is null then
    return;
  end if;

  for esgotada in
    update public.tarefas_de_pasta t
    set estado = 'falhou', concluido_em = now(), erro = coalesce(t.erro, motivo)
    where t.estado = 'pendente' and t.proxima_tentativa <= now() and t.tentativas >= reservar_tarefas_de_pasta.maximo_de_tentativas
    returning t.evento_id, t.tentativas
  loop
    update public.eventos e set pasta_estado = 'falhou' where e.id = esgotada.evento_id;
    perform public.gravar_log(
      'drive.pasta_falhou', 'evento', esgotada.evento_id::text,
      (select e.titulo from public.eventos e where e.id = esgotada.evento_id),
      jsonb_build_object('tentativa', esgotada.tentativas, 'definitiva', true, 'erro', motivo),
      'falha', 'erro'
    );
  end loop;

  return query
  with devidas as (
    select t.id
    from public.tarefas_de_pasta t
    where t.estado = 'pendente' and t.proxima_tentativa <= now()
    order by t.proxima_tentativa, t.criado_em
    limit greatest(least(coalesce(reservar_tarefas_de_pasta.limite, 10), 500), 0)
    for update skip locked
  ),
  reservadas as (
    update public.tarefas_de_pasta t
    set tentativas = t.tentativas + 1, proxima_tentativa = now() + interval '10 minutes'
    from devidas d
    where t.id = d.id
    returning t.id, t.evento_id, t.tentativas
  )
  select r.id, r.evento_id, c.nome, e.inicio, e.titulo, e.numero_da_ocorrencia, r.tentativas, pasta_raiz
  from reservadas r
  join public.eventos e on e.id = r.evento_id
  join public.categorias c on c.id = e.categoria_id;
end;
$$;

/**
 * A pasta foi criada: guarda o ID, marca a pasta como criada, escreve o link no "Link do material" (só se ele ainda
 * estiver vazio, para nunca passar por cima de um link digitado à mão) e registra o Log. Roda sem sessão de pessoa,
 * então não conta como edição de ninguém. Tarefa que já não está pendente é ignorada.
 */
create function public.concluir_tarefa_de_pasta(tarefa uuid, pasta text, link text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_da_tarefa uuid := concluir_tarefa_de_pasta.tarefa;
  id_da_pasta text := concluir_tarefa_de_pasta.pasta;
  link_da_pasta text := concluir_tarefa_de_pasta.link;
  t public.tarefas_de_pasta;
  ev public.eventos;
  campo uuid;
  tem_link boolean;
begin
  select x.* into t from public.tarefas_de_pasta x where x.id = id_da_tarefa for update;
  if not found or t.estado <> 'pendente' then
    return;
  end if;
  select e.* into ev from public.eventos e where e.id = t.evento_id;
  campo := public.campo_da_pasta(ev.categoria_id);
  tem_link := btrim(coalesce(ev.campos ->> campo::text, '')) <> '';

  update public.tarefas_de_pasta x set estado = 'feita', concluido_em = now(), erro = null where x.id = t.id;
  update public.eventos e
  set pasta_id = id_da_pasta,
      pasta_estado = 'criada',
      campos = case
        when campo is not null and not tem_link then jsonb_set(e.campos, array[campo::text], to_jsonb(link_da_pasta))
        else e.campos
      end
  where e.id = t.evento_id;

  perform public.gravar_log('drive.pasta_criada', 'evento', t.evento_id::text, ev.titulo, jsonb_build_object('link_manual', tem_link));
end;
$$;

/**
 * A tentativa falhou. Passageira: a tarefa espera `depois_de_minutos` e segue pendente. Definitiva: a tarefa fecha e a
 * pasta do Evento fica com erro (o campo continua preenchível à mão). Os dois viram Log; o erro é texto curto.
 */
create function public.falhar_tarefa_de_pasta(tarefa uuid, erro text, definitiva boolean, depois_de_minutos integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_da_tarefa uuid := falhar_tarefa_de_pasta.tarefa;
  mensagem text := left(coalesce(falhar_tarefa_de_pasta.erro, ''), 300);
  fechar boolean := coalesce(falhar_tarefa_de_pasta.definitiva, false);
  espera integer := greatest(coalesce(falhar_tarefa_de_pasta.depois_de_minutos, 0), 0);
  t public.tarefas_de_pasta;
  titulo_do_evento text;
begin
  select x.* into t from public.tarefas_de_pasta x where x.id = id_da_tarefa for update;
  if not found or t.estado <> 'pendente' then
    return;
  end if;

  if fechar then
    update public.tarefas_de_pasta x set estado = 'falhou', erro = mensagem, concluido_em = now() where x.id = t.id;
    update public.eventos e set pasta_estado = 'falhou' where e.id = t.evento_id;
  else
    update public.tarefas_de_pasta x set erro = mensagem, proxima_tentativa = now() + make_interval(mins => espera) where x.id = t.id;
  end if;

  select e.titulo into titulo_do_evento from public.eventos e where e.id = t.evento_id;
  perform public.gravar_log(
    'drive.pasta_falhou', 'evento', t.evento_id::text, titulo_do_evento,
    jsonb_build_object('tentativa', t.tentativas, 'definitiva', fechar, 'erro', mensagem),
    'falha', case when fechar then 'erro' else 'aviso' end
  );
end;
$$;

/**
 * Chama uma rota do app pelo agendador: a URL e o segredo ficam no Vault do Supabase (`app_url` e `cron_secret`,
 * guardados pelo scripts/wizard-integracoes.sh). Sem eles (desenvolvimento local, CI, Vault ainda vazio), não faz nada.
 */
create function public.chamar_agendador(rota text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  segredo text;
begin
  select s.decrypted_secret into url from vault.decrypted_secrets s where s.name = 'app_url';
  select s.decrypted_secret into segredo from vault.decrypted_secrets s where s.name = 'cron_secret';
  if url is null or segredo is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(url, '/') || '/api/agendador/' || chamar_agendador.rota,
    headers := jsonb_build_object('Authorization', 'Bearer ' || segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
exception when others then
  raise warning 'agendador % não chamado: %', chamar_agendador.rota, sqlerrm;
end;
$$;

/** Todo minuto: se o Drive está ligado e há tarefa devida, chama o app; senão, nem gasta uma chamada. */
create function public.processar_pastas_do_drive()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.configuracoes c where c.drive_ligado and c.drive_pasta_raiz_id is not null)
    and exists (select 1 from public.tarefas_de_pasta t where t.estado = 'pendente' and t.proxima_tentativa <= now()) then
    perform public.chamar_agendador('pastas');
  end if;
end;
$$;

select cron.schedule('processar-pastas-do-drive', '* * * * *', 'select public.processar_pastas_do_drive()');

revoke execute on function
  public.campo_da_pasta, public.pasta_automatica, public.marcar_pasta_pendente, public.enfileirar_pasta_do_evento,
  public.reservar_tarefas_de_pasta, public.concluir_tarefa_de_pasta, public.falhar_tarefa_de_pasta,
  public.chamar_agendador, public.processar_pastas_do_drive
from public, anon, authenticated;
grant execute on function
  public.reservar_tarefas_de_pasta, public.concluir_tarefa_de_pasta, public.falhar_tarefa_de_pasta, public.processar_pastas_do_drive
to service_role;

-- Logs ---------------------------------------------------------------------------------

alter table public.logs drop constraint logs_modulo_check;
alter table public.logs
  add constraint logs_modulo_check
  check (modulo in ('contas', 'eventos', 'adolescentes', 'presenca', 'ranking', 'administracao', 'drive'));

/** A mesma de 20261022000000_logs.sql, com o módulo do Drive. */
create or replace function public.modulo_da_acao(acao text)
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
    when 'drive' then 'drive'
    else 'administracao'
  end;
$$;

/** A mesma de 20261022020000_ranking.sql, com as chaves do Drive numa ação só. */
create or replace function public.acao_da_configuracao(chave text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when chave = 'retencao_dos_logs_meses' then 'logs.retencao_alterada'
    when chave = 'desempate_por' then 'ranking.desempate_alterado'
    when chave like 'drive\_%' then 'drive.configuracao_alterada'
    else 'configuracao.alterada'
  end;
$$;

/** A mesma de 20261022020000_ranking.sql, com as Categorias do Drive pelo nome, e não pelo id. */
create or replace function public.log_das_configuracoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := to_jsonb(old);
  depois jsonb := to_jsonb(new);
  chave text;
  valor_antes jsonb;
  valor_depois jsonb;
begin
  for chave in
    select k from jsonb_object_keys(depois) k
    where k not in ('id', 'logs_desde', 'editado_por', 'editado_em') and (antes -> k) is distinct from (depois -> k)
    order by k
  loop
    valor_antes := antes -> chave;
    valor_depois := depois -> chave;
    if chave = 'desempate_por' then
      valor_antes := (select to_jsonb(m.nome) from public.marcacoes m where m.id::text = antes ->> chave);
      valor_depois := (select to_jsonb(m.nome) from public.marcacoes m where m.id::text = depois ->> chave);
    elsif chave = 'drive_categorias' then
      valor_antes := (select coalesce(jsonb_agg(c.nome order by c.nome), '[]') from public.categorias c where c.id::text in (select jsonb_array_elements_text(antes -> chave)));
      valor_depois := (select coalesce(jsonb_agg(c.nome order by c.nome), '[]') from public.categorias c where c.id::text in (select jsonb_array_elements_text(depois -> chave)));
    end if;
    perform public.gravar_log(
      public.acao_da_configuracao(chave), 'configuracao', chave, null,
      jsonb_build_object('chave', chave, 'antes', coalesce(valor_antes, 'null'), 'depois', coalesce(valor_depois, 'null'))
    );
  end loop;
  return null;
end;
$$;

-- Reverter --------------------------------------------------------------------------
-- Nada some se você parar aqui: é só desligar o Drive em Configurações. Para desfazer de vez:
-- select cron.unschedule('processar-pastas-do-drive');
-- drop trigger ao_criar_evento_enfileirar_pasta on public.eventos;
-- drop trigger ao_criar_evento_marcar_pasta on public.eventos;
-- drop table public.tarefas_de_pasta;
-- drop function public.processar_pastas_do_drive, public.chamar_agendador, public.falhar_tarefa_de_pasta,
--   public.concluir_tarefa_de_pasta, public.reservar_tarefas_de_pasta, public.enfileirar_pasta_do_evento,
--   public.marcar_pasta_pendente, public.pasta_automatica, public.campo_da_pasta;
-- alter table public.eventos drop column pasta_estado, drop column pasta_id;
-- alter table public.configuracoes drop constraint drive_ligado_precisa_de_raiz,
--   drop column drive_categorias, drop column drive_pasta_raiz_id, drop column drive_ligado;
-- (e recriar `modulo_da_acao`, `acao_da_configuracao`, `log_das_configuracoes` e a restrição dos módulos dos logs
-- como em 20261022000000_logs.sql e 20261022020000_ranking.sql, sem 'drive'; antes, apagar os logs do módulo drive).
