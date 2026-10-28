# 05: Gênero das contas (líderes, professores e Admin)

**What to build:** quem cria uma conta informa o Gênero, e perfis antigos podem completá-lo, pela própria pessoa ou pelo Admin.

- Coluna nova, opcional e aditiva em perfis, com os valores "masculino" e "feminino"; perfis antigos ficam nulos ("não informado"). Reversão em comentário SQL.
- O radio de Gênero (ticket 01) entra no formulário de cadastro, que é único para auto-cadastro e convite, obrigatório para todos os novos, inclusive Professor. A obrigatoriedade é verificada na ação do servidor e no domínio do cadastro, **sem** regra rígida no gatilho de criação de perfil (para não arriscar o fluxo de criação de contas); o Gênero é gravado no perfil a partir do cadastro.
- Em Minha conta, a própria pessoa edita **só** o Gênero (privilégio de coluna restrito à própria linha). Na tela de usuários, o Admin edita o Gênero de qualquer pessoa e vê quem está com cadastro incompleto, com indicador discreto. Não se cria tela de edição de perfil completa.
- Privacidade: só usuários autenticados e aprovados leem, pelas políticas existentes; nunca vai para o `.ics`, Notificações ou exportações públicas. O Log registra só que o campo foi alterado, sem o valor.
- README atualizado e resumo. Trabalha na branch `feat/alt-5-genero`.

**Blocked by:** 01 (Controles de escolha)

**Status:** ready-for-agent

- [ ] Auto-cadastro e aceite de convite exigem o Gênero (Líder e Professor) e recusam o envio sem ele
- [ ] Perfis existentes continuam funcionando e aparecem como "não informado" com indicador de cadastro incompleto
- [ ] A pessoa altera o próprio Gênero em Minha conta mas não consegue alterar nenhum outro campo do perfil nem o Gênero de outra pessoa (teste de RLS)
- [ ] O Admin completa o Gênero de qualquer pessoa na tela de usuários
- [ ] O Gênero não aparece no `.ics`, em Notificações nem em exportações; o Log registra só a alteração, sem o valor
- [ ] O fluxo de criação de contas por convite e por aprovação segue funcionando como antes (testes existentes passando)
- [ ] Testes de domínio e de RLS passando; `pnpm test`, `pnpm typecheck`, `pnpm lint` e build verdes
