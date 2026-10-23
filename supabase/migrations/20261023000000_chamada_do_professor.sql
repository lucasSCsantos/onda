-- Chamada do Professor (ticket 08 de .scratch/drive-agenda-avisos): o Professor e o Auxiliar de uma aula fazem e
-- corrigem a Chamada dela, a partir do dia, mesmo sem Função na Área de Ensino. As regras espelham podeFazerChamada em
-- src/dominio/presenca.ts. Só acréscimos e uma troca de função (`pode_fazer_chamada`); nenhuma tabela muda.
--
-- A tabela de Adolescentes, as presenças e as Marcações continuam lidas só pela Liderança. O Professor recebe o que a
-- tela da Chamada precisa por funções `security definer`, presas à aula dele e ao dia dela.

/**
 * Quem está logado foi escolhido como Professor ou Auxiliar desta aula? Os campos pessoa com esses nomes na Categoria
 * guardam o id. Vale para a conta ativa de qualquer nível aprovado (um líder também pode ser escolhido), ao contrário
 * de `e_professor_da_aula`, que é só do nível Professor. Mesma regra do `escalado` de podeFazerChamada.
 */
create function public.e_escalado_na_aula(categoria uuid, campos jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.meu_nivel() in ('admin', 'lider', 'professor'), false) and exists (
    select 1
    from public.campos_das_categorias c
    where c.categoria_id = e_escalado_na_aula.categoria
      and c.tipo = 'pessoa'
      and c.nome in ('Professor', 'Auxiliar')
      and e_escalado_na_aula.campos ->> c.id::text = (select auth.uid())::text
  );
$$;

revoke execute on function public.e_escalado_na_aula from public, anon;
grant execute on function public.e_escalado_na_aula to authenticated;

/**
 * A mesma `pode_fazer_chamada` do ticket de presença, agora também para o Professor e o Auxiliar da aula (`e_escalado_na_aula`).
 * O resto não muda: Categoria com chamada, aula não Cancelada, a partir do dia dela (no fuso do Mural).
 */
create or replace function public.pode_fazer_chamada(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.tem_chamada
      and (public.pode_criar_evento(e.categoria_id) or public.e_escalado_na_aula(e.categoria_id, e.campos))
      and e.status <> 'cancelado'
      and (e.inicio at time zone 'America/Bahia')::date <= (now() at time zone 'America/Bahia')::date
    from public.eventos e
    join public.categorias c on c.id = e.categoria_id
    where e.id = pode_fazer_chamada.evento
  ), false);
$$;

/**
 * Os Adolescentes ativos da Chamada desta aula, só com o identificador e o nome: a data de nascimento fica de fora.
 * Devolve linhas só a quem pode fazer a Chamada daquela aula, no dia dela em diante.
 */
create function public.adolescentes_da_chamada(evento uuid)
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.nome
  from public.adolescentes a
  where a.ativo and public.pode_fazer_chamada(adolescentes_da_chamada.evento)
  order by a.nome;
$$;

/** As Marcações ativas, na ordem da Chamada e sem os pontos do ranking, para quem faz a Chamada desta aula. */
create function public.marcacoes_da_chamada(evento uuid)
returns table (id uuid, nome text, icone text, conta_presenca boolean, pede_visitante boolean, ordem integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.nome, m.icone, m.conta_presenca, m.pede_visitante, m.ordem
  from public.marcacoes m
  where m.ativa and public.pode_fazer_chamada(marcacoes_da_chamada.evento)
  order by m.ordem, m.nome;
$$;

/** A Chamada já feita nesta aula (Adolescente, Marcação e nome do visitante), só dela e só para quem a faz. */
create function public.presencas_da_chamada(evento uuid)
returns table (adolescente_id uuid, marcacao_id uuid, visitante text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.adolescente_id, mp.marcacao_id, mp.visitante
  from public.presencas p
  join public.marcacoes_das_presencas mp on mp.presenca_id = p.id
  where p.evento_id = presencas_da_chamada.evento and public.pode_fazer_chamada(presencas_da_chamada.evento);
$$;

revoke execute on function public.adolescentes_da_chamada, public.marcacoes_da_chamada, public.presencas_da_chamada from public, anon;
grant execute on function public.adolescentes_da_chamada, public.marcacoes_da_chamada, public.presencas_da_chamada to authenticated;

-- Reverter --------------------------------------------------------------------------
-- Volta a Chamada só para o Admin e quem tem Função na Área; as presenças já gravadas ficam.
--
-- drop function public.presencas_da_chamada, public.marcacoes_da_chamada, public.adolescentes_da_chamada;
-- (recriar `pode_fazer_chamada` como em 20261022010000_presenca.sql)
-- drop function public.e_escalado_na_aula;
