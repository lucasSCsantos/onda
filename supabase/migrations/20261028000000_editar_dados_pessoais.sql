-- Dados pessoais (nome, data de nascimento, Gênero): só a própria pessoa edita os seus, em Minha conta.
-- O Admin deixa de poder alterar dados pessoais de outras pessoas (só Funções, nível e ativação, como antes).
-- Substitui `definir_genero` (20261027010000), que deixava o Admin definir o Gênero de qualquer pessoa.
-- Não há privilégio de coluna em `perfis` (ele também liberaria o `ativo`): a escrita passa por esta função, que só
-- mexe nas três colunas e só na linha de quem está logado. O Log sai de `log_do_perfil`: o nome aparece, a data de
-- nascimento e o Gênero só como "alterados" (sem o valor).

drop function public.definir_genero(uuid, text);

create function public.editar_meus_dados(novo_nome text, novo_nascimento date, novo_genero text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.meu_nivel() = 'pendente', true) then
    raise exception 'sem permissão para editar os dados' using errcode = '42501';
  end if;
  if novo_nome is null or btrim(novo_nome) = '' then
    raise exception 'informe o nome' using errcode = 'P0001';
  end if;
  if novo_nascimento is null or novo_nascimento > (now() at time zone 'America/Bahia')::date then
    raise exception 'informe uma data de nascimento válida' using errcode = 'P0001';
  end if;
  if novo_genero is null or novo_genero not in ('masculino', 'feminino') then
    raise exception 'escolha o Gênero' using errcode = 'P0001';
  end if;

  update public.perfis
    set nome = btrim(novo_nome), data_nascimento = novo_nascimento, genero = novo_genero
    where id = (select auth.uid());
end;
$$;

revoke execute on function public.editar_meus_dados from public, anon;
grant execute on function public.editar_meus_dados to authenticated;

-- Como reverter:
-- drop function public.editar_meus_dados(text, date, text);
-- e recriar `definir_genero` como em 20261027010000_genero_das_contas.sql.
