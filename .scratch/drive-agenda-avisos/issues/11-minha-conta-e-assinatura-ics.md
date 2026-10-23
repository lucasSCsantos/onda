# 11: Minha conta e assinatura de calendário

**Spec:** `../spec.md` (Alteração 6, ADR 0007)

**What to build:** Uma página nova "Minha conta", aberta pelo menu do cabeçalho, com a seção "Calendário". Cada pessoa gera, regera e revoga o endereço `.ics` que mostra os Eventos no calendário do celular, com filtros (todos ou meus, Categorias, aniversários). O endereço funciona como senha de leitura: token em hash, mostrado uma vez, com limite de requisições.

**Blocked by:** 02 (Campos nativos por Categoria), 03 (Séries semanais com número)

**Status:** ready-for-agent

- [ ] Página `/conta` para toda pessoa aprovada (Admin, Líder e Professor), acessível pelo menu do cabeçalho, sem dados novos de cadastro
- [ ] Tabela de assinaturas (uma por pessoa) com hash do token e filtros; políticas só do dono; token mostrado uma única vez; regerar invalida o anterior; revogar apaga
- [ ] Rota pública do feed autenticada pelo token (consulta pelo hash com a chave service-role), com limite de requisições por token (padrão 60 por hora) e resposta 429 acima disso
- [ ] Conteúdo: Planejado, Confirmado, Realizado e Adiado (com "[Adiado]" no título); exclui Cancelado e Rascunho; cada Ocorrência é um Evento individual; Postagem na data de publicação
- [ ] Identificador estável por Evento, horários em America/Bahia, título de exibição (com número), local quando existir e link do material na descrição
- [ ] O Professor de nível Professor recebe só as aulas dele; aniversários só para a Liderança, por opção, só com o primeiro nome
- [ ] Gerar, regerar e revogar viram Log; o token e o endereço nunca aparecem nos Logs
- [ ] A chave service-role entra como variável de ambiente do servidor se o ticket 04 ainda não a tiver criado; README atualizado
- [ ] Testes de domínio (identificador estável, fuso, cancelados, filtros, aniversários) e do banco (revogação, hash, limite de requisições)
