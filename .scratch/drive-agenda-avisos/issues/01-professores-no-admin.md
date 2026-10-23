# 01: Professores no Admin

**Spec:** `../spec.md` (Alteração 1)

**What to build:** O Admin abre Professores pelo menu do Admin e continua com a barra lateral à vista e o item marcado como ativo. Os líderes de Ensino, que não entram no Admin, continuam abrindo a mesma tela pelo menu do cabeçalho. O Admin que abre o endereço de fora é levado ao de dentro. (O pedido original dizia para apontar ao catálogo, mas o catálogo gerencia Funções, Categorias e campos; registrar a diferença no resumo.)

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A tela de Professores abre dentro do Admin, com barra lateral e item ativo, para o Admin
- [ ] A lista única de destinos do Admin aponta para a entrada de dentro; o menu do cabeçalho de quem não é Admin continua apontando para a de fora
- [ ] O Admin que abre a entrada de fora é redirecionado para a de dentro
- [ ] Quem tem Função em Ensino (sem acesso ao Admin) continua cadastrando e convidando professores como hoje
- [ ] A revalidação de cache cobre as duas entradas
- [ ] Teste do destino de cada link de Professores por perfil (Admin e líder de Ensino) e teste de fumaça da barra lateral com o item ativo
- [ ] Nenhum outro ponto do código aponta para a rota errada; `pnpm typecheck`, `pnpm lint` e `pnpm test` passam
