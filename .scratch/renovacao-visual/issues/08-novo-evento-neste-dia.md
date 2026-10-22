# 08: Novo Evento neste dia

**What to build:** o Painel do dia ganha o botão "Novo Evento neste dia", só para quem pode criar Eventos. Ele leva à criação com a data do dia já preenchida. Uma data inválida na URL cai no comportamento de hoje, sem erro.

**Blocked by:** 07 (Painel do dia).

**Status:** ready-for-agent

- [ ] O botão aparece no Painel do dia só para quem tem permissão de criar (Líder com Função que cria, Geral ou Admin) e não aparece para o Professor.
- [ ] A página de criação aceita uma data pré-preenchida pela URL, com a validação no domínio e testes (`pnpm test:dominio`): data válida preenche o campo e data inválida é ignorada.
- [ ] O fluxo de escolher Categoria preserva a data até o formulário, e a criação normal (sem data) continua igual.
- [ ] Para Eventos de dia inteiro e com hora, a data pré-preenchida respeita o fuso do ministério.
- [ ] Fumaça: do Painel do dia chega-se ao formulário com a data preenchida.
- [ ] Funciona nos temas claro e escuro e no celular simulado.
