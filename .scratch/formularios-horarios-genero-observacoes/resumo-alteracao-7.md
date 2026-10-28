# Resumo da Alteração 7: edição dos Dados pessoais (ajuste dos tickets 04 e 05)

## O que mudou
- Some o "Editar Gênero" (Minha conta e Admin → Usuários). Os **Dados pessoais** (nome, data de nascimento e Gênero) só a própria pessoa edita, em Minha conta → Cadastro (`FormularioDeDadosPessoais`, ação `editarMeusDados`). O Admin não edita dados pessoais de ninguém: em Usuários continua com Funções, nível, ativação e o selo "cadastro incompleto".
- Migração `20261028000000_editar_dados_pessoais.sql`: remove `definir_genero` e cria `editar_meus_dados(nome, nascimento, genero)`, que só alcança o perfil de quem está logado (Pendente e conta desativada são barrados). Reversão em comentário SQL. As migrações antigas não foram alteradas.
- Domínio: `erroNosDadosPessoais` em `src/dominio/cadastro.ts`.
- Adolescente: sem `<details>`/modal. A lista tem o link "Editar adolescente" para `/adolescentes/[id]`, que ganhou a seção "Cadastro" (nome, nascimento e Gênero) acima das Observações. Inativar/Reativar segue na lista; o cadastro novo segue no formulário da lista.
- Log: o nome aparece; data de nascimento e Gênero só como "alterados" (já era o comportamento de `log_do_perfil`, agora coberto por teste).
- `CONTEXT.md`: termo **Dados pessoais**. README atualizado.

## Decisões
- Sem modal: na tela pequena, seletores que abrem como painel inferior dentro de um modal ficam ruins; a página própria também comporta as Observações.
- A regra vale no banco (não só na tela), por ter sido a recomendação da Q4, que ficou sem resposta explícita.
- E-mail e senha ficam fora da edição.

## Testes
- Domínio: `cadastro.test.ts`. RLS: `genero-das-contas.test.ts` (a própria pessoa edita; inválidos recusados; Admin e outros não alcançam outra pessoa; `definir_genero` não existe mais; Pendente e desativado barrados; escrita direta barrada; Log). Fumaça (com `PLAYWRIGHT_CHANNEL=chrome`): Minha conta, Usuários sem edição, edição na página do Adolescente.
- `pnpm test` (1135), `typecheck`, `lint` verdes. O `next build` rodou na fumaça.
