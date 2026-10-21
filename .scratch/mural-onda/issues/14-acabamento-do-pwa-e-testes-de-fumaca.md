# 14: Acabamento do PWA e testes de fumaça

**What to build:** o fechamento do MVP. Mensagem clara quando estiver sem internet, revisão de ícone, tela de abertura, legibilidade e cores nos dois modos e acessibilidade do uso no celular, mais um teste ponta a ponta de fumaça por fluxo crítico: login por convite, criar Evento e ver o calendário no celular. Confere os critérios de aceite do MVP da spec, um por um.

**Blocked by:** 07, 10, 11, 12

**Status:** resolved

- [x] Mensagem clara e útil sem internet
- [x] Ícone, tela de abertura e instalação revisados no celular
- [x] Cores e contraste conferidos nos modos claro e escuro
- [x] Testes de fumaça passam: login por convite, criar Evento, calendário no celular
- [x] Critérios de aceite do MVP da spec conferidos e registrados

## Answer

- Offline: `public/sw.js` serve `/offline` quando uma navegação falha; `AvisoOffline` mostra faixa no topo com o app aberto. Coberto na fumaça.
- Cores: `src/dominio/contraste.test.ts` confere WCAG AA (4,5) dos pares de texto nos modos claro e escuro, lendo `globals.css`.
- Fumaça (`pnpm test:fumaca`, Pixel 5 simulado): login por convite, sem convite fica Pendente, criar Evento e vê-lo no calendário sem rolagem lateral, tela offline, manifesto com ícones carregáveis.
- Critérios de aceite do MVP: cadastro por convite/Pendente, Eventos por Área, Série e filtros, calendário, Próximos eventos, aniversários, Professor e checklist cobertos pelos tickets 01–13 (testes de domínio e RLS, 419 passando); PWA instalável e uso no celular cobertos pela fumaça.
- Não verificado: instalação real e tela de abertura num celular físico/iOS; precisa de conferência manual no aparelho.
