# 07: Painel do dia

**What to build:** tocar num dia do Calendário (mês ou semana) abre o Painel do dia, uma lista dos Eventos daquele dia, com os aniversariantes. No celular é uma folha que sobe de baixo; no desktop, um painel lateral. O estado fica na URL, em `abrir=AAAA-MM-DD`, separado de `dia` (a âncora do mês visível). O "+N" de um dia cheio abre o mesmo painel. No desktop, tocar num chip abre o Evento direto, enquanto tocar no número ou no espaço vazio do dia abre o painel. No celular, qualquer toque na célula o abre.

**Blocked by:** 06 (Eventos clicáveis, maiores e com retorno de toque).

**Status:** ready-for-agent

- [ ] O módulo de domínio do calendário lê e valida o parâmetro `abrir`; um valor inválido é ignorado, e há testes (`pnpm test:dominio`).
- [ ] O parâmetro `abrir` é independente de `dia`, e a navegação do Calendário preserva os filtros e fecha o painel ao mudar de período.
- [ ] Tocar num dia do Mês ou da Semana abre o Painel do dia, que mostra os Eventos como cartões (os mesmos da lista) e os aniversariantes do dia.
- [ ] O "+N" abre o Painel do dia, no lugar de levar à visão semanal.
- [ ] No celular o painel é uma folha que sobe de baixo; no desktop, um painel lateral.
- [ ] O painel fecha com toque fora, botão de fechar, Esc ou voltar do navegador, e tem foco e rótulos acessíveis.
- [ ] O Professor vê no painel só as aulas dele e sem Responsável; aniversariantes seguem as regras atuais de visibilidade.
- [ ] Um dia sem Eventos mostra um vazio claro.
- [ ] Fumaça (celular simulado): tocar num dia abre o painel, com a URL refletindo o dia, e fechar o painel.
- [ ] Funciona nos temas claro e escuro.
