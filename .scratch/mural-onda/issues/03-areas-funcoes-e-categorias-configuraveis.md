# 03: Áreas, Funções e Categorias configuráveis

**What to build:** o catálogo de configuração e a regra de permissão por Área (ADR 0001). O sistema vem com as Áreas (Geral, Ensino, Programação, Comunicação, Louvor, Acampamento), o mapa Categoria → Área, as Funções iniciais, os campos de cada Categoria (ADR 0002) e as Funções atribuídas a Lucas, Carol Leal, Beythel, Carol França, Mariana e Denize. O Admin edita Funções e a Área de cada Categoria, atribui várias Funções à mesma pessoa, cria Categorias novas e define seus campos (nome, tipo, obrigatório) e cores. A regra "quem pode criar Evento de qual Categoria" fica no módulo de domínio e nas políticas por linha, com os mesmos testes.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Catálogo inicial carregado conforme a spec (Áreas, Categorias, Funções, campos, cores)
- [ ] Admin cria e edita Funções e atribui várias Funções a uma pessoa
- [ ] Admin muda a Área de uma Categoria e cria uma Categoria nova sem mudar a estrutura do banco
- [ ] O Admin define os campos de uma Categoria com os tipos suportados (os dez tipos existem na configuração; o checklist só ganha comportamento no ticket 12)
- [ ] "Pode criar Evento da Categoria X" devolve a união das Áreas das Funções da pessoa; Geral cria todas; Reunião de liderança é só Geral
- [ ] Testes por Função: Mariana e Denize criam Culto, Evento extra e Serviço; Carol França só Postagem; Beythel só Ensaio de louvor; módulo de domínio e políticas por linha concordam
