-- Observações da Liderança sobre um Adolescente (ticket 06 de formulários, horários, gênero e observações).
-- Texto simples, em entradas separadas, cada uma com autor e datas. Quem acessa é decidido aqui, no banco:
-- - Admin e Líder (ativos) leem e criam; Professor, Pendente, conta desativada e anônimo não veem nada;
-- - só o autor e o Admin editam e apagam;
-- - o autor vem da sessão (coluna com `default auth.uid()`, fora dos privilégios de escrita: o formulário não o informa);
-- - a data da última edição é atualizada por gatilho;
-- - texto não vazio e de até 2.000 caracteres, por check.
-- Observações de Adolescente inativo seguem existindo e visíveis. Adolescentes nunca são excluídos (só inativados), então
-- nada as apaga; a chave estrangeira usa `on delete cascade` só por segurança, para não deixar linha órfã. Qualquer
-- remoção futura de Adolescente deve gerar Log (cada Observação removida em cascata gera o dela).
-- O texto nunca vai para o Log, Notificações, .ics, exportações CSV nem busca: o Log guarda só a ação, o Adolescente
-- (como rótulo) e quem fez.

create table public.observacoes (
  id uuid primary key default gen_random_uuid(),
  adolescente_id uuid not null references public.adolescentes (id) on delete cascade,
  texto text not null check (texto !~ '^[[:space:]]*$' and char_length(texto) <= 2000),
  -- Nulo só quando a conta de quem escreveu é removida (recusa de Pendente não chega aqui; contas de Líder são desativadas).
  autor_id uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  editado_em timestamptz not null default now()
);

create index observacoes_do_adolescente on public.observacoes (adolescente_id, criado_em, id);

alter table public.observacoes enable row level security;

create policy "a Liderança lê as Observações" on public.observacoes for select to authenticated
  using ((select public.e_lideranca()));

create policy "a Liderança escreve Observações em seu nome" on public.observacoes for insert to authenticated
  with check ((select public.e_lideranca()) and autor_id = (select auth.uid()));

create policy "o autor e o Admin editam Observações" on public.observacoes for update to authenticated
  using ((select public.e_admin()) or ((select public.e_lideranca()) and autor_id = (select auth.uid())))
  with check ((select public.e_admin()) or ((select public.e_lideranca()) and autor_id = (select auth.uid())));

create policy "o autor e o Admin apagam Observações" on public.observacoes for delete to authenticated
  using ((select public.e_admin()) or ((select public.e_lideranca()) and autor_id = (select auth.uid())));

revoke all on public.observacoes from anon, authenticated;
grant select, delete on public.observacoes to authenticated;
-- Sem `autor_id` nem as datas: o banco preenche.
grant insert (adolescente_id, texto), update (texto) on public.observacoes to authenticated;

create function public.carimbar_observacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.editado_em := now();
  return new;
end;
$$;

create trigger ao_editar_observacao
  before update on public.observacoes
  for each row execute function public.carimbar_observacao();

-- Logs ----------------------------------------------------------------------------

/** A mesma de 20261023040000_pasta_do_evento.sql, com as Observações no módulo dos Adolescentes. */
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
    when 'observacao' then 'adolescentes'
    when 'presenca' then 'presenca'
    when 'marcacao' then 'presenca'
    when 'ranking' then 'ranking'
    when 'drive' then 'drive'
    else 'administracao'
  end;
$$;

-- Adicionar, editar e apagar: só a ação, o Adolescente (rótulo) e quem fez. NUNCA o texto, nem em `detalhes`.
-- Editar sem mudar o texto não gera Log.
create function public.log_da_observacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo uuid := coalesce(new.adolescente_id, old.adolescente_id);
  nome text := (select a.nome from public.adolescentes a where a.id = alvo);
begin
  if tg_op = 'INSERT' then
    perform public.gravar_log('observacao.adicionada', 'adolescente', alvo::text, nome);
  elsif tg_op = 'UPDATE' then
    if new.texto is distinct from old.texto then
      perform public.gravar_log('observacao.editada', 'adolescente', alvo::text, nome);
    end if;
  else
    perform public.gravar_log('observacao.apagada', 'adolescente', alvo::text, nome);
  end if;
  return null;
end;
$$;

create trigger observacao_gera_log
  after insert or update or delete on public.observacoes
  for each row execute function public.log_da_observacao();

-- Como reverter:
-- 1. drop trigger observacao_gera_log on public.observacoes; drop function public.log_da_observacao();
-- 2. Recrie `modulo_da_acao` a partir de 20261023040000_pasta_do_evento.sql (sem 'observacao').
-- 3. drop table public.observacoes; (apaga as Observações: exporte antes, se precisar; `carimbar_observacao` cai junto
--    com o gatilho, depois `drop function public.carimbar_observacao();`)
-- 4. Os Logs `observacao.*` já gravados ficam (a tela os mostra com o nome genérico); apague-os se quiser.
