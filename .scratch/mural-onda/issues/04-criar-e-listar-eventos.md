# 04: Criar e listar Eventos

**What to build:** o primeiro Evento de ponta a ponta. Um líder cria um Evento de uma Categoria da sua Área, com título, início (hora opcional, sem hora é dia inteiro), fim opcional, local, Responsável (qualquer pessoa da Liderança), Status, observações, link opcional e os campos específicos da Categoria (todos os tipos, menos checklist). Pode salvar como Rascunho sem Responsável, mas não sai de Rascunho sem um. O Evento aparece numa lista cronológica no fuso America/Bahia, visível a toda a Liderança; quem não tem Função na Área não consegue criar.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] Criar Evento com campos comuns e específicos conforme a Categoria, validando os obrigatórios
- [x] Hora de início vazia gera Evento de dia inteiro; fim sempre opcional
- [x] Rascunho aceita vazio de Responsável; qualquer outro Status exige Responsável
- [x] Postagem usa a data do Evento como data de publicação, sem campo extra de data
- [x] Lista mostra todos os Eventos para a Liderança; Pendente e Professor não leem
- [x] Criador e criação ficam registrados
- [x] Testes de permissão (módulo de domínio e políticas por linha) para criar com e sem Função na Área

## Comments

**2026-10-21 (implementação, em `main`):** pronto. Regras no domínio (`src/dominio/eventos.ts`: `lerEvento` confere e converte o formulário, com início e fim no fuso America/Bahia, Responsável, Status inicial e cada tipo de campo específico; `camposDaCriacao`, `rotuloDaData`, `podeVerTodosOsEventos` e `agruparPorDia`) e no banco (migração `eventos`: tabela `eventos`, que guarda os campos específicos em `campos` jsonb pelo id do campo; política de inserção com `pode_criar_evento`; leitura pela Liderança; `campo_valido` e o gatilho `conferir_evento_novo`, com as mesmas regras de `lerEvento`). `tests/rls/eventos.test.ts` confere que o banco e o domínio concordam sobre quem cria cada Categoria, sobre Responsável, campos e leitura. Telas: `/eventos/novo` (escolha da Categoria, só as que a pessoa cria), `/eventos/novo/[categoria]` (formulário) e a lista cronológica na tela inicial.

Verificado no navegador com `pnpm build && pnpm start` (o `next dev` continua quebrado nesta máquina): uma Líder de programação vê só Culto, Evento extra e Serviço; um valor inválido mostra o erro sem apagar o formulário; o Evento criado aparece na lista no dia e na hora certos de Salvador, com o valor em centavos e a criadora registrada.

Decisões a confirmar:
- Um Evento novo não nasce Realizado (o domínio não oferece; o banco recusa). Registrar algo que já aconteceu fica para o ticket 05, com a regra do Realizado manual.
- O formulário sugere quem cria como Responsável e o Status Planejado.
- Valores: valor em reais em centavos; data `AAAA-MM-DD`; data e hora `AAAA-MM-DDTHH:MM` no fuso do Mural; lista como lista de textos; pessoa pelo id. Por enquanto o campo pessoa aceita só a Liderança; o ticket 11 acrescenta os Professores.
- A Postagem é reconhecida pelo nome para o rótulo "Data de publicação": se o Admin renomear a Categoria, o rótulo volta a "Data".
- O gatilho só confere na criação. O ticket 05 decide o que uma edição confere, já que um Responsável pode ter sido desativado e um campo pode ter saído da Categoria depois.
- A lista mostra todos os Eventos, passados inclusive, sem paginação; o ticket 06 traz as visões do calendário.
