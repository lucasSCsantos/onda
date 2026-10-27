# Resumo da Alteração 2: Horários padrão (ticket 03)

## O que foi feito
- Migração `20261027000000_horarios_padrao.sql`: colunas `horario_padrao` (time) e `duracao_padrao_minutos` (1 a 1439) em `categorias`, só adições; EBD 09:00 e Pequeno grupo 15:00 (sem Log); `log_do_catalogo` passa a registrar as duas colunas com valores legíveis; permissão de coluna só para `update` (a política "o Admin edita Categorias" já restringe ao Admin).
- Domínio `src/dominio/horarios-padrao.ts` (10 testes): valores iniciais do formulário (início; fim só com duração e campo de fim visível e antes da meia-noite; Postagem e Categoria sem padrão não preenchem), leitura do formulário do Admin e o mapa inicial.
- `/admin/horarios` (entrada "Horários padrão" no painel e no menu do Admin): uma linha por Categoria com `CampoDeHora` e duração; grava só o que mudou.
- Formulário de Evento novo abre pré-preenchido (`valoresIniciaisDoHorario` na rota de criação). A edição e Eventos existentes não usam o padrão.

## Decisões e suposições
- Postagem fica fora da tela e nunca é preenchida.
- Fim que passaria da meia-noite fica em branco (a pessoa escolhe o dia do fim).
- Série: nada mudou; ela usa o horário do formulário.
- Log: ação existente `categoria.editada`, com "Horário padrão" (HH:MM) e "Duração padrão (min)".
- A branch `feat/alt-2-horarios-padrao` saiu de `feat/alt-1-componentes` (a Alteração 1 ainda não foi mesclada em `develop`) porque usa o seletor de hora.

## Testes
- Domínio: `horarios-padrao.test.ts`. RLS: `tests/rls/horarios-padrao.test.ts` (valores da migração, só o Admin edita, Log legível, Eventos existentes intactos). Fumaça: `tests/fumaca/horarios-padrao.spec.ts` (editar e limpar, pré-preenchimento com fim, Categoria sem padrão e Postagem, Série com horário alterado, Líder barrado).
- A tela de Admin é lenta no banco local com centenas de Categorias de teste; por isso os timeouts maiores na fumaça.

## Como testar à mão
Admin → Horários padrão, salvar EBD 09:30 com 60 min; Calendário → Novo Evento → EBD: hora 09:30 e fim 10:30.

## Como reverter
Reverter os commits; no banco, os passos em comentário no fim da migração (recriar `log_do_catalogo` e dropar as duas colunas).
