# Envio automático pelo WhatsApp
<!-- virgilio:spike feature=cobranca -->

## A pergunta

Qual é o jeito mais barato, para o Quitô e para o professor, de a cobrança chegar pelo WhatsApp no dia certo? Dá para ser automático sem ficar caro?

## Por que importa

O canal escolhido é o WhatsApp. A primeira versão usa o envio com um toque, grátis. O envio automático fica para a v2, no plano pago, e tem custo por mensagem e regras da Meta. Este Spike diz quanto ele custa e se cabe no preço do plano.

## Caminhos a comparar

- **Um toque, sem custo:** o Quitô avisa o professor no dia e abre o WhatsApp dele com a mensagem pronta. Não custa nada e não depende da Meta, mas a mensagem sai do número do professor, e ele ainda precisa tocar em enviar.
- **API oficial direto com a Meta (Cloud API):** envio automático de um número do Quitô. Cobrança de pagamento entra na categoria "utilidade", que tende a ser a mais barata. Exige verificar a empresa na Meta e aprovar antes cada modelo de mensagem, com espaços para valor, nome e chave Pix.
- **API oficial por um intermediário (Twilio, Zenvia e parecidos):** mais fácil de começar, mas soma uma taxa por mensagem por cima do preço da Meta.
- **Serviços não oficiais, que imitam o WhatsApp Web:** baratos, mas violam as regras do WhatsApp e podem bloquear o número. Descartados de saída.

## Como responder

- Confirmar na tabela atual da Meta o preço de uma mensagem de utilidade no Brasil e quanto daria por aluno no mês, com vencimento e até dois lembretes.
- Ver quanto tempo leva e o que é preciso para verificar a empresa e aprovar os modelos de mensagem.
- Ver se o modelo aprovado pode mostrar o nome do professor, mesmo saindo do número do Quitô.
- Ver se uma resposta do responsável abre uma janela de conversa grátis, por exemplo para mandar o comprovante.

## Prazo

Até dois dias.
