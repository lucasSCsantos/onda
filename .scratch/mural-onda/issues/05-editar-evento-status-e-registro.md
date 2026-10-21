# 05: Editar Evento, Status e registro de alterações

**What to build:** o ciclo de vida do Evento. Pode editar e mudar o Status o Admin, quem tem Função na Área da Categoria e o Responsável. Os Status (Rascunho, Planejado, Confirmado, Realizado, Cancelado, Adiado) mudam livremente, sem ordem. Cancelado fica visível e riscado; Adiado mantém a data, tem marca própria, e remarcar volta o Evento a Planejado. Confirmado vira Realizado sozinho depois do horário de fim (ou no dia seguinte, sem fim); Planejado e Rascunho vencidos ficam parados. Só o Admin exclui. Cada alteração é gravada (quem, quando, o que mudou), visível só ao Admin. Evento mostra quem criou e quem editou por último. Responsável desativado faz o Evento futuro contar como "sem Responsável".

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Quem pode editar e mudar Status segue a regra da spec; os demais líderes só leem
- [x] Transição livre entre os Status; Realizado manual só para Admin e Responsável depois do fim
- [x] Realizado automático para Confirmado, com e sem horário de fim; Planejado e Rascunho vencidos não mudam
- [x] Cancelado riscado, Adiado com marca própria, remarcar volta a Planejado
- [x] Só o Admin exclui
- [x] Registro completo de alterações gravado e legível só pelo Admin
- [x] Responsável desativado conta como "sem Responsável"
- [x] Testes no módulo de domínio e nas políticas por linha

## Comments

**2026-10-21 (implementação, em `main`):** pronto. Regras no domínio (`src/dominio/eventos.ts`: `podeEditarEvento`, `podeExcluirEvento`, `podeMarcarRealizado`, `statusDaEdicao`, `fimDoEvento`, `statusNoMomento`, `semResponsavel`, `lerEdicao` e `entradaDoEvento`, o caminho inverso de `lerEvento`) e no banco (migração `edicao_de_eventos`: política de edição com `pode_editar_evento`, de exclusão só do Admin, o gatilho `conferir_evento` na criação e na edição, `status_no_momento`, `pode_marcar_realizado`, `realizar_confirmados` agendada no pg_cron a cada minuto, e a tabela `alteracoes_dos_eventos`, gravada por gatilho e legível só pelo Admin). `tests/rls/edicao-de-eventos.test.ts` confere que banco e domínio concordam. Telas: `/eventos/[id]` (detalhe, com quem criou e quem editou por último, Editar e Excluir) e `/eventos/[id]/editar`; a lista abre o Evento.

Não verificado no navegador: o `pnpm build` falha nesta máquina porque o store global do pnpm tem 46 pacotes alterados em disco (`pnpm store status`), e `@alloc/quick-lru` ficou só com o `package.json`. `pnpm install --force` não resolve.

Decisões a confirmar:
- O Realizado automático é gravado pelo pg_cron (a extensão precisa estar ativa no projeto hospedado), e as telas já mostram o Status do momento (`statusNoMomento`), então um minuto de atraso não aparece. Um Confirmado que terminou já conta como Realizado na edição.
- O Realizado manual usa o Responsável que estava gravado (quem se põe como Responsável não marca Realizado na mesma edição) e o fim que fica gravado. Nenhum Evento fica Realizado antes do fim, nem é levado para depois de agora.
- Remarcar = mudar início ou fim de um Adiado que continua Adiado; ele volta a Planejado. Quem escolhe outro Status ao remarcar fica com ele.
- O Responsável sem Função na Área pode passar o Evento a outra pessoa (e deixa de editá-lo).
- "Evento futuro" = que ainda não terminou: com Responsável desativado, conta como sem Responsável; depois do fim, o nome fica para o histórico. Um Responsável ou pessoa de campo desativados podem ficar numa edição, mas ninguém escolhe um desativado.
- Na edição, o banco confere só os campos que mudaram; o domínio tira do Evento os campos que saíram da Categoria e mantém o checklist como estava (ticket 12).
- O registro grava também a criação e a exclusão (sobrevive ao Evento); o Realizado automático aparece com `feito_por` nulo.
- Um Evento novo continua sem poder nascer Realizado: cria-se e marca-se depois do fim.
