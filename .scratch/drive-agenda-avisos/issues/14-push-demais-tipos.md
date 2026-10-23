# 14: Push: demais tipos

**Spec:** `../spec.md` (Alteração 7, tipos de notificação)

**What to build:** Os outros avisos: lembretes dos Eventos em que a pessoa é Responsável (1 dia e 2 horas antes), mudança de data, hora ou local e cancelamento (urgente quando o Evento começa em menos de 12 horas), resumo semanal (domingo às 19h), Chamada pendente para o Professor e o Auxiliar, e Eventos dos próximos 7 dias sem Responsável para o Admin.

**Blocked by:** 13 (Push: fila, envio e central), 08 (Chamada do Professor)

**Status:** ready-for-agent

- [x] Lembretes com `tag` por Evento, para um lembrete atualizado substituir o anterior, e validade (TTL) que evita entregar um lembrete atrasado de forma enganosa
- [x] Mudança de data, hora ou local e cancelamento de Evento seu geram aviso; os de Evento que começa em menos de 12 h furam a janela de horário (limite editável em Configurações)
- [x] Resumo semanal com os Eventos da semana da pessoa, só para a Liderança
- [x] "Chamada pendente" para o Professor e o Auxiliar quando a aula já passou sem Chamada
- [x] Aviso ao Admin de Eventos dos próximos 7 dias sem Responsável
- [x] Idempotência por tipo + Evento + pessoa + janela mesmo que o agendador rode em duplicidade
- [x] Os textos usam o título de exibição (com número) e nunca trazem dados de Adolescentes
- [x] Cada tipo respeita a preferência da pessoa e o interruptor do canal
- [x] Testes de domínio (quem recebe cada tipo, janelas, urgência, modelos de texto, payload sem dados de Adolescentes) e do banco (geração e idempotência)
