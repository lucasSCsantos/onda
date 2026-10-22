Status: ready-for-agent

# Logs, presença na EBD e ranking anual

Usa o vocabulário de `CONTEXT.md`. Três acréscimos ao MVP, entregues nesta ordem, sem mudar o que já funciona: Logs (01), Presença na EBD (02) e Ranking anual (03). Cada feature nova grava seus Logs desde o início.

## Problem Statement

O Admin não tem como ver o que acontece no Mural (quem criou, mudou, aprovou ou apagou o quê, e o que deu errado) sem abrir o banco. A presença dos Adolescentes na EBD é anotada fora do sistema, sem registrar como cada um participou, e por isso não há ranking anual nem alerta para quem parou de vir.

## Solution

- **Logs:** uma seção do Admin com a linha do tempo de tudo o que acontece, em frases em português, filtros, busca, aba de alertas e exportação em CSV. Os registros são só de inserção, gravados pelo banco (ADR 0004).
- **Presença:** uma tela de Chamada em cada aula de uma Categoria com chamada (a EBD), com Marcações configuráveis (presente, trouxe bíblia, trouxe visitante, fez atividade), salvas a cada toque.
- **Ranking:** a soma anual dos pontos das Marcações por Adolescente, calculada na hora, com desempate configurável.

## Decisões

- O que é configurável (retenção dos Logs, Marcações e pontos, faltas para o alerta, desempate) fica em tabelas editáveis pelo Admin, nunca no código.
- O ranking é calculado na hora a partir da presença: mudar a pontuação vale também para o passado (ADR 0005).
- Quem faz a chamada é o Admin e quem tem Função na Área da Categoria (`pode_criar_evento`). A chamada do Professor (prevista em `docs/pos-mvp.md`) fica para depois.
- Uma aula com chamada não pode ser excluída (chave estrangeira `restrict`): cancele-a, para o ranking não perder pontos.

## Fora do escopo

Assinatura de calendário (iCal), pastas no Drive, acesso dos Adolescentes, upload de arquivos, notificações e reconstituir o histórico de antes dos Logs.
