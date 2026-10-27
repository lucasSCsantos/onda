# Resumo da Alteração 1: componentes de formulário (tickets 01 e 02)

## O que foi feito
- Ticket 01: `Selecao`, `SelecaoMultipla`, `CaixaDeMarcar`, `Radio`, `GrupoDeRadio`, `RadioDeIcone` (sem `<select>`, radio ou checkbox nativo visível).
- Ticket 02: `CampoDeData` (digitável `dd/mm/aaaa` + calendário), `CampoDeIntervalo`, `CampoDeHora` (digitável + lista em passos de 15 min, "Sem horário") e `CampoDeDataEHora`, em `src/components/data-e-hora.tsx`. Lógica sem interface em `src/dominio/datas-e-horas.ts` (20 testes).
- Substituídos: Evento (data, hora, fim), término da Série, painel da Série, filtro "Dia" de Eventos, Logs (de/até viram um intervalo), nascimento no cadastro e em Adolescentes, campos de Categoria `data` e `data_hora`.
- Calendário principal (Mês): só estilo (dias da semana em caixa alta e cantos do "hoje" iguais aos novos componentes); nenhuma lógica alterada.
- README com a seção "Componentes de formulário".

## Decisões
- Semana começa na **segunda-feira** (igual ao calendário principal), divergindo do domingo padrão.
- O campo de data aceita digitação (`dd/mm/aaaa`, `ddmmaaaa` e também `AAAA-MM-DD`); o valor enviado continua `AAAA-MM-DD`. Hora vazia continua sendo dia inteiro; data e hora sem hora vale `00:00`.
- Anos antigos: toque no título do calendário abre páginas de 12 anos, depois os meses.
- Janela de notificações: segue com o select do ticket 01 (valores são horas cheias de 0 a 24, "24h" não cabe em `HH:MM`).

## Exceções mantidas
- `type="color"` (Cor da Categoria, Admin → Catálogo): fora da lista de controles a substituir.
- Demais `<input>` são texto, busca ou somente leitura.

## Suposições e limitações
- O intervalo só é usado nos Logs; os outros filtros de período do app são de data única.
- Datas mínima/máxima não são impostas pelo componente (a validação segue no domínio).

## Verificação
- `pnpm lint` e `pnpm typecheck` limpos; `pnpm test`: 1051 testes, 1 falha de RLS (agendador de notificações) que passa isolada (concorrência com a fumaça no mesmo banco).
- Fumaça: 34 passam, 4 falham em `fluxos.spec.ts` (criar Evento, tela principal, Chamada do Professor, Cartão de Chamada). Falham igual **sem** as minhas mudanças (conferido com stash): o banco local tem ~10 mil Eventos acumulados e as listas cortam.
- Capturas antes e depois (375 px e 1280 px): `.scratch/formularios-horarios-genero-observacoes/capturas/`.

## Como testar à mão
Abrir `/eventos/novo/<categoria>`, `/admin/logs` (Filtros), `/cadastro` e `/adolescentes`; usar toque e teclado (setas, Enter, Esc, PageUp/PageDown).

## Como reverter
`git revert` dos commits da branch `feat/alt-1-componentes` do ticket 02; nada de banco foi alterado.
