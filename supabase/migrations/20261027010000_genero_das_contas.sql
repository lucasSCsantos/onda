-- Gênero das contas (ticket 05 de formulários, horários, gênero e observações).
-- Coluna opcional e aditiva em perfis: masculino ou feminino; perfis antigos ficam nulos ("não informado").
-- Obrigatório no cadastro novo, mas verificado na ação do servidor e no domínio (src/dominio/genero.ts), nunca no
-- gatilho de criação de perfil, para não arriscar o fluxo de contas: aqui o gatilho só grava o que vier válido.
-- Leitura: as políticas de perfis já existentes (aprovados e a Liderança). Nunca vai para o .ics, Notificações ou exportações.
-- Escrita: sem privilégio de coluna em `perfis` (o `ativo` é editável pelo Admin, e uma política de "própria linha" o
-- liberaria também à própria pessoa); a função abaixo muda só o Gênero, da própria pessoa aprovada ou, pelo Admin, de qualquer uma.

alter table public.perfis
  add column genero text check (genero in ('masculino', 'feminino'));

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  codigo_do_convite text := nullif(dados ->> 'convite', '');
  convite public.convites;
begin
  insert into public.perfis (id, nome, email, data_nascimento, genero)
  values (
    new.id,
    coalesce(dados ->> 'nome', ''),
    coalesce(new.email, ''),
    nullif(dados ->> 'data_nascimento', '')::date,
    case when dados ->> 'genero' in ('masculino', 'feminino') then dados ->> 'genero' end
  );

  if codigo_do_convite is null then
    return new;
  end if;

  select * into convite from public.convites c where c.codigo = codigo_do_convite for update;
  if not found or public.situacao_do_convite(convite) <> 'valido' then
    raise exception 'convite inválido' using errcode = 'P0001';
  end if;

  update public.perfis set nivel = convite.nivel where id = new.id;
  if convite.funcao_id is not null then
    insert into public.funcoes_das_pessoas (pessoa_id, funcao_id) values (new.id, convite.funcao_id);
  end if;
  update public.convites set usado_por = new.id, usado_em = now() where id = convite.id;

  return new;
end;
$$;

/** A própria pessoa (aprovada e ativa) ou o Admin define o Gênero; nada mais do perfil muda por aqui. */
create function public.definir_genero(pessoa uuid, novo_genero text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if novo_genero is null or novo_genero not in ('masculino', 'feminino') then
    raise exception 'escolha o Gênero' using errcode = 'P0001';
  end if;
  if not (
    public.e_admin()
    or (pessoa = (select auth.uid()) and coalesce(public.meu_nivel() <> 'pendente', false))
  ) then
    raise exception 'sem permissão para alterar o Gênero' using errcode = '42501';
  end if;

  update public.perfis set genero = novo_genero where id = pessoa;
  if not found then
    raise exception 'pessoa não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.definir_genero from public, anon;
grant execute on function public.definir_genero to authenticated;

-- O Log diz só que o Gênero mudou (tipo "oculto"), sem o valor. Mesma `log_do_perfil` de antes, com essa mudança a mais.
create or replace function public.log_do_perfil()
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
  if new.genero is distinct from old.genero then
    mudancas := mudancas || jsonb_build_object('rotulo', 'Gênero', 'tipo', 'oculto');
  end if;
  if jsonb_array_length(mudancas) > 0 and not public.no_lote('conta_nova', new.id::text) then
    perform public.gravar_log('conta.editada', 'conta', new.id::text, nullif(btrim(new.nome), ''), jsonb_build_object('mudancas', mudancas));
  end if;
  return null;
end;
$$;

-- Como reverter:
-- 1. Recrie `criar_perfil` a partir de 20261021010000_contas.sql e `log_do_perfil` a partir de 20261022000000_logs.sql.
-- 2. drop function public.definir_genero(uuid, text);
-- 3. alter table public.perfis drop column genero;
