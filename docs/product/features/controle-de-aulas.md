# Controle de aulas
<!-- virgilio:feature stage=open -->

## O que é

Um caderno mínimo em que o professor registra os alunos, como cada um paga e as aulas do mês (dada, falta, reposição). No fim do mês o Quitô mostra quanto cada responsável deve e por quê, e esse valor vai para a mensagem de cobrança.

## O que entra

- Cadastro de aluno com nome, responsável e contato do responsável.
- Forma de cobrança de cada aluno: mensalidade fixa, valor por aula ou pacote de N aulas. O pacote não tem validade: as aulas que sobram passam para o mês seguinte.
- Horário fixo semanal do aluno, que gera sozinho as aulas previstas do mês, inclusive em mês com 5 semanas.
- Regras do professor, numa tela só e iguais para todos os alunos dele: com quanta antecedência a falta conta como avisada (24 horas de partida), se a reposição tem prazo e qual, e se na mensalidade fixa o mês com 5 semanas custa igual ou soma o valor de uma aula avulsa.
- Marcar cada aula prevista como dada, falta avisada, falta sem aviso ou falta do professor, com um toque. Só a falta sem aviso é cobrada.
- Reposição: a falta avisada e a falta do professor viram crédito, e o crédito é usado quando o professor marca a aula de reposição. Se o professor definiu prazo, o crédito vencido some do fechamento.
- Desconto para irmãos: alunos com o mesmo responsável ficam juntos e recebem o desconto que o professor definir.
- Fechamento do mês: uma tela com quanto cada responsável deve, com a conta aberta (aulas, faltas, reposições e descontos).

## O que fica de fora

- Agenda completa com calendário de arrastar e soltar.
- Turmas em grupo com chamada.
- Regra própria para um aluno específico, diferente das regras do professor.
- Conteúdo das aulas, anotações pedagógicas e evolução do aluno.
- Nota fiscal e recibo.
- Área para o aluno ou o responsável entrar no app.
- O envio da cobrança em si, que fica numa funcionalidade própria.

## Perguntas em aberto

- Como funcionam os descontos: só para irmãos ou outros também, em porcentagem ou em valor fixo. O dono vai pensar nisso com calma, e a tarefa de desconto só começa depois dessa resposta.

## Como medir

- Parte dos professores que fecham o mês sem corrigir nenhum valor à mão. O valor de hoje ainda não existe. A meta inicial é 80%.
- Tempo que o professor leva para fechar o mês, da abertura da tela até o valor de todos os alunos. A meta é menos de 5 minutos.
