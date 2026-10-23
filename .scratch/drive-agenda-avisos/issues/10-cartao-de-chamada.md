# 10: Cartão de Chamada

**Spec:** `../spec.md` (Alteração 5.2)

**What to build:** No dia da aula, a tela principal mostra ao Professor e ao Auxiliar um cartão "Chamada de hoje · EBD · tema · horário" com botão para a Chamada. O cartão fica visível do início do dia da aula até o fim do dia seguinte (janela configurável), vira "Chamada feita ✓" depois de concluída e "Chamada pendente" (alerta) se o horário da aula já passou sem Chamada.

**Blocked by:** 08 (Chamada do Professor), 09 (Tela principal: semana)

**Status:** ready-for-agent

- [ ] O estado do cartão (de hoje, feita, pendente) é calculado em código puro a partir da aula, do relógio e da janela
- [ ] Aparece só para o Professor e o Auxiliar daquela aula, e só dentro da janela
- [ ] A janela (padrão: início do dia da aula até o fim do dia seguinte) é editável em Configurações do Admin, com Log
- [ ] Depois da Chamada concluída o cartão mostra "Chamada feita ✓"
- [ ] O botão leva direto à Chamada da aula
- [ ] Funciona para Professor de nível Professor e para Líder escolhido como Professor
- [ ] Testes de domínio (dia certo, só o Professor e o Auxiliar, mudança de estado após a Chamada, janela) e fumaça do cartão
