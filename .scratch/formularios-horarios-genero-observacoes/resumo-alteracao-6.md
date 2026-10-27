# Resumo da Alteração 6: Observações sobre os Adolescentes (ticket 06)

## O que foi feito
- Migração `20261027030000_observacoes.sql`: tabela `observacoes` (Adolescente, texto, autor, criado_em, editado_em) com check de texto não vazio e até 2.000 caracteres; RLS própria (Admin e Líder ativos leem e criam; só o autor e o Admin editam e apagam); autor por `default auth.uid()` com privilégio de coluna só em `adolescente_id` e `texto` (e política que exige `autor_id = auth.uid()`); gatilho que carimba `editado_em`; gatilho de Log (`observacao.adicionada/editada/apagada`, só ação, Adolescente e quem fez, `detalhes` vazio); `modulo_da_acao` com as Observações no módulo Adolescentes. Reversão em comentário SQL.
- Domínio `src/dominio/observacoes.ts` (9 testes): limite, validação, contador, quem pode mudar, ordem, "editada". Frases dos Logs em `src/dominio/logs.ts` (1 teste novo).
- Página do Adolescente: seção "Observações" com aviso permanente, lista cronológica (texto, autor, criada em, editada em), formulário com contador de caracteres, e editar/apagar (com confirmação) só para o autor e o Admin. Ações em `src/lib/observacoes/acoes.ts`; falhas viram Log sem o texto.
- README: nota de LGPD e regra de exclusão.

## Decisões e suposições
- A branch é a atual (`feat/alt-5-genero`), a pedido: não foi criada `feat/alt-6-observacoes`.
- O banco local recebeu a migração com `supabase migration up --local`; nada foi aplicado ao projeto remoto.
- O check do texto usa `!~ '^[[:space:]]*$'` (e não `btrim`, que não remove quebra de linha), para recusar texto só de espaços e quebras.
- Quando a conta do autor é removida, `autor_id` vira nulo; a tela mostra "Ex-integrante da liderança" e só o Admin edita ou apaga essa Observação.
- Editar sem mudar o texto não gera Log.
- O Evento já tem um campo próprio "observações"; não tem relação com esta tabela, e os testes de privacidade procuram a tabela nova, não a palavra.

## Testes
- Domínio: `observacoes.test.ts`, `logs.test.ts`. RLS: `tests/rls/observacoes.test.ts` (leitura e criação por perfil, autor não forjável, datas, editar/apagar por autor, outro Líder e Admin, limites, Logs sem o texto, texto fora de Notificações e exportações, preservação com Adolescente inativo e remoção em cascata, código dos canais públicos sem a tabela).

## Como reverter
Reverter os commits; no banco, os passos em comentário no fim da migração.
