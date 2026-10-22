Status: ready-for-agent

# Renovação visual e agilidade do Mural

## Problem Statement

No celular, os botões do header parecem texto solto: não parecem clicáveis e não dão retorno ao toque. O mesmo vale para os Eventos no Calendário (no mês e na semana eles nem são links) e na lista. Os filtros ficam escondidos num bloco recolhido, exigem o botão "Filtrar" e misturam os usados toda hora com os raros. O Admin tem cinco ou seis links soltos no header em vez de um painel. A Liderança perde tempo para achar o que precisa de ação (Rascunhos, Eventos sem Responsável, aulas sem Professor, atrasados) e para ver o que acontece num dia do calendário.

## Solution

Uma renovação que melhora o que já existe, sem mudar a paleta nem o modo escuro:

- Header com menu hambúrguer no celular e botões com cara de botão (ícones, estado de toque) no desktop.
- Retorno visual de toque em tudo que é clicável, sobretudo nos Eventos.
- Filtros rápidos marcáveis e aplicados na hora, com os usados com frequência à vista e o resto em "Filtros avançados".
- Um painel do Admin em `/admin`, com sidebar no desktop, indicadores e cartões por seção.
- No Calendário, Eventos maiores e mais claros, e um painel do dia que lista os Eventos daquele dia ao tocar nele.

## User Stories

1. Como Líder no celular, quero um menu hambúrguer no header, para ter os destinos à mão sem uma linha apertada de links.
2. Como Líder no celular, quero que os itens do menu sejam grandes e tenham ícone, para tocar sem errar.
3. Como pessoa logada, quero ver qual item do menu é a página atual, para saber onde estou.
4. Como pessoa logada, quero "Sair" separado dos demais destinos e com ícone, para não tocar nele sem querer.
5. Como pessoa no celular, quero que cada botão e link do header afunde ao toque, para ter certeza de que o toque foi registrado.
6. Como pessoa no desktop, quero o menu em linha com aparência de botões (fundo ao passar o mouse e item atual marcado), para reconhecer o que é clicável.
7. Como Líder de Ensino, quero continuar vendo "Professores" no menu, para continuar cadastrando Professores.
8. Como Líder sem Função em Ensino, não quero ver "Professores", para o menu só ter o que eu uso.
9. Como Professor, quero um menu só com o Calendário e o Sair, para não ver o que não me serve.
10. Como Admin, quero um único item "Administração" no menu, para não ter cinco links administrativos no header.
11. Como Admin, quero abrir `/admin` e ver um painel com indicadores e cartões, para ter uma visão geral e chegar rápido a cada seção.
12. Como Admin, quero ver quantas pessoas aguardam aprovação, quantos convites estão ativos, quantos Eventos estão em Rascunho e quantos estão sem Responsável, para saber o que pede ação.
13. Como Admin, quero cartões para Usuários, Convites, Catálogo (Áreas, Funções, Categorias), Professores e Exportar, cada um com ícone e um contador, para entender a seção antes de entrar.
14. Como Admin no desktop, quero uma sidebar fixa com ícones e rótulos, para trocar de seção sem voltar ao painel.
15. Como Admin no celular, quero que a sidebar vire o menu hambúrguer, para não ter duas navegações.
16. Como Admin, quero que as telas internas de administração abram dentro do mesmo layout, para a navegação ser consistente.
17. Como Líder ou Professor, não quero poder abrir `/admin`, para a administração ser só do Admin.
18. Como Líder, quero atalhos marcáveis no topo do Calendário e da Home, para filtrar com um toque.
19. Como Líder, quero que o filtro seja aplicado assim que eu marco um atalho, para não precisar de um botão "Filtrar".
20. Como Líder, quero o atalho "Meus eventos", para ver só os Eventos em que sou Responsável, Professor ou Auxiliar.
21. Como Líder, quero o atalho "Hoje", para ver o que cobre o dia de hoje (inclusive Eventos de vários dias).
22. Como Líder, quero o atalho "Esta semana", para ver a semana corrente.
23. Como Líder, quero o atalho "Próximos" no Calendário, para esconder o que já terminou.
24. Como Líder, quero o atalho "Rascunho", para achar os Eventos que ainda não saíram de Rascunho.
25. Como Líder, quero o atalho "Sem Responsável", para achar os Eventos ativos sem Responsável.
26. Como Líder, quero o atalho "Aula sem Professor", para achar as aulas ativas sem Professor.
27. Como Líder, quero o atalho "Atrasados", para achar Planejados ou Rascunhos que já passaram da data.
28. Como Líder, quero combinar vários atalhos, para estreitar o que vejo.
29. Como Líder no celular, quero que a barra de atalhos role na horizontal em uma linha, para ela não ocupar a tela inteira.
30. Como Líder, quero ver Área e Categoria expostas na barra, para trocá-las sem abrir nada.
31. Como Líder, quero "Filtros avançados" com Dia, Status e várias Categorias, para os filtros raros não poluírem a tela.
32. Como Líder, quero um contador no botão "Filtros avançados" quando há algo ligado ali dentro, para não esquecer de um filtro escondido.
33. Como Líder, quero "Limpar" sempre que houver filtro ativo, para voltar ao todo com um toque.
34. Como Líder, quero que os filtros fiquem na URL, para compartilhar e voltar com o navegador.
35. Como Líder, quero que a navegação do Calendário (mês anterior, próximo, Hoje, visão) preserve os filtros, para não perdê-los ao navegar.
36. Como Líder, quero tocar num item de "Precisam de atenção" na Home e cair já na tela com o atalho correspondente ligado, para chegar direto na lista a resolver.
37. Como Professor, não quero ver os atalhos de Liderança, pois só vejo as aulas em que fui colocado.
38. Como pessoa no celular, quero que tocar num Evento da lista dê retorno visual imediato, para saber que o toque foi registrado.
39. Como pessoa no celular, quero que os Eventos do Calendário (mês, semana, lista) sejam links para o Evento, para abri-lo direto.
40. Como pessoa no celular, quero uma área de toque ampla nos Eventos do Calendário, mesmo que o desenho seja pequeno.
41. Como Líder no celular, quero que cada dia do mês mostre pontos coloridos por Categoria e o número do dia maior, para ver de relance os dias com Eventos.
42. Como Líder no desktop, quero chips de Evento maiores no mês, com a hora e o Status em selo, para ler o Evento sem abri-lo.
43. Como Líder no desktop, quero ver até 4 Eventos por dia no mês, para ter mais contexto.
44. Como Líder, quero tocar num dia e abrir um painel com a lista dos Eventos daquele dia, para ver o que há quando o dia tem vários.
45. Como Líder no celular, quero o painel do dia como uma folha que sobe de baixo, para usar com uma mão.
46. Como Líder no desktop, quero o painel do dia como um painel lateral, para não perder o calendário de vista.
47. Como Líder, quero fechar o painel do dia com um toque fora dele, no botão de fechar ou no botão voltar do navegador, para sair sem esforço.
48. Como Líder, quero que o "+N" de um dia cheio abra o painel do dia, para ver todos os Eventos dele.
49. Como Líder, quero ver os aniversariantes do dia dentro do painel do dia, para não perdê-los quando o dia está cheio.
50. Como Líder, quero um botão "Novo Evento neste dia" no painel, para criar já com a data preenchida.
51. Como Líder sem permissão de criar, não quero ver "Novo Evento neste dia", para não tentar o que o sistema nega.
52. Como Professor, quero abrir o painel do dia e ver só as minhas aulas, sem Responsáveis, para a privacidade valer como no resto.
53. Como Líder, quero que o painel do dia aberto fique na URL, para compartilhar o dia e voltar a ele.
54. Como Líder na visão semanal, quero tocar no dia e abrir o mesmo painel, para ter o mesmo comportamento no mês e na semana.
55. Como pessoa com tema escuro, quero que tudo isso funcione no modo escuro, para não haver regressão.
56. Como pessoa com teclado ou leitor de tela, quero que o menu, os atalhos e o painel do dia sejam acessíveis (foco, rótulos, `aria-current`, fechamento com Esc), para usar sem mouse.

## Implementation Decisions

- **Domínio de filtros**: a estrutura `Filtros` ganha os novos atalhos (Hoje, Próximos, Sem Responsável, Aula sem Professor, Atrasados) ao lado de Meus eventos, Esta semana, Dia, Categorias, Área e Status. Rascunho é o filtro de Status já existente: o atalho apenas liga e desliga Status = Rascunho.
- Os atalhos "por situação" reaproveitam as regras de `alertas` (Sem Responsável, Aula sem Professor, vencido), de modo que o alerta e o filtro nunca divirjam. Há uma única fonte de verdade para cada regra.
- "Próximos" só existe no Calendário; na Home o comportamento já é o padrão da tela.
- A leitura e a escrita de filtros na URL continuam simétricas (`lerFiltros` e `parametrosDosFiltros`), e os parâmetros desconhecidos continuam ignorados.
- Os links dos alertas da Home passam a apontar para a tela de Eventos com o atalho correspondente ligado.
- **Filtros na interface**: um componente cliente aplica os filtros na hora, atualizando a URL, sem o botão "Filtrar". Os atalhos aparecem numa barra que rola na horizontal no celular. Área e Categoria ficam expostas; Dia, Status e várias Categorias ficam em "Filtros avançados", com contador e "Limpar". Os atalhos aparecem só para a Liderança.
- **Painel do dia**: o estado vem do parâmetro de URL `abrir=AAAA-MM-DD`, separado de `dia` (âncora do mês visível). O módulo de calendário lê e valida esse parâmetro, e um valor inválido é ignorado. O painel traz aniversariantes, os Eventos do dia como cartões e, para quem pode criar, "Novo Evento neste dia".
- A página de criação de Evento aceita uma data pré-preenchida; o valor é validado e, se for inválido, a página se comporta como hoje.
- Para o Professor, o painel lista só as aulas que as políticas por linha já devolvem e não mostra Responsável. Não há política nova.
- **Calendário**: os Eventos do mês e da semana viram links para o Evento. No mês, o celular mostra pontos coloridos por Categoria com o dia maior, e tocar na célula abre o painel. No desktop, os chips são maiores, com hora e selo de Status, o limite sobe de 3 para 4 e o "+N" abre o painel. Semana e Lista usam cartões com hora e barra de cor da Categoria.
- **Header**: abaixo de `md`, menu hambúrguer; a partir de `md`, menu em linha com aparência de botão. Todos os itens têm ícone (`lucide-react`, dependência nova). A lógica de quem vê o quê continua a mesma: Calendário, Adolescentes, Professores (Admin e Líder de Ensino) e, para o Admin, um único "Administração".
- **Administração**: um layout compartilhado em `/admin` com sidebar no desktop, que no celular dá lugar ao menu hambúrguer. A raiz `/admin` mostra os indicadores (pendentes de aprovação, convites ativos, Eventos em Rascunho, Eventos sem Responsável) e os cartões das seções. Os indicadores vêm de uma função pura de domínio sobre dados já lidos, e o acesso continua restrito ao Admin como hoje.
- **Visual**: a paleta e o modo escuro ficam. Muda o acabamento: cantos, sombras suaves, botões primário e secundário com toque mínimo de 44px, estado `:active`, hierarquia de texto, selos de Status, transições curtas e header fixo no celular. O destaque de toque do navegador é desligado, e o `:active` o substitui.
- **Vocabulário** (a registrar no `CONTEXT.md`): **Atalho de filtro** (filtro marcável da barra, que liga e desliga na hora) e **Painel do dia** (a lista de Eventos de um dia, aberta ao tocar nele no Calendário).
- Nenhuma mudança de schema, de permissão ou de política por linha.

## Testing Decisions

- Um bom teste exercita o comportamento externo: dado um conjunto de Eventos e uns parâmetros de URL, quais Eventos voltam e que URL sai. Nada de checar classes CSS nem estrutura interna de componentes.
- **Domínio** (`pnpm test:dominio`) é o ponto principal e cobre: cada novo atalho em `filtrar` (incluindo Eventos de vários dias e os limites de Status), o ciclo `lerFiltros` e `parametrosDosFiltros`, a igualdade entre as regras dos alertas e as dos atalhos, a leitura do parâmetro `abrir`, a validação da data pré-preenchida e os indicadores do painel do Admin.
- **Fumaça** (`pnpm test:fumaca`, Playwright com celular simulado) cobre o que só se vê na tela: abrir e fechar o menu hambúrguer, ligar um atalho e a lista mudar sem botão, abrir o painel do dia ao tocar num dia, e `/admin` com cartões acessível ao Admin e negado ao Líder.
- Prior art: `src/dominio/filtros.test.ts`, `calendario.test.ts` e `aniversarios.test.ts` para o domínio, e `tests/fumaca/fluxos.spec.ts` para a fumaça.
- Não há testes de RLS novos, pois nenhuma permissão muda. Estados de toque, sombras e ícones têm verificação manual no celular.

## Out of Scope

- Mudar a paleta de cores ou remover o modo escuro.
- Qualquer mudança de permissão, em especial quem pode ver Professores.
- Reescrever por dentro as telas `/admin/*`, que só herdam o layout e o visual novo.
- Cor por Categoria no Evento além da que o catálogo já define, e novos tipos de visão do calendário.
- Barra de abas inferior no celular.
- Notificações, busca por texto e arrastar e soltar Eventos.

## Further Notes

- Na época do spec, os Eventos do mês e da semana não eram links, só a lista abria o Evento. Tornar os chips clicáveis faz parte de "retorno visual ao clicar num evento".
- Divisão sugerida em tickets, em ordem de dependência: (1) base visual (ícones, `:active`, botões), (2) header e menu hambúrguer, (3) layout e painel do Admin, (4) atalhos e Filtros avançados, (5) Eventos clicáveis e maiores no Calendário e na lista, (6) painel do dia com "Novo Evento neste dia".
