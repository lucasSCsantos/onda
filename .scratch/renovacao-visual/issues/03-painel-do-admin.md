# 03: Painel do Admin

**What to build:** `/admin` passa a ser um painel de verdade. O Admin vê uma faixa de indicadores (pessoas pendentes de aprovação, convites ativos, Eventos em Rascunho e Eventos sem Responsável) e uma grade de cartões por seção (Usuários, Convites, Catálogo com Áreas, Funções e Categorias, Professores e Exportar), cada um com ícone, contador e atalho. No desktop há uma sidebar fixa com ícones e rótulos; no celular a sidebar vira o menu hambúrguer. As telas `/admin/*` abrem dentro do mesmo layout. No header, o Admin passa a ter só Calendário, Adolescentes e Administração. Líder e Professor não entram em `/admin`.

**Blocked by:** 02 (Header com menu hambúrguer).

**Status:** ready-for-agent

- [ ] Um layout compartilhado de administração, com sidebar no desktop, é usado pela raiz `/admin` e pelas telas internas existentes.
- [ ] No celular não há sidebar: a navegação administrativa fica no menu hambúrguer.
- [ ] Os indicadores são calculados por uma função pura de domínio, com testes (`pnpm test:dominio`) para contagem, vazio e Eventos que não contam (ex.: Cancelado, Realizado).
- [ ] Os cartões levam às telas existentes e mostram um contador relevante para cada seção.
- [ ] O header do Admin mostra só Calendário, Adolescentes e Administração. Professores continua no header do Líder de Ensino.
- [ ] Líder, Professor e Pendente não acessam `/admin` (comportamento atual preservado e coberto pela fumaça).
- [ ] O visual segue a base do ticket 01 e funciona nos temas claro e escuro.
- [ ] Fumaça: o Admin abre `/admin`, vê indicadores e cartões e navega por um deles.
