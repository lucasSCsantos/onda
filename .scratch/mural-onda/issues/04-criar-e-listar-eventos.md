# 04: Criar e listar Eventos

**What to build:** o primeiro Evento de ponta a ponta. Um líder cria um Evento de uma Categoria da sua Área, com título, início (hora opcional, sem hora é dia inteiro), fim opcional, local, Responsável (qualquer pessoa da Liderança), Status, observações, link opcional e os campos específicos da Categoria (todos os tipos, menos checklist). Pode salvar como Rascunho sem Responsável, mas não sai de Rascunho sem um. O Evento aparece numa lista cronológica no fuso America/Bahia, visível a toda a Liderança; quem não tem Função na Área não consegue criar.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Criar Evento com campos comuns e específicos conforme a Categoria, validando os obrigatórios
- [ ] Hora de início vazia gera Evento de dia inteiro; fim sempre opcional
- [ ] Rascunho aceita vazio de Responsável; qualquer outro Status exige Responsável
- [ ] Postagem usa a data do Evento como data de publicação, sem campo extra de data
- [ ] Lista mostra todos os Eventos para a Liderança; Pendente e Professor não leem
- [ ] Criador e criação ficam registrados
- [ ] Testes de permissão (módulo de domínio e políticas por linha) para criar com e sem Função na Área
