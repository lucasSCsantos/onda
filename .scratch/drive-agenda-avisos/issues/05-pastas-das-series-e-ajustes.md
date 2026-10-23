# 05: Pastas das Séries e ajustes

**Spec:** `../spec.md` (Alteração 3, Séries)

**What to build:** Cada Ocorrência de uma Série ganha sua Pasta do Evento, criada de forma assíncrona sem travar a criação da Série. Quando título ou data mudam, a pasta é renomeada (sem apagar conteúdo). Um botão "Criar pasta agora" na tela do Evento reprocessa uma falha ou cria a pasta de um Evento criado antes da integração.

**Blocked by:** 03 (Séries semanais com número), 04 (Pasta do Evento para Eventos avulsos)

**Status:** done

- [x] Criar uma Série enfileira uma tarefa de pasta por Ocorrência sem esperar o Drive; as pastas usam o título de exibição (com número) no nome
- [x] Falhas de uma Ocorrência não impedem as outras e fazem novas tentativas
- [x] Mudar título ou data de um Evento (ou o número, ao editar a Série) renomeia a pasta existente por tarefa, sem apagar nada
- [x] "Criar pasta agora" cria a pasta de um Evento sem pasta ou com erro, respeitando um link manual já preenchido; para o Evento com erro, reabre a tarefa fechada (`tarefas_de_pasta` tem uma linha por Evento, `evento_id` é único) e zera as tentativas
- [x] Cancelar uma Ocorrência não toca na pasta
- [x] Testes com o Drive falso (uma pasta por Ocorrência, não duplicação, renomear, nova tentativa) e Logs de criação e falha
