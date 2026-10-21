# 02: Convites, cadastro aberto e aprovação

**What to build:** o ciclo de contas. O Admin gera um convite de uso único com nível, Função e validade (padrão de 7 dias, editável). Quem se cadastra por ele (nome, e-mail, senha, data de nascimento) entra já aprovado. Quem se cadastra sem convite fica Pendente: vê só uma tela de espera e nenhum dado. O Admin vê a lista de Pendentes, aprova (definindo nível e Função) ou recusa. O Admin também desativa um usuário sem apagar o histórico e promove outra pessoa a Admin.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Convite de uso único com validade; segundo uso, convite vencido ou convite revogado são recusados
- [x] Cadastro por convite entra com nível e Função do convite
- [x] Cadastro sem convite cria um Pendente que não lê nenhum dado (testado nas políticas por linha)
- [x] Admin aprova (nível e Função) ou recusa Pendentes
- [x] Admin desativa usuário; o histórico permanece
- [x] Só um Admin promove outro Admin
- [x] Testes cobrem os quatro níveis de acesso no que se refere a quem lê e escreve usuários

## Comments

**2026-10-21 (implementação, branch `feat/02-convites-cadastro-e-aprovacao`):** pronto e verificado localmente: testes no domínio (`acesso`, `convites`, `cadastro`) e nas políticas por linha (`tests/rls/contas.test.ts`), e o fluxo completo no navegador (Admin gera convite, cadastro pelo link, segundo uso recusado, cadastro sem convite como Pendente, aprovação com Função, promoção, desativação, reativação, recusa). As Áreas e Funções do catálogo já entram nesta migração, porque convite e aprovação precisam delas; edição pelo Admin, várias Funções por pessoa e Categorias ficam no ticket 03. Decisões a confirmar: recusar apaga a conta do Pendente (a pessoa pode se cadastrar de novo); convite também pode conceder Admin; validade do convite vai de 1 a 30 dias; Professor não tem Função; a Liderança lê e-mail e data de nascimento uns dos outros. Atenção: com confirmação de e-mail ligada em produção, o convite é gasto no cadastro, antes da confirmação; um e-mail digitado errado exige um convite novo.
