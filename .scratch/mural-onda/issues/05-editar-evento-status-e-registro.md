# 05: Editar Evento, Status e registro de alterações

**What to build:** o ciclo de vida do Evento. Pode editar e mudar o Status o Admin, quem tem Função na Área da Categoria e o Responsável. Os Status (Rascunho, Planejado, Confirmado, Realizado, Cancelado, Adiado) mudam livremente, sem ordem. Cancelado fica visível e riscado; Adiado mantém a data, tem marca própria, e remarcar volta o Evento a Planejado. Confirmado vira Realizado sozinho depois do horário de fim (ou no dia seguinte, sem fim); Planejado e Rascunho vencidos ficam parados. Só o Admin exclui. Cada alteração é gravada (quem, quando, o que mudou), visível só ao Admin. Evento mostra quem criou e quem editou por último. Responsável desativado faz o Evento futuro contar como "sem Responsável".

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Quem pode editar e mudar Status segue a regra da spec; os demais líderes só leem
- [ ] Transição livre entre os Status; Realizado manual só para Admin e Responsável depois do fim
- [ ] Realizado automático para Confirmado, com e sem horário de fim; Planejado e Rascunho vencidos não mudam
- [ ] Cancelado riscado, Adiado com marca própria, remarcar volta a Planejado
- [ ] Só o Admin exclui
- [ ] Registro completo de alterações gravado e legível só pelo Admin
- [ ] Responsável desativado conta como "sem Responsável"
- [ ] Testes no módulo de domínio e nas políticas por linha
