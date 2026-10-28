-- Horários padrão por Categoria (ticket 03 de formulários, horários, gênero e observações).
-- Cada Categoria pode ter um horário de início e uma duração padrão, ambos opcionais; o formulário de Evento novo já
-- abre com eles. Só adições: Eventos existentes e a edição nunca são tocados, e mudar o padrão não altera nada já criado.
-- Só o Admin muda (a política "o Admin edita Categorias" já vale; aqui só se libera a coluna). Os valores iniciais não
-- são ação de alguém, então não viram Log; mudanças depois deles, sim (`log_do_catalogo`).
-- Espelha src/dominio/horarios-padrao.ts.

alter table public.categorias
  add column horario_padrao time,
  add column duracao_padrao_minutos integer check (duracao_padrao_minutos between 1 and 1439);

grant update (horario_padrao, duracao_padrao_minutos) on public.categorias to authenticated;

alter table public.categorias disable trigger ao_alterar_categoria;
update public.categorias set horario_padrao = '09:00' where nome = 'EBD';
update public.categorias set horario_padrao = '15:00' where nome = 'Pequeno grupo';
alter table public.categorias enable trigger ao_alterar_categoria;

-- A mesma `log_do_catalogo` dos campos comuns, agora com o horário padrão da Categoria (valores legíveis, sem segundos).
create or replace function public.log_do_catalogo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}' end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}' end;
  linha jsonb := case when tg_op = 'DELETE' then antes else depois end;
  mudancas jsonb;
begin
  -- `area_id` vira o nome da Área; `categoria_id` e `ordem` não interessam a quem lê.
  select coalesce(jsonb_agg(jsonb_build_object(
      'rotulo', case chave when 'nome' then 'Nome' when 'area_id' then 'Área' when 'cor' then 'Cor' when 'tipo' then 'Tipo'
        when 'obrigatorio' then 'Obrigatório' when 'opcoes' then 'Opções' when 'tem_chamada' then 'Tem chamada'
        when 'nativo_local' then 'Campo Local' when 'nativo_fim' then 'Campo Fim' when 'nativo_observacoes' then 'Campo Observações'
        when 'nativo_link' then 'Campo Link' when 'horario_padrao' then 'Horário padrão' when 'duracao_padrao_minutos' then 'Duração padrão (min)' else chave end,
      'tipo', case chave when 'obrigatorio' then 'booleano' when 'tem_chamada' then 'booleano' when 'opcoes' then 'lista' else 'texto' end,
      'antes', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = antes ->> chave)
        when chave like 'nativo\_%' then to_jsonb(case antes ->> chave when 'oculto' then 'Oculto' when 'obrigatorio' then 'Obrigatório' else 'Visível' end)
        when chave = 'horario_padrao' then coalesce(to_jsonb(left(antes ->> chave, 5)), 'null')
        else coalesce(antes -> chave, 'null') end,
      'depois', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = depois ->> chave)
        when chave like 'nativo\_%' then to_jsonb(case depois ->> chave when 'oculto' then 'Oculto' when 'obrigatorio' then 'Obrigatório' else 'Visível' end)
        when chave = 'horario_padrao' then coalesce(to_jsonb(left(depois ->> chave, 5)), 'null')
        else coalesce(depois -> chave, 'null') end
    )), '[]')
  into mudancas
  from jsonb_object_keys(antes || depois) chave
  where chave in ('nome', 'area_id', 'cor', 'tipo', 'obrigatorio', 'opcoes', 'tem_chamada', 'nativo_local', 'nativo_fim', 'nativo_observacoes', 'nativo_link', 'horario_padrao', 'duracao_padrao_minutos')
    and tg_op = 'UPDATE'
    and (antes -> chave) is distinct from (depois -> chave);

  if tg_op = 'UPDATE' and mudancas = '[]' then
    return null;
  end if;

  if tg_table_name = 'funcoes' then
    perform public.gravar_log(
      case tg_op when 'INSERT' then 'funcao.criada' else 'funcao.editada' end,
      'funcao', linha ->> 'id', linha ->> 'nome',
      jsonb_build_object('area', (select a.nome from public.areas a where a.id::text = linha ->> 'area_id'), 'mudancas', mudancas)
    );
  elsif tg_table_name = 'categorias' then
    perform public.gravar_log(
      case tg_op when 'INSERT' then 'categoria.criada' else 'categoria.editada' end,
      'categoria', linha ->> 'id', linha ->> 'nome',
      jsonb_build_object('area', (select a.nome from public.areas a where a.id::text = linha ->> 'area_id'), 'mudancas', mudancas)
    );
  else
    perform public.gravar_log(
      case tg_op when 'INSERT' then 'categoria.campo_adicionado' when 'UPDATE' then 'categoria.campo_editado' else 'categoria.campo_removido' end,
      'categoria', linha ->> 'categoria_id',
      (select c.nome from public.categorias c where c.id::text = linha ->> 'categoria_id'),
      jsonb_build_object('campo', linha ->> 'nome', 'mudancas', mudancas)
    );
  end if;
  return null;
end;
$$;

-- Como reverter (os Eventos não são tocados em nenhum passo):
-- 1. Recrie `log_do_catalogo` a partir de 20261023020000_campos_nativos.sql.
-- 2. alter table public.categorias drop column horario_padrao, drop column duracao_padrao_minutos;
