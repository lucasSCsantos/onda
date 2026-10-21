# 06: Calendário mensal e semanal

**What to build:** o calendário. Visões mensal e semanal, com a semana de segunda a domingo, além da lista já existente (padrão no celular). Eventos de dia inteiro aparecem no topo do dia. Cada Evento tem a cor da sua Categoria e o Status visível (Rascunho com destaque, Cancelado riscado, Adiado com marca). Tudo no fuso America/Bahia, nos dois modos claro e escuro. Navegar entre meses e semanas e voltar para hoje.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Visão mensal e semanal com a semana de segunda a domingo
- [x] A lista é a visão padrão no celular
- [x] Eventos de dia inteiro no topo do dia; Eventos de vários dias cobrem os dias do período
- [x] Cor por Categoria e Status visível, legíveis nos dois modos
- [x] Datas e horas no fuso America/Bahia
- [x] Teste de fumaça de que o calendário carrega e mostra um Evento criado

## Comments

**2026-10-21 (implementação, em `main`):** pronto. A regra fica em `src/dominio/calendario.ts`: `periodoDaVisao` monta os dias de cada visão (mês em semanas inteiras de segunda a domingo, semana, lista do mês) e o período que eles cobrem no fuso America/Bahia; `navegar` anda de mês em mês (a partir do dia 1º) ou de semana em semana (a partir da segunda); `lerPosicao` lê a visão e o dia da URL e volta para hoje quando faltam; `eventosPorDia` e `diasComEventos` põem cada Evento nos dias que ele cobre, com os de dia inteiro no topo. A tela é `/calendario` (atalho "Calendário" no cabeçalho da Liderança), e `eventos(supabase, periodo)` busca só os Eventos que tocam o período. Status: Rascunho tracejado e em itálico, Cancelado riscado, Adiado com ⏸ na cor de aviso (token novo `--aviso`, nos dois modos).

Teste de fumaça feito à mão, porque o projeto ainda não tem ponta a ponta (isso vem no ticket 14). Build de produção com Supabase local: um Evento criado pelo formulário ("Culto de fumaça", 28/10 às 19:30) aparece no mês e na semana no dia e na hora de Salvador. Numa largura de 390px, `/calendario` sem visão abre na lista, e a semana empilha os dias. Também conferidos: o modo claro e o escuro, um Evento de dia inteiro de 30/09 a 02/10 cobrindo os três dias, e um Evento das 22h às 2h no sábado e no domingo.

Decisões a confirmar:
- Sem visão na URL, o celular vê a lista e as telas largas veem o mês (o servidor não sabe a largura, então as duas vêm prontas e o CSS escolhe). As duas andam juntas, de mês em mês.
- A lista do calendário mostra um mês por vez, e um Evento de vários dias aparece em cada dia que cobre dentro do mês. A lista da tela inicial continua como no ticket 04, até o ticket 07 trocá-la por Próximos eventos.
- Cada dia do mês mostra até 3 Eventos; o "+N" leva à semana daquele dia.
- Os Eventos ainda não abrem detalhe nem edição; isso vem com o ticket 05.
