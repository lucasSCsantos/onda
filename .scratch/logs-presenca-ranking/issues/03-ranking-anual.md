# 03: Ranking anual

**What to build:** o ranking anual dos Adolescentes em `/ranking`: a soma dos pontos das Marcações no ano escolhido, com o detalhamento por Marcação, o desempate configurável e os anos anteriores consultáveis. Ver ADR 0005.

**Blocked by:** 02 (Presença na EBD).

**Status:** resolved

- [x] Migração `20261022020000_ranking.sql`: `pontos_do_ano(ano)` e `anos_com_presenca()` (só a Liderança, pelas políticas da presença) e `configuracoes.desempate_por` (padrão: Presente). Rollback comentado.
- [x] Calculado na hora: mudar os pontos vale também para o passado (ADR 0005). Aulas Canceladas não contam, e o ano é o do fuso do Mural.
- [x] Classificação e desempate no domínio (`src/dominio/ranking.ts`). Quem continua empatado divide a posição.
- [x] Logs: `ranking.pontuacao_alterada` (gatilho de `marcacoes`, desde o ticket 02) e `ranking.desempate_alterado`, com os nomes das Marcações.
- [x] Telas: Ranking com seletor de ano e detalhamento, pontos do ano no histórico do Adolescente e desempate nas Configurações. Só a Liderança vê.
- [x] Testes: domínio (`src/dominio/ranking.test.ts`) e banco (`tests/rls/ranking.test.ts`).
