# Mural ONDA — Pós-MVP

Tudo o que ficou deliberadamente fora do MVP. Usa o vocabulário de `CONTEXT.md`.

## Planejado

### Presença na EBD
- Registro de presença por aula, com marcações configuráveis (presença, trouxe bíblia, trouxe visitante, fez atividade), não colunas fixas.
- O **Professor** e o **Auxiliar** poderão fazer a chamada das aulas em que estão.
- Depende do cadastro de Adolescentes ativo/inativo, que já guarda o histórico.

### Ranking anual
- Ranking geral anual dos Adolescentes, calculado a partir das marcações, com pontos configuráveis.

### Pequenos grupos
- Hoje existe um único Pequeno grupo. Ele será dividido em dois (meninos e meninas).
- No MVP "grupo" é um campo de escolha configurável. Depois, vínculo entre Adolescente e grupo, junto com a presença.

### Assinatura de calendário (iCal)
- Um endereço por usuário.

### Drive
- Criação automática de uma subpasta no Drive compartilhado para cada aula, via Google Drive API com service account.
- No MVP o link da pasta ou do documento é colado no Evento.

### Acesso dos adolescentes
- Acesso dos próprios Adolescentes à escala de serviço e ao calendário de Eventos confirmados.
- O cadastro separado de Usuários já prepara essa ligação (ADR 0003).

## Decidido adiar durante a definição do MVP

### Avisos e notificações
- Push, e-mail ou outro aviso ativo (por exemplo, "você foi colocado como Responsável", "evento amanhã").
- No MVP os alertas existem só dentro do app, na tela de Próximos eventos. O app não escreve no WhatsApp.

### Registro de alterações
- Tela para o Admin consultar o registro completo de alterações por Evento (quem, quando, o que mudou).
- O registro é gravado desde o MVP, porque não dá para reconstruí-lo depois.

### Recorrência
- Série mensal por dia fixo do mês ("todo dia 15"). O MVP só tem mensal por N-ésimo dia da semana ("primeiro domingo", "último sábado").

### Checklist do Acampamento
- Responsável e prazo por item. No MVP é uma lista simples de tarefas (texto e feito/não feito).

### Professores
- Cadastro de professores convidados, sem login. No MVP a aula usa só a tabela de Professores e observações livres para convidados.

### Autorização dos pais (LGPD)
- Registrar no cadastro do Adolescente que a autorização existe. No MVP isso é um processo fora do sistema, e o Acampamento guarda apenas o link da autorização do Evento.

## Fora do escopo (não é só adiado)
- Upload de qualquer material ou postagem. Tudo é link.
- Migração dos dados do Notion. Os dados são cadastrados manualmente.
