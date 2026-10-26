-- Push: administração (ticket 15 de .scratch/drive-agenda-avisos). O Admin liga e desliga o canal de Notificações, ajusta os
-- horários dos lembretes e do resumo semanal, e vê a fila e quantas pessoas têm dispositivo. Só acréscimos: colunas novas em
-- `configuracoes` (cada mudança vira log pelo gatilho que já olha toda coluna) e três funções de leitura só do Admin.

-- Desligado, a rota do agendador não gera nem envia nada: as Notificações já na fila esperam (ou vencem a validade).
alter table public.configuracoes
  add column notificacoes_ligadas boolean not null default true,
  -- Quantas horas antes do início saem os dois lembretes dos Eventos (o primeiro, na véspera; o segundo, perto do início).
  add column lembrete_longo_horas integer not null default 24 check (lembrete_longo_horas between 3 and 72),
  add column lembrete_curto_horas integer not null default 2 check (lembrete_curto_horas between 1 and 12),
  -- A hora (de domingo, no fuso do Mural) em que sai o resumo da semana.
  add column hora_do_resumo_semanal integer not null default 19 check (hora_do_resumo_semanal between 0 and 23),
  add constraint lembrete_curto_depois_do_longo check (lembrete_curto_horas < lembrete_longo_horas);

grant update (notificacoes_ligadas, lembrete_longo_horas, lembrete_curto_horas, hora_do_resumo_semanal) on public.configuracoes to authenticated;

-- Quantas Notificações há em cada estado. Só o Admin lê.
create function public.resumo_da_fila_de_notificacoes()
returns table (estado text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.meu_nivel() is distinct from 'admin' then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return query
    select n.estado, count(*) from public.notificacoes n group by n.estado;
end;
$$;

-- As Notificações de um estado (pendente, enviada ou falha), as mais recentes primeiro. Só o que ajuda a operar a fila: o
-- tipo, para quem (a pessoa da equipe), o estado e os tempos. Nunca o texto, o endpoint nem as chaves dos dispositivos.
create function public.fila_de_notificacoes(situacao text, limite integer default 30)
returns table (id uuid, tipo text, estado text, pessoa text, urgente boolean, tentativas smallint, criada_em timestamptz, proxima_tentativa timestamptz, enviada_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.meu_nivel() is distinct from 'admin' then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if fila_de_notificacoes.situacao not in ('pendente', 'enviada', 'falha') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  return query
    select n.id, n.tipo, n.estado, coalesce(nullif(btrim(p.nome), ''), 'Sem nome'), n.urgente, n.tentativas, n.criada_em, n.proxima_tentativa, n.enviada_em
    from public.notificacoes n
    join public.perfis p on p.id = n.pessoa_id
    where n.estado = fila_de_notificacoes.situacao
    order by n.criada_em desc
    limit least(greatest(coalesce(fila_de_notificacoes.limite, 30), 1), 100);
end;
$$;

-- Quantas pessoas com conta ativa têm ao menos um dispositivo cadastrado.
create function public.pessoas_com_dispositivo()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.meu_nivel() is distinct from 'admin' then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return (
    select count(distinct i.pessoa_id)::integer
    from public.inscricoes_de_push i
    join public.perfis p on p.id = i.pessoa_id and p.ativo
  );
end;
$$;

revoke execute on function public.resumo_da_fila_de_notificacoes, public.fila_de_notificacoes, public.pessoas_com_dispositivo from public, anon;
grant execute on function public.resumo_da_fila_de_notificacoes, public.fila_de_notificacoes, public.pessoas_com_dispositivo to authenticated;

-- Como reverter:
-- drop function public.pessoas_com_dispositivo, public.fila_de_notificacoes, public.resumo_da_fila_de_notificacoes;
-- alter table public.configuracoes drop constraint lembrete_curto_depois_do_longo, drop column hora_do_resumo_semanal,
--   drop column lembrete_curto_horas, drop column lembrete_longo_horas, drop column notificacoes_ligadas;
