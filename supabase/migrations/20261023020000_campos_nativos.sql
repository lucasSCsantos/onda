-- Campos comuns por Categoria (ticket 02 de campos, Drive, agenda e avisos; ADR 0008).
-- Local, fim, observações e link continuam colunas de todo Evento. Cada Categoria diz se cada um fica oculto,
-- visível ou obrigatório. Só adições: o padrão é "visível", então nenhuma Categoria muda sem ação do Admin,
-- exceto pelos valores iniciais da auditoria abaixo. Nenhum valor antigo é apagado: o oculto só deixa de ser
-- mostrado e gravado. As regras espelham src/dominio/campos-nativos.ts e lerEvento (src/dominio/eventos.ts).

create type public.visibilidade_do_campo as enum ('oculto', 'visivel', 'obrigatorio');

alter table public.categorias
  add column nativo_local public.visibilidade_do_campo not null default 'visivel',
  add column nativo_fim public.visibilidade_do_campo not null default 'visivel',
  add column nativo_observacoes public.visibilidade_do_campo not null default 'visivel',
  add column nativo_link public.visibilidade_do_campo not null default 'visivel';

grant insert (nativo_local, nativo_fim, nativo_observacoes, nativo_link),
  update (nativo_local, nativo_fim, nativo_observacoes, nativo_link)
  on public.categorias to authenticated;

-- Auditoria campo a campo (mesmo conteúdo de NATIVOS_INICIAIS). Ficam visíveis todos os campos que não aparecem aqui.
--   Categoria             local        fim      observações  link
--   EBD                   visível      visível  visível      oculto (já tem "Link do material")
--   Pequeno grupo         visível      visível  visível      oculto (ganha "Link do material", abaixo)
--   Culto                 visível      visível  oculto       visível (já tem "Observações da liturgia")
--   Ensaio de louvor      visível      visível  oculto       oculto (já tem "Repertório" e "Observações")
--   Reunião de liderança  visível      visível  visível      oculto (já tem "Link da ata")
--   Postagem              oculto       oculto   visível      oculto (já tem "Link da arte ou do post")
--   Evento extra          obrigatório  visível  visível      oculto (já tem "Link de inscrição")
--   Acampamento           obrigatório  visível  oculto       oculto (já tem "Anotações" e quatro links)
--   Serviço               visível      visível  oculto       visível (já tem "Descrição da ação")
-- Os valores iniciais não são ação de alguém, então não viram Log.
alter table public.categorias disable trigger ao_alterar_categoria;

update public.categorias c set
  nativo_local = a.local::public.visibilidade_do_campo,
  nativo_fim = a.fim::public.visibilidade_do_campo,
  nativo_observacoes = a.observacoes::public.visibilidade_do_campo,
  nativo_link = a.link::public.visibilidade_do_campo
from (values
  ('EBD', 'visivel', 'visivel', 'visivel', 'oculto'),
  ('Pequeno grupo', 'visivel', 'visivel', 'visivel', 'oculto'),
  ('Culto', 'visivel', 'visivel', 'oculto', 'visivel'),
  ('Ensaio de louvor', 'visivel', 'visivel', 'oculto', 'oculto'),
  ('Reunião de liderança', 'visivel', 'visivel', 'visivel', 'oculto'),
  ('Postagem', 'oculto', 'oculto', 'visivel', 'oculto'),
  ('Evento extra', 'obrigatorio', 'visivel', 'visivel', 'oculto'),
  ('Acampamento', 'obrigatorio', 'visivel', 'oculto', 'oculto'),
  ('Serviço', 'visivel', 'visivel', 'oculto', 'visivel')
) as a (nome, local, fim, observacoes, link)
where c.nome = a.nome;

alter table public.categorias enable trigger ao_alterar_categoria;

-- O Pequeno grupo ganha o "Link do material", como a EBD. Aditivo: nenhum Evento existente é tocado.
insert into public.campos_das_categorias (categoria_id, nome, tipo, obrigatorio, opcoes, ordem)
select c.id, 'Link do material', 'link', false, '{}', 3
from public.categorias c
where c.nome = 'Pequeno grupo'
on conflict do nothing;

-- Validação ---------------------------------------------------------------------

/**
 * A mesma `conferir_evento` do ticket de Professores, com a configuração dos campos comuns da Categoria: o oculto é
 * ignorado (na criação fica vazio; na edição, o valor gravado fica, sem apagar nada) e o obrigatório precisa de valor
 * ao criar ou quando muda, como os campos específicos.
 */
create or replace function public.conferir_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  editando boolean := tg_op = 'UPDATE';
  eu uuid := (select auth.uid());
  campo public.campos_das_categorias;
  valor jsonb;
  config record;
begin
  if not editando and new.status = 'realizado' then
    raise exception 'um Evento novo não nasce Realizado' using errcode = 'P0001';
  end if;

  if not editando and new.serie_id is not null and not exists (
    select 1 from public.series s where s.id = new.serie_id and s.categoria_id = new.categoria_id
  ) then
    raise exception 'a Série precisa ser da mesma Categoria do Evento' using errcode = 'P0001';
  end if;

  if editando then
    -- O Professor não muda Status, data nem Responsável, nem nada além das observações.
    if eu is not null and public.meu_nivel() = 'professor'
      and (to_jsonb(new) - 'observacoes') is distinct from (to_jsonb(old) - 'observacoes') then
      raise exception 'o Professor edita só as observações' using errcode = '42501';
    end if;

    -- Diante da Série, uma Ocorrência Realizada ou Cancelada fica congelada: só o Admin a edita, e só ela.
    -- O Professor fica de fora: ele só mexe nas observações (conferido acima), e é depois da aula que as escreve.
    if old.serie_id is not null
      and eu is not null
      and not public.e_admin()
      and public.meu_nivel() is distinct from 'professor'
      and public.status_no_momento(old.status, old.inicio, old.fim, old.dia_inteiro) in ('realizado', 'cancelado') then
      raise exception 'uma Ocorrência Realizada ou Cancelada só o Admin edita' using errcode = '42501';
    end if;

    if old.status = 'adiado' and new.status = 'adiado'
      and (new.inicio, new.fim, new.dia_inteiro) is distinct from (old.inicio, old.fim, old.dia_inteiro) then
      new.status := 'planejado';
    end if;

    if new.status = 'realizado'
      and public.status_no_momento(old.status, old.inicio, old.fim, old.dia_inteiro) <> 'realizado'
      and eu is not null
      and not public.pode_marcar_realizado(old.responsavel_id, new.inicio, new.fim, new.dia_inteiro) then
      raise exception 'só o Admin e o Responsável marcam Realizado, e só depois do fim' using errcode = '42501';
    end if;

    if new.status = 'realizado' and now() < public.fim_do_evento(new.inicio, new.fim, new.dia_inteiro) then
      raise exception 'um Evento só fica Realizado depois do fim' using errcode = 'P0001';
    end if;

    if eu is not null then
      new.editado_por := eu;
      new.editado_em := now();
    end if;
  end if;

  -- Campos comuns por Categoria (ADR 0008): o oculto é ignorado, sem apagar o que já estava gravado, e o
  -- obrigatório precisa de valor ao criar ou quando muda. Mesma regra de lerEvento.
  select c.nativo_local, c.nativo_fim, c.nativo_observacoes, c.nativo_link into config
  from public.categorias c where c.id = new.categoria_id;

  if config.nativo_local = 'oculto' then
    new.local := case when editando then old.local else '' end;
  end if;
  if config.nativo_observacoes = 'oculto' then
    new.observacoes := case when editando then old.observacoes else '' end;
  end if;
  if config.nativo_link = 'oculto' then
    new.link := case when editando then old.link else null end;
  end if;
  if config.nativo_fim = 'oculto' then
    -- O fim antigo fica, a menos que a data tenha mudado: aí vale o que o app calculou (sem fim, se o antigo não serve mais).
    if not editando then
      new.fim := null;
    elsif (new.inicio, new.dia_inteiro) is not distinct from (old.inicio, old.dia_inteiro) then
      new.fim := old.fim;
    end if;
  end if;

  if config.nativo_local = 'obrigatorio' and btrim(new.local) = '' and (not editando or new.local is distinct from old.local) then
    raise exception 'preencha “Local”' using errcode = 'P0001';
  end if;
  if config.nativo_fim = 'obrigatorio' and new.fim is null and (not editando or new.fim is distinct from old.fim) then
    raise exception 'preencha “Fim”' using errcode = 'P0001';
  end if;
  if config.nativo_observacoes = 'obrigatorio' and btrim(new.observacoes) = '' and (not editando or new.observacoes is distinct from old.observacoes) then
    raise exception 'preencha “Observações”' using errcode = 'P0001';
  end if;
  if config.nativo_link = 'obrigatorio' and new.link is null and (not editando or new.link is distinct from old.link) then
    raise exception 'preencha “Link”' using errcode = 'P0001';
  end if;

  if new.responsavel_id is not null
    and (not editando or new.responsavel_id is distinct from old.responsavel_id)
    and not exists (
      select 1 from public.perfis p where p.id = new.responsavel_id and p.ativo and p.nivel in ('admin', 'lider')
    ) then
    raise exception 'o Responsável precisa ser da Liderança' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(new.campos) chave
    where not (editando and old.campos ? chave)
      and not exists (
        select 1 from public.campos_das_categorias c where c.categoria_id = new.categoria_id and c.id::text = chave
      )
  ) then
    raise exception 'campo que não é da Categoria' using errcode = 'P0001';
  end if;

  for campo in select * from public.campos_das_categorias c where c.categoria_id = new.categoria_id loop
    valor := new.campos -> campo.id::text;
    continue when editando and valor is not distinct from old.campos -> campo.id::text;
    if valor is null or valor = 'null' or valor = '[]' or (jsonb_typeof(valor) = 'string' and btrim(valor #>> '{}') = '') then
      if campo.obrigatorio and campo.tipo <> 'checklist' then
        raise exception 'preencha “%”', campo.nome using errcode = 'P0001';
      end if;
    elsif not public.campo_valido(campo.tipo, campo.opcoes, valor, campo.nome) then
      raise exception '“%” fora do formato do tipo', campo.nome using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

/** A mesma `log_do_catalogo` da presença, agora com a configuração dos campos comuns da Categoria. */
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
        when 'nativo_link' then 'Campo Link' else chave end,
      'tipo', case chave when 'obrigatorio' then 'booleano' when 'tem_chamada' then 'booleano' when 'opcoes' then 'lista' else 'texto' end,
      'antes', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = antes ->> chave)
        when chave like 'nativo\_%' then to_jsonb(case antes ->> chave when 'oculto' then 'Oculto' when 'obrigatorio' then 'Obrigatório' else 'Visível' end)
        else coalesce(antes -> chave, 'null') end,
      'depois', case when chave = 'area_id' then (select to_jsonb(a.nome) from public.areas a where a.id::text = depois ->> chave)
        when chave like 'nativo\_%' then to_jsonb(case depois ->> chave when 'oculto' then 'Oculto' when 'obrigatorio' then 'Obrigatório' else 'Visível' end)
        else coalesce(depois -> chave, 'null') end
    )), '[]')
  into mudancas
  from jsonb_object_keys(antes || depois) chave
  where chave in ('nome', 'area_id', 'cor', 'tipo', 'obrigatorio', 'opcoes', 'tem_chamada', 'nativo_local', 'nativo_fim', 'nativo_observacoes', 'nativo_link')
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

-- Como reverter (a ordem importa; os valores antigos dos Eventos não são tocados em nenhum passo):
-- 1. Recrie `conferir_evento` e `log_do_catalogo` a partir de 20261021090000_professores.sql e 20261022010000_presenca.sql.
-- 2. delete from public.campos_das_categorias where nome = 'Link do material' and categoria_id = (select id from public.categorias where nome = 'Pequeno grupo');
-- 3. alter table public.categorias drop column nativo_local, drop column nativo_fim, drop column nativo_observacoes, drop column nativo_link;
-- 4. drop type public.visibilidade_do_campo;
