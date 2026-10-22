# 01: Logs do sistema

**What to build:** a tabela `logs` (só de inserção), gravada pelos gatilhos das tabelas principais e pela RPC `registrar_log`, mais a seção "Logs" do Admin em `/admin/logs` e as Configurações em `/admin/configuracoes`. Ver ADR 0004.

**Status:** resolved

- [x] Migração `20261022000000_logs.sql`, só de acréscimos, com o caminho de reversão comentado no fim.
- [x] Logs de contas e acesso (entrar, sair, login com falha, cadastro, convite criado, usado, revogado e vencido, aprovação, recusa, nível, Funções, desativação, pedido e troca de senha), Eventos (criado, editado com os campos, Status, cancelado, excluído) e Séries (criada, editada com o escopo, encerrada, excluída: um log por operação), Adolescentes, catálogo, configurações e exportações.
- [x] Falhas das ações registradas pelo servidor em `after()`, sem atrasar nem derrubar a ação.
- [x] Sem senha, token, e-mail ou data de nascimento nos logs.
- [x] Só o Admin lê. Ninguém edita nem apaga, nem com a chave de serviço; só a limpeza da retenção apaga.
- [x] Retenção configurável (padrão de 12 meses) com limpeza diária pelo `pg_cron`.
- [x] Tela com frases em português, agrupamento por dia, detalhes ao tocar, filtros combináveis, busca, aba "Alertas e erros", paginação e CSV.
- [x] Opcional ligado nas Configurações: o líder vê o histórico dos Eventos que pode editar.
- [x] Testes: domínio (`src/dominio/logs.test.ts`) e políticas (`tests/rls/logs.test.ts`).
