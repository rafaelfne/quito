# Primeiros passos
<!-- virgilio:feature stage=open -->

## O que é

O caminho guiado do professor, da primeira entrada até a primeira cobrança pronta. É o que as outras funcionalidades chamam de cadastro. Ele traz os alunos para o Quitô sem digitar um por um, informa de onde cada aluno parte e já mostra uma cobrança de verdade no primeiro dia. A cobrança pelo Quitô sempre começa no mês seguinte ao da entrada, para o professor não precisar lançar aulas que já passaram e a primeira conta não sair errada. Até lá, ele marca as aulas como treino, sem gerar cobrança, e cria o hábito antes da primeira cobrança.

## O que entra

- Sequência guiada: depois da primeira entrada, o Quitô mostra os passos e quanto falta. O professor pode sair e continuar depois de onde parou, e o painel lembra o que ficou pendente até ele terminar.
- Pergunta de partida: quantos dias, em média, os pais costumam atrasar hoje. A resposta é guardada para comparar com o atraso medido pelo Quitô.
- Passo de recebimento: abre os dados de recebimento da funcionalidade Cobrança (chave Pix, nome e dia de vencimento) dentro da sequência.
- Importar alunos colando uma lista: o professor cola um texto ou linhas de uma planilha, com um aluno por linha, e o Quitô separa nome, responsável e telefone.
- Importar dos contatos do celular: o professor escolhe os contatos dos responsáveis, e o Quitô recebe só os que ele escolheu, nunca a agenda inteira. Depende do Spike de importação de alunos.
- Conferência da importação: uma tela para revisar, corrigir e completar o que veio antes de salvar, como o nome do aluno quando o contato é "Mãe do Pedro". Linhas repetidas ou sem telefone ficam marcadas.
- Forma de cobrança e horário em grupo: o professor marca vários alunos e aplica de uma vez o mesmo valor e a mesma forma de cobrança, depois acerta só o horário de cada um.
- Saldo inicial do aluno: quantas aulas sobram no pacote e quantos créditos de reposição ele já tem, para o Quitô partir do valor certo.
- Início no mês seguinte: o Quitô avisa qual será o primeiro mês cobrado e o dia da primeira cobrança de cada responsável.
- Aulas de treino: da entrada até o fim do mês, o professor marca as aulas como em qualquer mês, e o Quitô deixa claro que elas não geram cobrança.
- Prévia do fechamento no treino: mostra a conta de cada responsável com as aulas marcadas, identificada como treino e sem virar cobrança nem lembrete.
- Acerto do saldo no dia 1: no início do primeiro mês cobrado, o Quitô mostra o saldo de pacote e os créditos previstos depois do treino. O professor confirma ou corrige, e a contagem real começa desse valor.
- Prévia da primeira cobrança: a mensagem pronta, com os dados de um aluno do próprio professor e o valor previsto para o mês seguinte, no fim da sequência.
- Convite para as notificações: ao fim da sequência, o Quitô leva o professor ao guia de ativação da funcionalidade App no celular e notificações, para ele receber o aviso no dia de cobrar.

## O que fica de fora

- Cobrar o mês em que o professor entrou.
- Lançar aulas e pagamentos de meses anteriores.
- Importar de outros sistemas ou manter uma planilha sincronizada com o Quitô.
- Ler a agenda inteira do celular.
- Dados de exemplo ou modo de demonstração.
- Vídeos e tour por todas as telas do app.
- Ajuda de uma pessoa para fazer a importação.

## Perguntas em aberto

- De onde vem a lista de alunos do professor e quais importações valem a pena. Quem responde é o Spike de importação de alunos.

## Como medir

- Parte dos professores que chegam à prévia da primeira cobrança em até 7 dias depois da primeira entrada. A meta inicial é 60%.
- Tempo mediano para trazer os alunos, do início da importação até salvar. A meta é menos de 10 minutos para 20 alunos.
- Parte dos professores que concluíram a sequência e enviam a primeira cobrança no mês seguinte. A meta inicial é 70%.

## Descobertas e Spikes
<!-- virgilio:items -->
- Spike: [Importar alunos](../spikes/importar-alunos.md)
<!-- virgilio:items-end -->
