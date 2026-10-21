# 11: Professores e Auxiliares

**What to build:** o acesso do Professor às aulas da EBD. Admin e quem tem Função em Ensino cadastram um Professor e geram seu convite (nível Professor, uso único). Na EBD, cada Ocorrência escolhe Professor e Auxiliar na tabela de Professores ou entre a Liderança (sem outro cadastro). O Professor entra e vê no calendário só as aulas em que foi colocado, com todos os campos, e edita só as observações. Não muda Status, data nem Responsável, e não vê Adolescentes, aniversários nem outros Eventos. Só o Admin inativa um Professor. Aula sem Professor entra nos alertas, sem impedir sair de Rascunho.

**Blocked by:** 05

**Status:** ready-for-agent

- [x] Cadastro de Professor e convite por Admin e por quem tem Função em Ensino
- [x] Professor e Auxiliar por Ocorrência, da tabela de Professores ou da Liderança
- [x] Professor e Auxiliar veem só as aulas em que foram colocados e editam só as observações (testado nas políticas por linha)
- [x] Professor não vê Adolescentes, aniversários nem outros Eventos
- [x] Alerta de aula sem Professor aparece em Próximos eventos
- [x] Só o Admin inativa um Professor
- [x] Testes no módulo de domínio e nas políticas por linha

## Comments

**2026-10-21 (implementação, em `main`):** pronto. Regras em `src/dominio/professores.ts` (cadastro, inativação, quem vê e edita só observações, aula sem Professor) e no banco (migração `professores`: `pode_cadastrar_professor`, `e_professor_da_aula`, leitura e edição das aulas pelo Professor, leitura da Categoria/campos/Área só do que ele vê, `pessoas_da_aula`, `campo_valido` e `conferir_evento` com Professor e Auxiliar). Telas: `/professores` (cadastro, convite, inativar), "Suas aulas" na tela inicial, calendário e Evento só com as aulas dele, com formulário só de observações. Alerta "Aula sem Professor" em `alertas()`.

Decisões a confirmar:
- O Professor e o Auxiliar são os campos pessoa "Professor" e "Auxiliar" da Categoria (por nome), como no filtro "meus eventos".
- O Professor escreve observações também em aula já Realizada ou Cancelada de uma Série (o congelamento vale para as edições de Série da Liderança).
- O Professor não lê `perfis`: os nomes da aula vêm de `pessoas_da_aula`, sem e-mail nem data de nascimento.
- O Admin também reativa um Professor (em `/professores`).
- A migração reescreve `conferir_evento` e `campo_valido` (cópia da versão do ticket 12 mais as mudanças deste); `campo_valido` ganhou o argumento `nome`.
- Aula com Professor desativado ainda não alerta como sem Professor.
