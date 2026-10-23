# 03: Séries semanais com número

**Spec:** `../spec.md` (Alteração 2, Séries)

**What to build:** A Série aceita no máximo repetição semanal, por até 6 meses a partir do primeiro dia (teto de segurança de 52 Ocorrências). Cada Ocorrência recebe um número na ordem das datas, que não muda se outra for cancelada, e todas as telas passam a mostrar o título de exibição "Título · número". Eventos avulsos continuam só com o título digitado. O formulário explica o limite.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A regra da Série rejeita repetição mais frequente que semanal e período maior que 6 meses (no domínio e no banco), com mensagem clara no formulário ("repete no máximo toda semana, por até 6 meses")
- [ ] Migração aditiva: coluna opcional do número da Ocorrência, vazia nos avulsos e nos Eventos existentes; não há Séries em produção
- [ ] A criação de Série numera as Ocorrências na ordem das datas; cancelar não renumera
- [ ] Uma função de título de exibição compõe "Título · número" e é usada no calendário, na lista, no Painel do dia, nos cartões e no detalhe do Evento
- [ ] Editar "esta", "esta e as seguintes" e "toda a série" mantém os números e o comportamento atual de Ocorrências editadas e congeladas
- [ ] O glossário (Série) está atualizado; Eventos avulsos não mostram número
- [ ] Testes de domínio (limites, numeração, título de exibição, cancelamento sem renumerar) e do banco (rejeição fora do limite e numeração)
