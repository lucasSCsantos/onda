# 03: Áreas, Funções e Categorias configuráveis

**What to build:** o catálogo de configuração e a regra de permissão por Área (ADR 0001). O sistema vem com as Áreas (Geral, Ensino, Programação, Comunicação, Louvor, Acampamento), o mapa Categoria → Área, as Funções iniciais, os campos de cada Categoria (ADR 0002) e as Funções atribuídas a Lucas, Carol Leal, Beythel, Carol França, Mariana e Denize. O Admin edita Funções e a Área de cada Categoria, atribui várias Funções à mesma pessoa, cria Categorias novas e define seus campos (nome, tipo, obrigatório) e cores. A regra "quem pode criar Evento de qual Categoria" fica no módulo de domínio e nas políticas por linha, com os mesmos testes.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Catálogo inicial carregado conforme a spec (Áreas, Categorias, Funções, campos, cores)
- [x] Admin cria e edita Funções e atribui várias Funções a uma pessoa
- [x] Admin muda a Área de uma Categoria e cria uma Categoria nova sem mudar a estrutura do banco
- [x] O Admin define os campos de uma Categoria com os tipos suportados (os dez tipos existem na configuração; o checklist só ganha comportamento no ticket 12)
- [x] "Pode criar Evento da Categoria X" devolve a união das Áreas das Funções da pessoa; Geral cria todas; Reunião de liderança é só Geral
- [x] Testes por Função: Mariana e Denize criam Culto, Evento extra e Serviço; Carol França só Postagem; Beythel só Ensaio de louvor; módulo de domínio e políticas por linha concordam

## Comments

**2026-10-21 (implementação, em `main`):** pronto. Regras no domínio (`src/dominio/catalogo.ts`: `podeCriarEvento`, `categoriasQuePodeCriar`, validação de Função, Categoria, campos e Funções da pessoa, e o `CATALOGO_INICIAL`) e no banco (migração `catalogo`: tabelas `categorias` e `campos_das_categorias`, funções `pode_criar_evento` e `definir_funcoes`). `tests/rls/catalogo.test.ts` confere que o banco tem o catálogo inicial do domínio e que `pode_criar_evento` dá a mesma resposta do domínio para a Liderança da spec, Professor, Pendente e desativado. Telas: `/admin/catalogo` (Funções e Categorias), `/admin/catalogo/[id]` (nome, Área, cor e campos) e "Editar Funções" em `/admin/usuarios`. O ticket 04 deve usar `pode_criar_evento` na política de inserção de Eventos.

Não verificado no navegador: o `next dev` desta máquina falha ao abrir qualquer página (Turbopack não consegue criar o processo do PostCSS, código `0xc0000142`), também em `/entrar`, que não mudou.

Decisões a confirmar:
- As Funções de Lucas, Carol Leal etc. não podem ser semeadas, porque as contas ainda não existem. Cada um entra pelo convite com uma Função; Lucas e Carol Leal precisam depois de "Editar Funções" para receber a segunda.
- O Admin cria todas as Categorias, mesmo sem Função (como em CONTEXT.md, "ou o Admin").
- Um Líder não fica sem Função; as Funções de uma pessoa mudam só por `definir_funcoes` (as políticas diretas de inserir e apagar em `funcoes_das_pessoas` saíram).
- Campos obrigatórios do catálogo inicial (palpite, a confirmar antes do ticket 04): Tema da EBD, Grupo do Pequeno grupo, Plataforma da Postagem, Tipo e O que levar do Evento extra, Descrição da ação do Serviço.
- Opções iniciais: Pequeno grupo com "Grupo único"; Postagem com Instagram, WhatsApp, YouTube e Outra; Evento extra com Gincana, Intercâmbio, Campeonato e Outro.
- Áreas não são editáveis; a Geral é reconhecida pelo nome. Categorias e Funções não se apagam (só se editam), para não quebrar Eventos futuros; campos podem ser removidos.
