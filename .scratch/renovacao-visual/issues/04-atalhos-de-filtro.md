# 04: Atalhos de filtro

**What to build:** uma barra de atalhos marcáveis no topo da Home e do Calendário. Cada um liga e desliga na hora, sem botão "Filtrar", e fica na URL. Atalhos: Meus eventos, Hoje, Esta semana, Próximos (só no Calendário), Rascunho, Sem Responsável, Aula sem Professor e Atrasados. Podem ser combinados. Só a Liderança os vê. Os itens de "Precisam de atenção" na Home passam a abrir a tela com o atalho correspondente já ligado. A navegação do Calendário (mês anterior, próximo, Hoje, visão) preserva os filtros.

**Blocked by:** 01 (Base visual e ícones).

**Status:** ready-for-agent

- [ ] O domínio de filtros aceita os novos atalhos (Hoje, Próximos, Sem Responsável, Aula sem Professor, Atrasados) em `filtrar`, `lerFiltros` e `parametrosDosFiltros`, com testes de domínio. Eles cobrem Eventos de vários dias, os limites de Status e o ciclo URL → filtros → URL.
- [ ] Sem Responsável, Aula sem Professor e Atrasados usam a mesma regra dos alertas, sem duplicá-la, com um teste que garante a igualdade.
- [ ] "Rascunho" liga e desliga o filtro de Status Rascunho existente.
- [ ] "Próximos" aparece só no Calendário; na Home já é o padrão da tela.
- [ ] Marcar ou desmarcar um atalho atualiza a lista na hora, sem botão "Filtrar", e a URL reflete o estado (compartilhável, com voltar do navegador).
- [ ] No celular, a barra é uma linha que rola na horizontal, com toque de 44px ou mais e `:active`.
- [ ] "Limpar" aparece sempre que há filtro ativo e remove todos.
- [ ] Os alertas da Home abrem a tela com o atalho correspondente ligado.
- [ ] O Professor não vê os atalhos.
- [ ] Os controles já existentes de filtro continuam funcionando enquanto o ticket 05 não os reorganiza.
- [ ] Fumaça: ligar um atalho muda a lista sem apertar nada.
