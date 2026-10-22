# 02: Header com menu hambúrguer

**What to build:** o header deixa de ser uma linha de links de texto. No celular, um botão hambúrguer abre um painel logo abaixo do header com os destinos em itens grandes, com ícone. No desktop, o menu fica em linha com aparência de botão. Quem vê cada item continua igual: Calendário, Adolescentes (Liderança), Professores (Admin e Líder de Ensino), e o Professor só vê Calendário e Sair. Os links administrativos de hoje continuam no menu do Admin, porque a troca por "Administração" é do ticket 03.

**Blocked by:** 01 (Base visual e ícones).

**Status:** ready-for-agent

- [ ] Abaixo de `md` há um botão hambúrguer, com rótulo acessível e estado aberto/fechado, que abre e fecha o painel de itens.
- [ ] Os itens do painel têm ícone e toque de 44px ou mais, a página atual fica destacada (`aria-current`) e "Sair" aparece separado dos demais, no fim.
- [ ] O painel fecha ao escolher um destino, com Esc ou com toque fora, e o foco volta ao botão.
- [ ] A partir de `md`, o menu fica em linha, com ícones, fundo no hover e `:active`, e o item atual marcado.
- [ ] A visibilidade por perfil não muda (Líder de Ensino ainda vê Professores; Professor vê só Calendário e Sair; Admin continua vendo seus links atuais).
- [ ] No celular o header fica fixo no topo ao rolar.
- [ ] Fumaça (celular simulado): abrir o menu, ver os itens, navegar e fechar.
- [ ] Funciona nos temas claro e escuro.
