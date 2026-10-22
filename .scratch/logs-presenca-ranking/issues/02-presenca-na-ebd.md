# 02: Presença na EBD

**What to build:** a Chamada de cada aula das Categorias com chamada (a EBD), com Marcações configuráveis, salvas a cada toque. Também a tela de Presença (alerta de ausência e aulas recentes), o histórico de cada Adolescente e o cadastro de Marcações no Admin.

**Blocked by:** 01 (Logs).

**Status:** resolved

- [x] Migração `20261022010000_presenca.sql`: `marcacoes` (com as quatro iniciais), `presencas`, `marcacoes_das_presencas`, `categorias.tem_chamada` (ligada só na EBD) e `configuracoes.faltas_para_alerta` (padrão 3). Rollback comentado.
- [x] Só a Liderança lê. Escrever, só por `salvar_presenca`, que confere quem pode (o Admin e quem tem Função na Área da Categoria), a aula (a partir do dia, não Cancelada, de Categoria com chamada), o Adolescente ativo, as Marcações ativas e o visitante.
- [x] Marcar qualquer Marcação marca também a de presença. O nome do visitante (texto livre, opcional) só vai com a Marcação que o pede e nunca vai para o log.
- [x] Correção guarda quem e quando. Log: "chamada registrada" uma vez por pessoa e aula no dia; depois do dia, cada correção com o Adolescente e o que mudou.
- [x] Adolescentes inativos não aparecem na Chamada; o histórico fica.
- [x] Uma aula com Chamada não pode ser excluída (cancele-a).
- [x] Telas: Chamada (`/eventos/[id]/chamada`), Presença (`/presenca`), histórico do Adolescente (`/adolescentes/[id]`), Marcações (`/admin/marcacoes`), "Tem chamada" no catálogo e faltas para o alerta nas Configurações.
- [x] Testes: domínio (`src/dominio/presenca.test.ts`), políticas (`tests/rls/presenca.test.ts`) e fumaça da Chamada.
