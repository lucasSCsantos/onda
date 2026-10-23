# 02: Campos nativos por Categoria

**Spec:** `../spec.md` (Alteração 2, ADR 0008)

**What to build:** Cada Categoria passa a mostrar só os campos que a descrevem. O Admin define, por Categoria, se local, fim, observações e link ficam ocultos, visíveis ou obrigatórios, na tela de Categorias e já ao criar uma Categoria nova. O formulário, a validação (também no banco), os cartões do calendário e as telas de detalhe seguem essa configuração. A Postagem usa só o início, rotulado "Publicação", e o calendário, a lista e o Painel do dia a mostram nessa data. O Pequeno grupo ganha o campo "Link do material".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Auditoria campo a campo de cada Categoria registrada no resumo, comparada com a tabela proposta no spec, com os ajustes justificados
- [ ] Migração aditiva: configuração dos campos nativos por Categoria, padrão "visível" (nenhuma Categoria existente muda sem ação do Admin); valores iniciais definidos pela auditoria
- [ ] O Admin edita a configuração ao editar e ao criar uma Categoria
- [ ] O formulário mostra só os campos permitidos; ocultos não aparecem e obrigatórios são exigidos
- [ ] A validação no banco rejeita campo obrigatório vazio e ignora o oculto, sem apagar valores antigos
- [ ] Postagem: só "Publicação" (sem fim nem local), e calendário, lista e Painel do dia usam essa data
- [ ] Pequeno grupo tem "Link do material" (campo por Categoria, aditivo)
- [ ] Os Eventos existentes que têm valor em campo agora oculto continuam com o dado e são listados no resumo
- [ ] Testes de domínio (obrigatórios e proibidos por Categoria, compatibilidade com Eventos existentes), teste do banco da configuração e do gatilho, e fumaça do formulário mostrando só os campos da Categoria
- [ ] Mudanças da configuração viram Log; `pnpm test` e a fumaça passam
