-- Push: demais tipos (ticket 14 de .scratch/drive-agenda-avisos). Além da designação (ticket 13), a fila ganha os lembretes
-- de 1 dia e de 2 horas, a mudança de data, hora ou local, o cancelamento, o resumo semanal, a Chamada pendente e os
-- Eventos sem Responsável. Mudança e cancelamento nascem de um gatilho, no instante da alteração; o resto é devido com o
-- passar do tempo e é gerado pela rota do agendador (src/lib/notificacoes/gerar.ts), que grava por
-- `criar_notificacoes_agendadas`. Em todos, a chave única (tipo + Evento + pessoa + janela) descarta a repetição. Só
-- acréscimos, mais a troca de duas funções.

-- Abaixo de quantas horas para o início uma mudança ou cancelamento é urgente e fura a janela de horário da pessoa. A
-- mudança vira log pelo gatilho que já olha toda coluna de `configuracoes`.
alter table public.configuracoes
  add column limite_de_urgencia_horas integer not null default 12 check (limite_de_urgencia_horas between 1 and 72);
grant update (limite_de_urgencia_horas) on public.configuracoes to authenticated;

-- Os tipos novos têm algarismo no nome (`lembrete_1d`, `lembrete_2h`): a restrição de `tipo` passa a aceitá-los.
alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo ~ '^[a-z0-9_]{1,40}$');

-- `criar_notificacao` aprende a criar urgentes e com validade própria (um aviso de mudança vale até o Evento começar).
drop function public.criar_notificacao(text, uuid, uuid, uuid, text, text[]);

create function public.criar_notificacao(
  tipo text, evento uuid, serie uuid, pessoa uuid, janela text, niveis text[],
  urgente boolean default false, valida timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pessoa is not distinct from (select auth.uid()) then
    return;
  end if;
  if not exists (select 1 from public.perfis p where p.id = pessoa and p.ativo and p.nivel::text = any (niveis)) then
    return;
  end if;
  if exists (
    select 1 from public.preferencias_de_notificacao pr
    where pr.pessoa_id = pessoa and criar_notificacao.tipo = any (pr.tipos_desligados)
  ) then
    return;
  end if;
  if serie is not null and exists (
    select 1
    from public.notificacoes n
    join public.eventos e on e.id = n.evento_id
    where n.pessoa_id = pessoa and n.tipo = criar_notificacao.tipo and e.serie_id = serie and n.criada_em = now()
  ) then
    return;
  end if;

  insert into public.notificacoes (pessoa_id, tipo, evento_id, janela, urgente, valida_ate)
  values (pessoa, criar_notificacao.tipo, evento, janela, criar_notificacao.urgente, coalesce(valida, now() + interval '48 hours'))
  on conflict do nothing;
end;
$$;

revoke execute on function public.criar_notificacao from public, anon, authenticated;

-- Mudança de data, hora ou local de um Evento Planejado ou Confirmado, e cancelamento: quem é Responsável (Liderança) ou
-- Professor/Auxiliar do Evento é avisado, exceto quem fez a mudança. Só vale para Evento que ainda não começou. Se começa
-- em menos de `limite_de_urgencia_horas`, é urgente. O aviso vale até o Evento começar (no máximo 48 horas): depois
-- disso seria enganoso. A `janela` é o minuto da mudança: edições no mesmo minuto viram um aviso só, e o texto sai do
-- Evento como está na hora do envio. Como a designação, é só um acréscimo ao salvar: se falhar, o Evento é salvo do mesmo jeito.
create function public.notificar_mudancas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tipo text;
  janela text := to_char(now() at time zone 'America/Bahia', 'YYYY-MM-DD"T"HH24:MI');
  urgente boolean;
  valida timestamptz;
  campo uuid;
  pessoa text;
begin
  if new.inicio <= now() then
    return null;
  end if;

  if new.status = 'cancelado' and old.status <> 'cancelado' then
    tipo := 'evento_cancelado';
  elsif new.status in ('planejado', 'confirmado')
    and (new.inicio, new.dia_inteiro, new.local) is distinct from (old.inicio, old.dia_inteiro, old.local) then
    tipo := 'evento_alterado';
  else
    return null;
  end if;

  urgente := new.inicio - now() < make_interval(hours => (select c.limite_de_urgencia_horas from public.configuracoes c));
  valida := least(new.inicio, now() + interval '48 hours');

  if new.responsavel_id is not null then
    perform public.criar_notificacao(tipo, new.id, new.serie_id, new.responsavel_id, janela, array['admin', 'lider'], urgente, valida);
  end if;

  for campo in
    select c.id from public.campos_das_categorias c
    where c.categoria_id = new.categoria_id and c.tipo = 'pessoa' and c.nome in ('Professor', 'Auxiliar')
  loop
    pessoa := new.campos ->> campo::text;
    if pessoa ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public.criar_notificacao(tipo, new.id, new.serie_id, pessoa::uuid, janela, array['admin', 'lider', 'professor'], urgente, valida);
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'mudança não notificada: %', sqlerrm;
  return null;
end;
$$;

create trigger ao_mudar_evento
  after update on public.eventos
  for each row execute function public.notificar_mudancas();

-- O agendador grava aqui o que está devido com o passar do tempo (lembretes, resumo, Chamada pendente, Eventos sem
-- Responsável). Os itens vêm do planejador (src/dominio/notificacoes.ts); quem já existe é ignorado pela chave única.
-- Devolve quantas Notificações nasceram. Só a chave de serviço chama.
create function public.criar_notificacoes_agendadas(itens jsonb)
returns integer
language sql
security definer
set search_path = ''
as $$
  with novas as (
    insert into public.notificacoes (pessoa_id, tipo, evento_id, janela, titulo, texto, tag, url, valida_ate)
    select i.pessoa_id, i.tipo, i.evento_id, coalesce(i.janela, ''), i.titulo, i.texto, i.tag, i.url, i.valida_ate
    from jsonb_to_recordset(criar_notificacoes_agendadas.itens) as i (
      pessoa_id uuid, tipo text, evento_id uuid, janela text, titulo text, texto text, tag text, url text, valida_ate timestamptz
    )
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from novas;
$$;

revoke execute on function public.criar_notificacoes_agendadas from public, anon, authenticated;
grant execute on function public.criar_notificacoes_agendadas to service_role;

-- A limpeza nunca apaga antes de 8 dias, qualquer que seja a retenção: os avisos de Chamada pendente e de Eventos sem
-- Responsável são devidos por até 7 dias, e apagar o registro de um já enviado o faria nascer de novo.
create or replace function public.limpar_notificacoes()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notificacoes n
  where n.criada_em < now() - greatest(make_interval(days => (select c.retencao_das_notificacoes_dias from public.configuracoes c)), interval '8 days')
    -- Uma pendente ainda dentro da validade ainda vai ser enviada.
    and (n.estado <> 'pendente' or n.valida_ate < now());
$$;

-- A cada 5 minutos o app é chamado para gerar o que está devido (e já aproveita para enviar). A `processar_notificacoes`,
-- de minuto em minuto, continua chamando só quando há algo pendente.
select cron.schedule('gerar-notificacoes', '*/5 * * * *', $cron$select public.chamar_agendador('notificacoes')$cron$);

-- Como reverter:
-- select cron.unschedule('gerar-notificacoes');
-- drop function public.criar_notificacoes_agendadas;
-- drop trigger ao_mudar_evento on public.eventos; drop function public.notificar_mudancas;
-- drop function public.criar_notificacao(text, uuid, uuid, uuid, text, text[], boolean, timestamptz);
-- (recriar `criar_notificacao` e `limpar_notificacoes` como em 20261023140000_notificacoes.sql)
-- alter table public.configuracoes drop column limite_de_urgencia_horas;
-- alter table public.notificacoes drop constraint notificacoes_tipo_check;
-- alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo ~ '^[a-z_]{1,40}$');
