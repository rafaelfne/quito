# Cobrança
<!-- virgilio:feature id=cobranca stage=building epic=61 -->

## O que é

No dia do vencimento, o Quitô entrega ao professor uma mensagem gentil para o responsável, já com o valor do mês que passou, a conta aberta que vem do fechamento do controle de aulas e a chave Pix. O professor toca em enviar e o WhatsApp manda. O dinheiro cai direto no banco dele.

A cobrança é sempre do mês que terminou: em 5 de dezembro, o responsável paga as aulas de novembro, com faltas e reposições já contadas. A Cobrança vai ao ar antes da notificação no celular: o professor abre o Quitô e vê no painel quem cobrar hoje. Quando a funcionalidade App no celular e notificações chegar, ela só passa a avisar o professor na hora certa.

## O que entra

- Dados de recebimento do professor: chave Pix, nome que aparece para o responsável e um dia de vencimento padrão. Em mês mais curto que o dia escolhido, o vencimento cai no último dia do mês.
- Vencimento por responsável: o professor troca o dia de vencimento de um responsável específico, e vale para todos os irmãos dele.
- Cobrança do mês: depois que o mês acaba, o Quitô cria uma cobrança por responsável com o valor e a conta aberta do fechamento, irmãos juntos numa só. A cobrança guarda o valor do jeito que estava quando ficou pronta.
- Mês pronto para cobrar: se ainda há aula sem marcar que muda o valor, ou aluno sem forma de cobrança, a cobrança daquele responsável não fica pronta e o painel diz o que falta marcar, com o atalho para a tela de aulas.
- Acerto no mês seguinte: se o professor corrige uma aula de um mês já cobrado, a cobrança enviada não muda. A diferença, para mais ou para menos, entra na próxima cobrança do responsável como uma linha explicada ("acerto de novembro: 1 falta remarcada como avisada").
- Modelos de mensagem: três tons gentis já prontos, Próximo (escolhido de partida), Direto e Formal, com os textos da descoberta Tom da mensagem de cobrança. O professor troca o tom e ajusta a saudação, o agradecimento e a assinatura, e os mesmos ajustes valem para todos os responsáveis.
- Mensagem montada: o nome do responsável e dos alunos, o mês, o valor, a conta aberta (aulas, faltas, reposições, descontos e acertos), a chave Pix e o vencimento entram sozinhos no modelo escolhido. A chave Pix fica sozinha numa linha, para o responsável copiar com um toque longo. Para escrever "do Pedro e da Ana", o cadastro do aluno pergunta o gênero: masculino, feminino ou outro. Com outro, o professor escreve como o aluno quer ser chamado, e a mensagem usa "de" antes desse texto.
- Rodapé do Quitô: a mensagem termina com a linha "Conta feita pelo Quitô", ligada de partida, e o professor pode desligar.
- Prévia: o professor vê a mensagem de cada responsável antes de enviar, e na primeira vez passa por ela antes do primeiro envio.
- Envio a partir do dia do vencimento: do dia 1 até o vencimento, o painel mostra a cobrança como "pronta para o dia 5", com a prévia, mas o botão de enviar só aparece no dia do vencimento. Se o professor não enviar no dia, o botão continua no painel até o envio.
- Envio pelo WhatsApp com um toque, sem custo: o toque abre o WhatsApp do professor com a mensagem já escrita para o telefone do responsável, e a cobrança passa a constar como enviada, com a opção de desfazer se ele desistiu.
- Marcar como pago, com um toque no painel. Para os lembretes daquele responsável no mês e pode ser desfeito.
- Lembretes configuráveis: o professor define quantos dias depois do envio da cobrança sai cada lembrete e quantos no máximo, com um modelo de lembrete gentil para cada um. Cobrança enviada com atraso conta a partir do dia em que foi enviada, e nenhum lembrete sai antes do envio. Cada lembrete aparece no painel no dia, com o mesmo toque para o WhatsApp.
- Painel do mês: as cobranças e lembretes de hoje no topo, com o toque para o WhatsApp, as cobranças que ainda não estão prontas e por quê, e abaixo quem já pagou, quem está em aberto e há quantos dias. É a tela que o professor vê ao abrir o app.

## O que fica de fora

- Cobrar adiantado o mês que está começando.
- Enviar a cobrança antes do dia do vencimento.
- Pagamento em parte: a cobrança é paga ou não paga. Se o responsável manda menos, o professor decide quando marcar como pago.
- Mensagem de correção depois de enviada: a diferença vai sempre para o mês seguinte.
- Travar as aulas de um mês já cobrado.
- Receber o pagamento pelo Quitô (boleto, cartão, Pix gerado pelo app).
- Saber sozinho que o Pix caiu, lendo o extrato do banco.
- Saber sozinho que a mensagem saiu do WhatsApp: o Quitô confia no toque do professor.
- Juros, multa e cobrança mais dura.
- Nota fiscal e recibo.
- Cobrança por e-mail ou SMS.
- Texto de mensagem escrito do zero pelo professor.
- Serviços de WhatsApp não oficiais, que imitam o WhatsApp Web, pelo risco de o número do professor ser bloqueado.
- Envio automático pelo WhatsApp oficial, sem o professor tocar em nada. Fica para a v2, no plano pago, e depende do Spike de envio pelo WhatsApp. Já decidido para a v2: o professor escolhe se a mensagem sai em nome dele ou do Quitô ("Olá, aqui é o Quitô, assistente do professor João"), e o texto vem de modelos aprovados antes pela Meta, sem texto totalmente livre.
- Planos grátis e pago, com assinatura do professor: nesta versão tudo é grátis.
- A notificação no dia de cobrar, que fica na funcionalidade App no celular e notificações.

## Perguntas em aberto

- Nenhuma por enquanto.

## Como medir

- Dias de atraso em média, do vencimento até o professor marcar como pago. O valor de hoje é o que o professor responde no cadastro, e a meta é cair pela metade depois de três meses de uso.
- Parte das cobranças pagas até o dia do vencimento. A meta inicial é 70%.
- Parte das cobranças enviadas no próprio dia do vencimento, que mostra se o painel sem notificação basta. A meta inicial é 60%.

## Descobertas e Spikes
<!-- virgilio:items -->
- Spike: [Envio automático pelo WhatsApp](../spikes/envio-pelo-whatsapp.md)
- Descoberta: [Tom da mensagem de cobrança](../findings/tom-da-mensagem.md)
<!-- virgilio:items-end -->
