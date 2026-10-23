# 13: Push: fila, envio e central

**Spec:** `../spec.md` (Alteração 7, fila e central, ADR 0007)

**What to build:** As Notificações devidas são gravadas em uma fila no banco; a rota do agendador as lê e envia a cada dispositivo ativo, respeitando a janela de horário da pessoa, com retentativas e sem nunca enviar a mesma notificação duas vezes. A mesma tabela serve de central dentro do app, com não lidas em destaque e indicador no menu. O primeiro tipo entregue é "você foi definido(a) como Responsável (ou Professor) por um Evento".

**Blocked by:** 12 (Push: ativar neste aparelho)

**Status:** ready-for-agent

- [ ] Fila de Notificações com chave única (tipo + Evento + pessoa + janela), conteúdo mínimo, estado, tentativas, próxima tentativa, `tag`, validade (TTL), lida e criação
- [ ] Rota do agendador (`pg_cron`/`pg_net`, `CRON_SECRET`) que envia por dispositivo de forma independente; a falha de um não impede os outros
- [ ] Respeita a janela de horário da pessoa (padrão 8h às 21h em America/Bahia); fora dela a notificação espera abrir, salvo urgentes
- [ ] Retentativas com espera crescente e limite; falhas definitivas vão para os Logs como erro; inscrições com 404 ou 410 são removidas
- [ ] Modo de teste (dry-run) por variável de ambiente que registra o que seria enviado sem enviar
- [ ] Modelos de texto em um mapa no código, em pt-BR, curtos; nunca incluem dados de Adolescentes; o Pequeno grupo omite o local
- [ ] Primeiro tipo: designação como Responsável ou Professor/Auxiliar, para Liderança e Professores
- [ ] Central dentro do app com não lidas em destaque, marcação de lida, link para o Evento e indicador de não lidas no menu
- [ ] Retenção da central configurável (padrão 30 dias) com limpeza agendada
- [ ] Preferências por pessoa: ligar e desligar cada tipo e a janela de horário, em "Minha conta"
- [ ] Testes com o envio falso (idempotência, janela, vários dispositivos, dry-run, payload sem dados de Adolescentes) e do banco (chave única, políticas, retenção)
