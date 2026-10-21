# 02: Convites, cadastro aberto e aprovação

**What to build:** o ciclo de contas. O Admin gera um convite de uso único com nível, Função e validade (padrão de 7 dias, editável). Quem se cadastra por ele (nome, e-mail, senha, data de nascimento) entra já aprovado. Quem se cadastra sem convite fica Pendente: vê só uma tela de espera e nenhum dado. O Admin vê a lista de Pendentes, aprova (definindo nível e Função) ou recusa. O Admin também desativa um usuário sem apagar o histórico e promove outra pessoa a Admin.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Convite de uso único com validade; segundo uso, convite vencido ou convite revogado são recusados
- [ ] Cadastro por convite entra com nível e Função do convite
- [ ] Cadastro sem convite cria um Pendente que não lê nenhum dado (testado nas políticas por linha)
- [ ] Admin aprova (nível e Função) ou recusa Pendentes
- [ ] Admin desativa usuário; o histórico permanece
- [ ] Só um Admin promove outro Admin
- [ ] Testes cobrem os quatro níveis de acesso no que se refere a quem lê e escreve usuários
