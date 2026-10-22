# Ranking calculado na hora, com a pontuação atual

O ranking anual não é guardado: `pontos_do_ano` soma, a cada consulta, as Marcações das presenças do ano multiplicadas pelos pontos atuais de cada Marcação, e o domínio (`src/dominio/ranking.ts`) classifica e desempata. Assim não há tabela de pontos para manter em dia, e os anos anteriores continuam consultáveis sem zerar nada.

Consequência deliberada: mudar a pontuação de uma Marcação vale também para o passado, e o ranking de todos os anos muda junto. Guardar os pontos do momento (e manter o ranking antigo intacto) exigiria copiar a pontuação em cada presença; descartamos isso porque o ministério prefere que a regra seja uma só. A mudança fica registrada nos Logs (`ranking.pontuacao_alterada`).

O desempate também é configuração: uma Marcação (padrão: Presente, isto é, mais presenças) ou nenhuma, quando o empate divide a posição (1, 2, 2, 4).
