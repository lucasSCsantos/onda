-- Push: ativar neste aparelho (ticket 12 de .scratch/drive-agenda-avisos): uma inscrição por dispositivo de cada pessoa
-- da Liderança ou Professor. O endpoint e as chaves de cada inscrição são segredos de envio: a interface nunca os lê (nem o
-- dono), só a chave service-role, que envia. A pessoa vê e remove os próprios dispositivos pelo nome, pela data e por um
-- hash do endpoint, que serve para reconhecer "este aparelho" sem revelar o endpoint.

-- `convert_to` é só "stable" no Postgres, mas com a codificação fixa em UTF8 o resultado nunca muda: o rótulo "immutable"
-- é o que deixa a coluna gerada existir.
create function public.hash_do_endpoint(endpoint text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(endpoint, 'UTF8')), 'hex');
$$;

create table public.inscricoes_de_push (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.perfis (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 2000),
  endpoint_hash text generated always as (public.hash_do_endpoint(endpoint)) stored,
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  nome text not null default 'Aparelho' check (length(nome) between 1 and 80),
  criado_em timestamptz not null default now(),
  -- A última vez que um envio a este dispositivo deu certo.
  usado_em timestamptz
);

create index inscricoes_de_push_pessoa on public.inscricoes_de_push (pessoa_id);

alter table public.inscricoes_de_push enable row level security;

-- Só o dono lê e remove as próprias. Cadastrar passa pela função abaixo, que confere o nível e troca de dono o aparelho
-- que mudou de mãos; a interface não insere nem edita direto.
create policy "o dono lê os próprios dispositivos" on public.inscricoes_de_push for select to authenticated
  using (pessoa_id = (select auth.uid()));

create policy "o dono remove os próprios dispositivos" on public.inscricoes_de_push for delete to authenticated
  using (pessoa_id = (select auth.uid()));

revoke all on public.inscricoes_de_push from anon, authenticated;
grant select (id, pessoa_id, endpoint_hash, nome, criado_em, usado_em) on public.inscricoes_de_push to authenticated;
grant delete on public.inscricoes_de_push to authenticated;

/**
 * Cadastra (ou atualiza) a inscrição deste dispositivo para quem está logado. Se o mesmo aparelho estava inscrito por
 * outra pessoa (conta trocada sem sair), a inscrição antiga some e vira desta. No máximo 10 dispositivos por pessoa.
 * Devolve o id e o hash do endpoint, nunca o endpoint.
 */
create function public.registrar_inscricao_de_push(endereco text, chave_p256dh text, chave_auth text, apelido text default null)
returns table (id uuid, endpoint_hash text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  rotulo text := coalesce(nullif(left(btrim(apelido), 80), ''), 'Aparelho');
begin
  if eu is null or not coalesce(public.meu_nivel() in ('admin', 'lider', 'professor'), false) then
    raise exception 'sem permissão para ativar as Notificações' using errcode = '42501';
  end if;

  delete from public.inscricoes_de_push i
  where i.endpoint = endereco and i.pessoa_id <> eu;

  if not exists (select 1 from public.inscricoes_de_push i where i.endpoint = endereco)
     and (select count(*) from public.inscricoes_de_push i where i.pessoa_id = eu) >= 10 then
    raise exception 'limite de 10 dispositivos' using errcode = 'P0001';
  end if;

  return query
  insert into public.inscricoes_de_push as i (pessoa_id, endpoint, p256dh, auth, nome)
  values (eu, endereco, chave_p256dh, chave_auth, rotulo)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, nome = excluded.nome
  returning i.id, i.endpoint_hash;
end;
$$;

revoke execute on function public.registrar_inscricao_de_push from public, anon;
grant execute on function public.registrar_inscricao_de_push to authenticated;

-- Log: ativar e desativar. Só o nome do dispositivo entra no registro, nunca o endpoint nem as chaves. A remoção que a
-- chave de serviço faz (o serviço de push respondeu 404 ou 410) é "expirado", não uma escolha da pessoa.
create function public.log_da_inscricao_de_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  papel text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  linha public.inscricoes_de_push := case tg_op when 'DELETE' then old else new end;
begin
  perform public.gravar_log(
    case when tg_op = 'INSERT' then 'push.ativado' when papel = 'service_role' then 'push.expirado' else 'push.desativado' end,
    'dispositivo', linha.id::text, linha.nome, '{}', 'sucesso', 'info', linha.pessoa_id
  );
  return null;
end;
$$;

create trigger ao_ativar_push
  after insert on public.inscricoes_de_push
  for each row execute function public.log_da_inscricao_de_push();

create trigger ao_desativar_push
  after delete on public.inscricoes_de_push
  for each row execute function public.log_da_inscricao_de_push();

-- Log da Notificação de teste: o app envia e depois registra aqui só as contagens. `registrar_log` só aceita falhas.
create function public.registrar_teste_de_push(enviados integer, falhas integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
begin
  if eu is null or not coalesce(public.meu_nivel() in ('admin', 'lider', 'professor'), false) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform public.gravar_log(
    'push.teste_enviado', 'conta', eu::text, (select nullif(btrim(p.nome), '') from public.perfis p where p.id = eu),
    jsonb_build_object('enviados', least(greatest(registrar_teste_de_push.enviados, 0), 10), 'falhas', least(greatest(registrar_teste_de_push.falhas, 0), 10))
  );
end;
$$;

revoke execute on function public.registrar_teste_de_push from public, anon;
grant execute on function public.registrar_teste_de_push to authenticated;

-- Como reverter:
-- drop function public.registrar_teste_de_push, public.hash_do_endpoint, public.log_da_inscricao_de_push, public.registrar_inscricao_de_push;
-- drop table public.inscricoes_de_push;
