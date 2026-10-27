-- Gênero dos Adolescentes (ticket 04 de formulários, horários, gênero e observações).
-- Coluna opcional e aditiva: masculino ou feminino; registros antigos ficam nulos ("não informado").
-- Obrigatório em Adolescente novo: o gatilho vale só em INSERT e nunca bloqueia atualizar um registro antigo
-- (inativar, por exemplo). Leitura e escrita seguem as políticas de sempre (só a Liderança aprovada).
-- Nunca vai para o .ics, Notificações ou exportações: as consultas que servem a esses canais escolhem colunas
-- (nome, nascimento) e não tocam no Gênero.

alter table public.adolescentes
  add column genero text check (genero in ('masculino', 'feminino'));

create function public.exigir_genero_do_adolescente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.genero is null then
    raise exception 'escolha o Gênero do Adolescente' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger exigir_genero_ao_cadastrar
  before insert on public.adolescentes
  for each row execute function public.exigir_genero_do_adolescente();

grant insert (genero), update (genero) on public.adolescentes to authenticated;

-- O Log diz só que o Gênero mudou (tipo "oculto"), sem o valor. Mesma `log_do_adolescente` de antes, com essa mudança a mais.
create or replace function public.log_do_adolescente()
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
  if new.genero is distinct from old.genero then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Gênero', 'tipo', 'oculto');
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

-- Como reverter:
-- 1. Recrie `log_do_adolescente` a partir de 20261022000000_logs.sql.
-- 2. drop trigger exigir_genero_ao_cadastrar on public.adolescentes;
--    drop function public.exigir_genero_do_adolescente();
-- 3. revoke insert (genero), update (genero) on public.adolescentes from authenticated;
--    alter table public.adolescentes drop column genero;
