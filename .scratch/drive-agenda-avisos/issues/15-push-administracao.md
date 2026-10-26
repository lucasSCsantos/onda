# 15: Push: administração

**Spec:** `../spec.md` (Alteração 7, tela de administração)

**What to build:** Uma tela do Admin para operar o canal de Notificações: ligar ou desligar, ver a fila (pendentes, enviadas, falhas), editar os horários dos lembretes e do resumo semanal e o limite de urgência, ver quantas pessoas têm ao menos um dispositivo ativo e enviar uma notificação de teste para si mesmo.

**Blocked by:** 13 (Push: fila, envio e central)

**Status:** resolved

- [x] Tela nova na administração (item na lista única de destinos do Admin), só para o Admin
- [x] Interruptor do canal de Notificações; desligado, nada é enviado
- [x] Fila com contagem e lista de pendentes, enviadas e falhas, sem endpoints, chaves nem dados de Adolescentes
- [x] Edição dos horários dos lembretes, do resumo semanal e do limite de urgência, e da retenção da central; cada mudança vira Log
- [x] Mostra quantas pessoas têm ao menos um dispositivo ativo
- [x] Botão de notificação de teste para si mesmo
- [x] Testes de domínio das configurações e fumaça da tela
