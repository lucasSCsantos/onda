# 08: Séries e Ocorrências

**What to build:** eventos recorrentes. Qualquer Categoria pode ser criada como Série semanal, quinzenal (dias da semana escolhidos) ou mensal (N-ésimo dia da semana, como "primeiro domingo"), terminando por data ou número de Ocorrências. Cada Ocorrência é um Evento editável (horário, Responsável, local, Professor). Editar "só esta", "esta e as seguintes" ou "toda a série" altera as Ocorrências afetadas sem dividir a Série nem tirá-las dela; Ocorrências editadas individualmente não são sobrescritas, e Realizadas ou Canceladas ficam congeladas. Cancelar uma data não afeta as outras. Também é possível encerrar a Série (as geradas depois do fim viram Canceladas) ou cancelar todas as futuras. Excluir Série e Ocorrências é só do Admin. Criar Série segue a mesma permissão da Categoria.

**Blocked by:** 05

**Status:** done

- [x] Criar Série semanal, quinzenal e mensal com término por data ou por contagem
- [x] Mensal pelo N-ésimo dia da semana, incluindo o último do mês
- [x] Cancelar uma única Ocorrência não afeta as demais
- [x] "Esta e as seguintes" e "toda a série" não sobrescrevem Ocorrências editadas nem mexem em Realizadas ou Canceladas
- [x] Ocorrência editada continua na Série, marcada como editada
- [x] Encerrar Série e cancelar todas as futuras funcionam
- [x] Só o Admin exclui Série
- [x] Testes no módulo de domínio para expansão e para os três escopos de edição
