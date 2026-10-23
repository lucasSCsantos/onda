-- Push: fila, envio e central (ticket 13 de .scratch/drive-agenda-avisos, ADR 0007). O banco grava o que é devido numa
-- fila (`notificacoes`), que também é a central dentro do app; o `pg_cron` chama com `pg_net` a rota do agendador, que lê a
-- fila e envia a cada dispositivo. Só acréscimos: duas tabelas, colunas novas em `configuracoes` e funções.
--
-- O primeiro tipo entregue é "você foi definido(a) como Responsável (ou Professor/Auxiliar) por um Evento". O texto de
-- cada Notificação é montado no código (src/dominio/notificacoes.ts) quando o agendador a envia; a central mostra o
-- mesmo texto montado a partir do Evento enquanto ele não foi gravado.

-- Preferências de cada pessoa: que tipos receber e a janela de horário (em horas, America/Bahia). Sem linha, valem o
-- padrão: todos os tipos, das 8h às 21h.
create table public.preferencias_de_notificacao (
  pessoa_id uuid primary key references public.perfis (id) on delete cascade,
  tipos_desligados text[] not null default '{}' check (cardinality(tipos_desligados) <= 20),
  janela_inicio smallint not null default 8 check (janela_inicio between 0 and 23),
  janela_fim smallint not null default 21 check (janela_fim between 1 and 24),
  check (janela_inicio < janela_fim)
);

alter table public.preferencias_de_notificacao enable row level security;

create policy "o dono lê as próprias preferências" on public.preferencias_de_notificacao for select to authenticated
  using (pessoa_id = (select auth.uid()));

create policy "o dono cria as próprias preferências" on public.preferencias_de_notificacao for insert to authenticated
  with check (pessoa_id = (select auth.uid()) and coalesce(public.meu_nivel() in ('admin', 'lider', 'professor'), false));

create policy "o dono edita as próprias preferências" on public.preferencias_de_notificacao for update to authenticated
  using (pessoa_id = (select auth.uid()))
  with check (pessoa_id = (select auth.uid()));

revoke all on public.preferencias_de_notificacao from anon, authenticated;
grant select on public.preferencias_de_notificacao to authenticated;
grant insert (pessoa_id, tipos_desligados, janela_inicio, janela_fim) on public.preferencias_de_notificacao to authenticated;
grant update (tipos_desligados, janela_inicio, janela_fim) on public.preferencias_de_notificacao to authenticated;

-- Log: a pessoa mudou os tipos que recebe ou a janela de horário.
create function public.log_das_preferencias_de_notificacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gravar_log(
    'notificacao.preferencias_alteradas', 'conta', new.pessoa_id::text,
    (select nullif(btrim(p.nome), '') from public.perfis p where p.id = new.pessoa_id),
    jsonb_build_object('tipos_desligados', to_jsonb(new.tipos_desligados), 'janela_inicio', new.janela_inicio, 'janela_fim', new.janela_fim),
    'sucesso', 'info', new.pessoa_id
  );
  return null;
end;
$$;

create trigger ao_mudar_preferencias_de_notificacao
  after insert or update on public.preferencias_de_notificacao
  for each row execute function public.log_das_preferencias_de_notificacao();

-- A fila e a central. A chave única (tipo + Evento + pessoa + janela) garante que a mesma Notificação nunca nasce duas
-- vezes: a `janela` é o recorte de tempo do aviso (o dia da designação; nos lembretes, qual deles).
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.perfis (id) on delete cascade,
  tipo text not null check (tipo ~ '^[a-z_]{1,40}$'),
  evento_id uuid references public.eventos (id) on delete cascade,
  janela text not null default '' check (length(janela) <= 40),
  -- Conteúdo mínimo: texto curto, uma `tag` (um aviso novo substitui o antigo) e um caminho do próprio app. Nunca dados
  -- de Adolescentes. Fica vazio até o agendador montar o texto.
  titulo text check (length(titulo) <= 80),
  texto text check (length(texto) <= 160),
  tag text check (length(tag) <= 60),
  url text check (url ~ '^/[^/]' or url = '/'),
  -- pendente: a enviar (ou esperando a janela, ou numa nova tentativa); enviada: chegou a algum dispositivo; falha: esgotou
  -- as tentativas sem chegar a nenhum; dispensada: a pessoa desligou o tipo ou não tem dispositivo (só a central);
  -- expirada: venceu a validade antes de enviar.
  estado text not null default 'pendente' check (estado in ('pendente', 'enviada', 'falha', 'dispensada', 'expirada')),
  -- Urgentes (mudança ou cancelamento de um Evento próximo) não esperam a janela de horário da pessoa.
  urgente boolean not null default false,
  tentativas smallint not null default 0,
  proxima_tentativa timestamptz not null default now(),
  -- Quem pega uma Notificação para enviar a reserva por alguns minutos: duas rodadas do agendador não a enviam em dobro.
  reservada_ate timestamptz,
  -- Os dispositivos que já receberam: uma nova tentativa só envia aos que faltam.
  entregue_a uuid[] not null default '{}',
  valida_ate timestamptz not null default now() + interval '48 hours',
  lida_em timestamptz,
  criada_em timestamptz not null default now(),
  enviada_em timestamptz
);

create unique index notificacoes_chave on public.notificacoes (
  tipo, coalesce(evento_id, '00000000-0000-0000-0000-000000000000'::uuid), pessoa_id, janela
);
create index notificacoes_a_enviar on public.notificacoes (proxima_tentativa) where estado = 'pendente';
create index notificacoes_da_pessoa on public.notificacoes (pessoa_id, criada_em desc);
create index notificacoes_nao_lidas on public.notificacoes (pessoa_id) where lida_em is null;
create index notificacoes_criada on public.notificacoes (criada_em);

alter table public.notificacoes enable row level security;

create policy "cada pessoa lê as próprias Notificações" on public.notificacoes for select to authenticated
  using (pessoa_id = (select auth.uid()));

create policy "cada pessoa marca as próprias Notificações como lidas" on public.notificacoes for update to authenticated
  using (pessoa_id = (select auth.uid()))
  with check (pessoa_id = (select auth.uid()));

-- Ninguém insere nem apaga pela interface: quem cria é o gatilho abaixo e quem envia é a chave de serviço. A pessoa só
-- marca como lida (e desmarca).
revoke all on public.notificacoes from anon, authenticated;
-- Só o que a central mostra: tentativas, reservas e ids de dispositivo ficam para o servidor.
grant select (id, pessoa_id, tipo, evento_id, titulo, texto, url, estado, lida_em, criada_em) on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;

-- Reserva as Notificações devidas para o agendador enviar: pendentes, já na hora e não reservadas por outra rodada.
-- `skip locked` faz duas rodadas simultâneas pegarem lotes diferentes.
create function public.reservar_notificacoes(limite integer default 50)
returns setof public.notificacoes
language sql
security definer
set search_path = ''
as $$
  with escolhidas as (
    select n.id
    from public.notificacoes n
    where n.estado = 'pendente'
      and n.proxima_tentativa <= now()
      and (n.reservada_ate is null or n.reservada_ate < now())
    order by n.proxima_tentativa
    limit least(greatest(coalesce(reservar_notificacoes.limite, 50), 1), 200)
    for update skip locked
  )
  update public.notificacoes n
  set reservada_ate = now() + interval '5 minutes'
  from escolhidas e
  where n.id = e.id
  returning n.*;
$$;

revoke execute on function public.reservar_notificacoes from public, anon, authenticated;
grant execute on function public.reservar_notificacoes to service_role;

-- Cria uma Notificação, se a pessoa deve recebê-la: conta ativa de nível aprovado, tipo não desligado, e não é a própria
-- pessoa que fez a mudança. A chave única descarta a repetição. Dentro de uma Série, uma mudança que atinge várias
-- Ocorrências de uma vez (a mesma transação) avisa uma vez só.
create function public.criar_notificacao(tipo text, evento uuid, serie uuid, pessoa uuid, janela text, niveis text[])
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

  insert into public.notificacoes (pessoa_id, tipo, evento_id, janela)
  values (pessoa, criar_notificacao.tipo, evento, janela)
  on conflict do nothing;
end;
$$;

revoke execute on function public.criar_notificacao from public, anon, authenticated;

-- Designação: quem passou a ser Responsável (Liderança) ou Professor/Auxiliar de um Evento é avisado. O aviso é só um
-- acréscimo ao salvar o Evento: se falhar, o Evento é salvo do mesmo jeito.
create function public.notificar_designacoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  janela text := to_char(now() at time zone 'America/Bahia', 'YYYY-MM-DD');
  campo uuid;
  antes text;
  depois text;
begin
  if new.status in ('cancelado', 'realizado') then
    return null;
  end if;

  if new.responsavel_id is not null and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id) then
    perform public.criar_notificacao('designacao_responsavel', new.id, new.serie_id, new.responsavel_id, janela, array['admin', 'lider']);
  end if;

  for campo in
    select c.id from public.campos_das_categorias c
    where c.categoria_id = new.categoria_id and c.tipo = 'pessoa' and c.nome in ('Professor', 'Auxiliar')
  loop
    depois := new.campos ->> campo::text;
    antes := case when tg_op = 'UPDATE' then old.campos ->> campo::text end;
    if depois ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and depois is distinct from antes then
      perform public.criar_notificacao('designacao_aula', new.id, new.serie_id, depois::uuid, janela, array['admin', 'lider', 'professor']);
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'designação não notificada: %', sqlerrm;
  return null;
end;
$$;

create trigger ao_designar_pessoas
  after insert or update on public.eventos
  for each row execute function public.notificar_designacoes();

-- Quanto tempo a central guarda as Notificações, em dias; a limpeza roda todo dia de madrugada.
alter table public.configuracoes
  add column retencao_das_notificacoes_dias integer not null default 30 check (retencao_das_notificacoes_dias between 1 and 365);
grant update (retencao_das_notificacoes_dias) on public.configuracoes to authenticated;

create function public.limpar_notificacoes()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notificacoes n
  where n.criada_em < now() - make_interval(days => (select c.retencao_das_notificacoes_dias from public.configuracoes c))
    -- Uma pendente ainda dentro da validade ainda vai ser enviada.
    and (n.estado <> 'pendente' or n.valida_ate < now());
$$;

revoke execute on function public.limpar_notificacoes from public, anon, authenticated;
select cron.schedule('limpar-notificacoes', '30 3 * * *', 'select public.limpar_notificacoes()');

-- Log do agendador: só as ações dele, com texto curto e sem endpoint, chave ou dado de Adolescente. Só a chave de serviço
-- chama. `notificacao.simulada` é o modo de teste (o que seria enviado); `notificacao.falhou` é a falha definitiva.
create function public.registrar_log_do_agendador(acao text, rotulo text, detalhes jsonb default '{}', resultado text default 'sucesso', severidade text default 'info')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if registrar_log_do_agendador.acao not in ('notificacao.simulada', 'notificacao.falhou') then
    raise exception 'ação não permitida' using errcode = '42501';
  end if;
  perform public.gravar_log(
    registrar_log_do_agendador.acao, 'notificacao', null, left(registrar_log_do_agendador.rotulo, 120),
    coalesce(registrar_log_do_agendador.detalhes, '{}'), registrar_log_do_agendador.resultado, registrar_log_do_agendador.severidade
  );
end;
$$;

revoke execute on function public.registrar_log_do_agendador from public, anon, authenticated;
grant execute on function public.registrar_log_do_agendador to service_role;

-- O agendador: a cada minuto, se há Notificação devida, o `pg_cron` chama com `pg_net` a rota do app que processa a fila,
-- pela mesma `chamar_agendador` das pastas do Drive (a URL do app e o `CRON_SECRET` ficam no Vault; sem eles nada é chamado).
/** Todo minuto: se há Notificação devida, chama o app; senão, nem gasta uma chamada. */
create function public.processar_notificacoes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.notificacoes n
    where n.estado = 'pendente' and n.proxima_tentativa <= now() and (n.reservada_ate is null or n.reservada_ate < now())
  ) then
    perform public.chamar_agendador('notificacoes');
  end if;
end;
$$;

revoke execute on function public.processar_notificacoes from public, anon, authenticated;
select cron.schedule('processar-notificacoes', '* * * * *', 'select public.processar_notificacoes()');

-- Como reverter:
-- select cron.unschedule('processar-notificacoes'); select cron.unschedule('limpar-notificacoes');
-- drop function public.processar_notificacoes, public.registrar_log_do_agendador, public.limpar_notificacoes;
-- alter table public.configuracoes drop column retencao_das_notificacoes_dias;
-- drop trigger ao_designar_pessoas on public.eventos;
-- drop function public.notificar_designacoes, public.criar_notificacao, public.reservar_notificacoes;
-- drop table public.notificacoes, public.preferencias_de_notificacao;
-- drop function public.log_das_preferencias_de_notificacao;
