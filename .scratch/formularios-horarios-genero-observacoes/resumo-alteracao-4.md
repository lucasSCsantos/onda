# Resumo da Alteração 4: Gênero dos Adolescentes (ticket 04)

## O que foi feito
- Migração `20261027020000_genero_dos_adolescentes.sql`: coluna `genero` (masculino/feminino, opcional) em `adolescentes`; gatilho `BEFORE INSERT` que exige o Gênero (nunca bloqueia `UPDATE`); privilégios de coluna de insert e update incluem `genero`; `log_do_adolescente` registra a mudança de Gênero como dado "oculto" (só que mudou).
- Domínio `src/dominio/adolescentes.ts`: `Adolescente.genero` (nulo = não informado), `erroNoAdolescente` exige o Gênero em cadastro novo (e, ao editar, só recusa valor inválido), `lerFiltroDeGenero`, `totaisPorGenero`, e `listarAdolescentes` com filtro de Gênero e totais dos ativos independentes do filtro e da busca.
- Formulário de criar e de editar: radio segmentado de Gênero (obrigatório só ao criar). Lista: seletor de Gênero (Todos, Masculino, Feminino, Sem gênero informado), linha de totais e selo "cadastro incompleto" em quem está sem Gênero.
- README atualizado.

## Decisões e suposições
- Os totais contam todos os Adolescentes ativos, ignorando também a busca por nome (além do filtro de Gênero e de "mostrar inativos").
- O filtro usa o seletor (Selecao) do ticket 01 em vez de radios, para caber junto da busca e da ordem no formulário de filtros.
- Fixtures de testes de RLS e de fumaça que criam Adolescentes passaram a informar o Gênero, por causa do gatilho.
- O Gênero não entra em nenhuma consulta de `.ics`, exportação ou Notificação: elas já selecionam colunas explícitas.

## Testes
- Domínio: `adolescentes.test.ts` (filtro, totais, obrigatoriedade). RLS: `tests/rls/genero-dos-adolescentes.test.ts` (novo exige Gênero, antigo segue válido, Líder/Admin editam, Professor/Pendente/desativado/anônimo barrados, Log sem o valor). Fumaça: `tests/fumaca/genero-dos-adolescentes.spec.ts`.

## Como reverter
Reverter os commits; no banco, os passos em comentário no fim da migração.
