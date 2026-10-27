# Resumo da Alteração 5: Gênero das contas (ticket 05)

## O que foi feito
- Migração `20261027010000_genero_das_contas.sql`: coluna `genero` (masculino/feminino, opcional) em `perfis`; `criar_perfil` grava o Gênero vindo do cadastro só se válido (sem regra rígida no gatilho); função `definir_genero(pessoa, novo_genero)` (própria pessoa aprovada ou Admin); `log_do_perfil` registra a mudança de Gênero como dado "oculto" (só que mudou).
- Domínio `src/dominio/genero.ts` (4 testes): `lerGenero`, `erroNoGenero` (obrigatório no cadastro novo), `cadastroIncompleto`, nomes. Reutilizável pelo ticket 04.
- Cadastro (auto-cadastro e convite, inclusive Professor): radio segmentado de Gênero, obrigatório no formulário e na ação `cadastrar`.
- Minha conta: seção "Cadastro" com o radio e o selo "cadastro incompleto". Admin → Usuários: selo nos ativos e "Editar Gênero" para qualquer pessoa.
- README atualizado.

## Decisões e suposições
- Em vez de "privilégio de coluna restrito à própria linha", a escrita passa por `definir_genero` (security definer). Motivo: um `grant update (genero)` com política de própria linha também liberaria a edição do `ativo` pela própria pessoa (a coluna já é editável pelo Admin). Nenhum outro campo do perfil muda por esse caminho; teste de RLS cobre.
- O Admin edita o próprio Gênero também (pela mesma função); Pendente não define o dele.
- Os specs de fumaça existentes passaram a marcar o Gênero ao se cadastrar.

## Testes
- Domínio: `genero.test.ts`. RLS: `tests/rls/genero-das-contas.test.ts` (perfis antigos nulos, cadastro grava, fluxo sem Gênero ou inválido não quebra, própria pessoa, não altera outra pessoa nem campos por escrita direta, Pendente barrado, Admin completa, leitura por Professor e Pendente, Log sem o valor). Fumaça: `tests/fumaca/genero-das-contas.spec.ts`.
- Nota: a lista de Usuários vem limitada pelo banco local cheio de contas de teste; o spec usa nome começando com "Aaa".

## Como reverter
Reverter os commits; no banco, os passos em comentário no fim da migração.
