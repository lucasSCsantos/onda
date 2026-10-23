-- Pastas das Séries e ajustes (ticket 05 de .scratch/drive-agenda-avisos). Ver ADRs 0006 e 0007.
-- 1. Cada Ocorrência de uma Série ganha a sua Pasta do Evento: a fila do ticket 04 já enfileira por Evento, então basta
--    deixar de excluir os Eventos de Série; `criar_serie` só insere e nunca espera o Drive.
-- 2. Mudar título, data ou número renomeia a pasta existente, por uma tarefa de renomear na mesma fila.
-- 3. "Criar pasta agora" reabre a tarefa de um Evento sem pasta ou com erro.
-- O Mural continua sem apagar nem mover nada no Drive. Só acréscimos e troca de funções.

-- A fila passa a ter dois tipos de tarefa -------------------------------------------------

-- Continua uma linha por Evento (`evento_id` é único): renomear e recriar reabrem a mesma linha.
alter table public.tarefas_de_pasta
  add column operacao text not null default 'criar' check (operacao in ('criar', 'renomear')),
  -- Quando a rodada do agendador reservou a tarefa pela última vez, e quando o título, a data ou o número do Evento
  -- mudaram pela última vez: se mudaram depois da reserva, o que a rodada fez já nasceu desatualizado.
  add column reservada_em timestamptz,
  add column mudou_em timestamptz;

-- Pasta automática para Série ---------------------------------------------------------------

/**
 * Este Evento ganha uma pasta sozinho? Com o Drive ligado, a Categoria na lista do Admin, um campo para o link e esse
 * campo ainda vazio: um link digitado à mão vale mais que a pasta. Avulso ou Ocorrência de Série, tanto faz; o
 * parâmetro `serie` fica só para não mudar a assinatura que o gatilho chama.
 */
create or replace function public.pasta_automatica(categoria uuid, serie uuid, campos jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  campo uuid;
begin
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

-- Renomear ------------------------------------------------------------------------------------

/**
 * O título, a data ou o número mudaram. Se o Evento já tem pasta, reabre a tarefa dele como "renomear". O nome novo é
 * calculado quando a tarefa roda, então várias edições seguidas viram uma renomeação só. Se a pasta ainda não existe,
 * não há o que renomear: a criação usa os dados de agora, e a tarefa só anota que houve mudança (`mudou_em`), para que
 * uma criação já em andamento, que partiu com o nome antigo, peça a renomeação ao terminar. Cancelar não passa por aqui.
 */
create function public.enfileirar_renomeacao_da_pasta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pasta_id is not null then
    insert into public.tarefas_de_pasta (evento_id, operacao, mudou_em)
    values (new.id, 'renomear', now())
    on conflict (evento_id) do update
    set estado = 'pendente', operacao = 'renomear', tentativas = 0, proxima_tentativa = now(), erro = null,
        concluido_em = null, mudou_em = now();
  else
    update public.tarefas_de_pasta t set mudou_em = now() where t.evento_id = new.id and t.estado = 'pendente';
  end if;
  return null;
end;
$$;

create trigger ao_mudar_evento_renomear_pasta
  after update of titulo, inicio, numero_da_ocorrencia on public.eventos
  for each row
  when ((old.titulo, old.inicio, old.numero_da_ocorrencia) is distinct from (new.titulo, new.inicio, new.numero_da_ocorrencia))
  execute function public.enfileirar_renomeacao_da_pasta();

-- O agendador entende os dois tipos -----------------------------------------------------------

drop function public.reservar_tarefas_de_pasta(integer, integer);

/**
 * Reserva as tarefas devidas (Drive ligado, pasta raiz informada): conta a tentativa e empurra a próxima 10 minutos
 * para a frente, então outra rodada do agendador não pega a mesma tarefa enquanto esta roda. Devolve o que precisa
 * para montar o caminho (criar) ou para trocar o nome (renomear, com o ID da pasta). Só o servidor chama.
 *
 * Tarefa que já gastou todas as tentativas sem nunca receber resposta (a rota caiu depois de reservar, de novo e de
 * novo) fecha aqui com erro, em vez de ficar pendente para sempre. A que chega a falhar no Drive já fecha em
 * `falhar_tarefa_de_pasta`; isto só pega as que nunca chegaram lá.
 */
create function public.reservar_tarefas_de_pasta(limite integer default 10, maximo_de_tentativas integer default 5)
returns table (
  tarefa_id uuid, evento_id uuid, operacao text, pasta_id text, categoria text, inicio timestamptz, titulo text,
  numero integer, tentativas integer, raiz text
)
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
    returning t.evento_id, t.tentativas, t.operacao
  loop
    -- Só a criação que falha deixa a pasta com erro; a pasta que não foi renomeada continua existindo.
    if esgotada.operacao = 'criar' then
      update public.eventos e set pasta_estado = 'falhou' where e.id = esgotada.evento_id;
    end if;
    perform public.gravar_log(
      case esgotada.operacao when 'criar' then 'drive.pasta_falhou' else 'drive.pasta_renomear_falhou' end,
      'evento', esgotada.evento_id::text,
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
    set tentativas = t.tentativas + 1, proxima_tentativa = now() + interval '10 minutes', reservada_em = now()
    from devidas d
    where t.id = d.id
    returning t.id, t.evento_id, t.operacao, t.tentativas
  )
  select r.id, r.evento_id, r.operacao, e.pasta_id, c.nome, e.inicio, e.titulo, e.numero_da_ocorrencia, r.tentativas, pasta_raiz
  from reservadas r
  join public.eventos e on e.id = r.evento_id
  join public.categorias c on c.id = e.categoria_id;
end;
$$;

/**
 * A tarefa deu certo. Criar: guarda o ID da pasta, marca como criada, escreve o link no "Link do material" (só se
 * ainda estiver vazio, para nunca passar por cima de um link digitado à mão) e registra o Log. Renomear: só fecha a
 * tarefa e registra o Log; o link e o ID continuam os mesmos. Se o Evento mudou durante a rodada (`mudou_em` depois de
 * `reservada_em`), a tarefa não fecha: vira (ou continua) uma renomeação devida agora. Roda sem sessão de pessoa, então não conta como edição
 * de ninguém. Tarefa que já não está pendente é ignorada.
 */
create or replace function public.concluir_tarefa_de_pasta(tarefa uuid, pasta text, link text)
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
  mudou_depois boolean;
begin
  select x.* into t from public.tarefas_de_pasta x where x.id = id_da_tarefa for update;
  if not found or t.estado <> 'pendente' then
    return;
  end if;
  select e.* into ev from public.eventos e where e.id = t.evento_id;

  -- O Evento mudou de título ou data depois de a rodada reservar a tarefa: o nome que ela usou já é velho.
  mudou_depois := t.mudou_em is not null and t.reservada_em is not null and t.mudou_em > t.reservada_em;

  if t.operacao = 'renomear' then
    -- A edição já reabriu a tarefa como pendente e devida agora: deixa assim, que a próxima rodada usa o nome novo.
    if not mudou_depois then
      update public.tarefas_de_pasta x set estado = 'feita', concluido_em = now(), erro = null where x.id = t.id;
    end if;
    perform public.gravar_log('drive.pasta_renomeada', 'evento', t.evento_id::text, ev.titulo);
    return;
  end if;

  campo := public.campo_da_pasta(ev.categoria_id);
  tem_link := btrim(coalesce(ev.campos ->> campo::text, '')) <> '';

  if mudou_depois then
    -- A pasta nasceu com o nome antigo: guarda-a e pede a renomeação na mesma linha da fila.
    update public.tarefas_de_pasta x
    set operacao = 'renomear', tentativas = 0, proxima_tentativa = now(), erro = null, concluido_em = null
    where x.id = t.id;
  else
    update public.tarefas_de_pasta x set estado = 'feita', concluido_em = now(), erro = null where x.id = t.id;
  end if;
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
 * A tentativa falhou. Passageira: a tarefa espera `depois_de_minutos` e segue pendente. Definitiva: a tarefa fecha; se
 * era criar, a pasta do Evento fica com erro (o campo continua preenchível à mão); se era renomear, a pasta segue
 * existindo com o nome antigo. Os dois viram Log; o erro é texto curto.
 */
create or replace function public.falhar_tarefa_de_pasta(tarefa uuid, erro text, definitiva boolean, depois_de_minutos integer)
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
    if t.operacao = 'criar' then
      update public.eventos e set pasta_estado = 'falhou' where e.id = t.evento_id;
    end if;
  else
    update public.tarefas_de_pasta x set erro = mensagem, proxima_tentativa = now() + make_interval(mins => espera) where x.id = t.id;
  end if;

  select e.titulo into titulo_do_evento from public.eventos e where e.id = t.evento_id;
  perform public.gravar_log(
    case t.operacao when 'criar' then 'drive.pasta_falhou' else 'drive.pasta_renomear_falhou' end,
    'evento', t.evento_id::text, titulo_do_evento,
    jsonb_build_object('tentativa', t.tentativas, 'definitiva', fechar, 'erro', mensagem),
    'falha', case when fechar then 'erro' else 'aviso' end
  );
end;
$$;

-- Criar pasta agora -----------------------------------------------------------------------------

/**
 * Quem pode editar o Evento pede a pasta dele sem esperar pela criação automática: serve ao Evento criado antes da
 * integração, ao que teve a pasta dispensada e ao que falhou. Reabre a tarefa (uma linha por Evento) com as tentativas
 * zeradas; quem cria é a mesma rodada do agendador, então a tela nunca espera o Drive. Um link digitado à mão no
 * "Link do material" é respeitado: a pasta nasce, mas o link não é trocado. Pasta já criada ou já a caminho: nada a fazer.
 */
create function public.criar_pasta_agora(evento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_do_evento uuid := criar_pasta_agora.evento;
  ev public.eventos;
begin
  select e.* into ev from public.eventos e where e.id = id_do_evento;
  if not found or not public.pode_editar_evento(ev.categoria_id, ev.responsavel_id) then
    raise exception 'sem permissão para pedir a pasta deste Evento' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.configuracoes c where c.drive_ligado and c.drive_pasta_raiz_id is not null
  ) then
    raise exception 'O Drive não está ligado nas Configurações.' using errcode = 'P0001';
  end if;
  if public.campo_da_pasta(ev.categoria_id) is null then
    raise exception 'Esta Categoria não tem o campo “Link do material”, onde o link da pasta fica.' using errcode = 'P0001';
  end if;
  if ev.pasta_estado in ('criada', 'pendente') then
    raise exception 'Este Evento já tem pasta no Drive, ou ela já está sendo criada.' using errcode = 'P0001';
  end if;

  insert into public.tarefas_de_pasta (evento_id) values (ev.id)
  on conflict (evento_id) do update
  set estado = 'pendente', operacao = 'criar', tentativas = 0, proxima_tentativa = now(), erro = null, concluido_em = null;
  update public.eventos e set pasta_estado = 'pendente' where e.id = ev.id;
  perform public.gravar_log('drive.pasta_solicitada', 'evento', ev.id::text, ev.titulo);
end;
$$;

-- Permissões ------------------------------------------------------------------------------------

revoke execute on function public.enfileirar_renomeacao_da_pasta, public.reservar_tarefas_de_pasta from public, anon, authenticated;
grant execute on function public.reservar_tarefas_de_pasta to service_role;
revoke execute on function public.criar_pasta_agora from public, anon;
grant execute on function public.criar_pasta_agora to authenticated;

-- Reverter --------------------------------------------------------------------------------------
-- drop function public.criar_pasta_agora;
-- drop trigger ao_mudar_evento_renomear_pasta on public.eventos;
-- drop function public.enfileirar_renomeacao_da_pasta;
-- e recriar `pasta_automatica`, `reservar_tarefas_de_pasta`, `concluir_tarefa_de_pasta` e `falhar_tarefa_de_pasta` como em
-- 20261023040000_pasta_do_evento.sql; depois: alter table public.tarefas_de_pasta drop column operacao;
-- (antes, apagar os logs 'drive.pasta_renomeada', 'drive.pasta_renomear_falhou' e 'drive.pasta_solicitada').
