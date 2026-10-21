# 11: Professores e Auxiliares

**What to build:** o acesso do Professor às aulas da EBD. Admin e quem tem Função em Ensino cadastram um Professor e geram seu convite (nível Professor, uso único). Na EBD, cada Ocorrência escolhe Professor e Auxiliar na tabela de Professores ou entre a Liderança (sem outro cadastro). O Professor entra e vê no calendário só as aulas em que foi colocado, com todos os campos, e edita só as observações. Não muda Status, data nem Responsável, e não vê Adolescentes, aniversários nem outros Eventos. Só o Admin inativa um Professor. Aula sem Professor entra nos alertas, sem impedir sair de Rascunho.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Cadastro de Professor e convite por Admin e por quem tem Função em Ensino
- [ ] Professor e Auxiliar por Ocorrência, da tabela de Professores ou da Liderança
- [ ] Professor e Auxiliar veem só as aulas em que foram colocados e editam só as observações (testado nas políticas por linha)
- [ ] Professor não vê Adolescentes, aniversários nem outros Eventos
- [ ] Alerta de aula sem Professor aparece em Próximos eventos
- [ ] Só o Admin inativa um Professor
- [ ] Testes no módulo de domínio e nas políticas por linha
