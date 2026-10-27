# 06: Observações sobre os Adolescentes

**What to build:** a Liderança registra, na página de cada Adolescente, o que sabe sobre ele, em entradas separadas com autoria, para cuidar melhor e passar a informação entre líderes, com privacidade rigorosa.

- Seção "Observações" na página do Adolescente: aviso permanente e discreto no topo ("Visível apenas para a liderança. Registre só o que ajuda a cuidar do adolescente e evite dados de saúde ou informações sensíveis da família."), lista cronológica de entradas, cada uma com texto, autor (Líder), data de criação e data da última edição, formulário de adicionar com contador de caracteres e limite de 2.000. Texto simples; nada é bloqueado automaticamente pelo conteúdo.
- Tabela nova de Observações ligada ao Adolescente, com política de acesso própria e garantida no banco: Admin e Líder leem e criam; **só o autor e o Admin** editam e apagam; Professor e Pendente não veem nada. O autor é gravado pelo banco a partir da sessão (nunca vem do formulário) e a data da última edição é atualizada automaticamente. Limite de 2.000 caracteres e texto não vazio por check no banco. Reversão em comentário SQL.
- Observações de Adolescente inativo são preservadas e continuam visíveis. Como Adolescentes nunca são excluídos (só inativados), nada as apaga; a chave estrangeira usa exclusão em cascata só por segurança, documentada, e qualquer remoção futura de Adolescente deve gerar Log.
- Logs: registram apenas "observação adicionada, editada ou apagada para {adolescente} por {líder}", **nunca** o texto. O texto não aparece em Notificações, central de notificações, `.ics`, exportações CSV, relatórios, busca nem em nenhum serviço externo.
- README: nota recomendando que a autorização dos pais cubra esse tipo de registro (LGPD) e a regra de exclusão. Resumo da alteração.
- Branch `feat/alt-6-observacoes` a partir de `develop`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Admin e Líder leem e adicionam Observações; Professor e Pendente não leem nem criam (teste de RLS)
- [ ] Só o autor e o Admin editam e apagam; outro Líder não consegue (teste de RLS)
- [ ] O autor vem da sessão (não pode ser forjado) e a data da última edição muda ao editar
- [ ] Texto vazio ou com mais de 2.000 caracteres é recusado no banco e o contador aparece no formulário
- [ ] O aviso permanente aparece no topo da seção
- [ ] Observações de Adolescente inativo continuam existindo e visíveis
- [ ] Os Logs de adicionar, editar e apagar não contêm o texto (teste que procura o texto nos detalhes e rótulos dos Logs)
- [ ] O texto não aparece em Notificações, `.ics`, exportações CSV nem busca (testes)
- [ ] README com a nota de LGPD e a regra de exclusão
- [ ] Testes de domínio e de RLS passando; `pnpm test`, `pnpm typecheck`, `pnpm lint` e build verdes
