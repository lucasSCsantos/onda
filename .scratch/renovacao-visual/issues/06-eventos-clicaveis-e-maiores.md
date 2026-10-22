# 06: Eventos clicáveis, maiores e com retorno de toque

**What to build:** os Eventos do Calendário e da lista passam a ser claros e a responder ao toque. Hoje os Eventos do mês e da semana não são links; aqui eles viram links para o Evento. No mês, o celular mostra pontos coloridos por Categoria com o número do dia maior, e o desktop mostra chips maiores, com hora e selo de Status. Semana e Lista usam cartões com hora em destaque e barra de cor da Categoria. Tudo tem retorno `:active` e área de toque ampla.

**Blocked by:** 01 (Base visual e ícones).

**Status:** ready-for-agent

- [ ] Os Eventos do mês e da semana são links para a página do Evento, com `:active` visível.
- [ ] No celular, a visão Mês mostra pontos coloridos por Categoria (até 3, depois um "+") e o número do dia maior, com células mais altas.
- [ ] No desktop, os chips do Mês são maiores (texto `text-sm`, hora e selo de Status), e o limite por dia sobe de 3 para 4.
- [ ] O "+N" continua levando à visão da semana até o ticket 07 trocá-lo pelo Painel do dia.
- [ ] Semana e Lista mostram cartões com hora em destaque, título em tamanho de leitura e barra de cor da Categoria.
- [ ] Os cartões da lista (Home e Calendário) ganham retorno `:active`, com área de toque mínima de 44px, ampliada sem mudar o tamanho visual dos Eventos pequenos.
- [ ] O Professor continua vendo só as aulas dele e sem o nome de Responsável.
- [ ] A acessibilidade se mantém (rótulos, Categoria e Status disponíveis a leitores de tela).
- [ ] Funciona nos temas claro e escuro; testes de domínio do calendário continuam passando e o toque é verificado à mão no celular.
