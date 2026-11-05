# App no celular e notificações
<!-- virgilio:feature stage=open -->

## O que é

O Quitô vira um app instalável na tela inicial do celular (PWA, um site que se instala e abre como app, sem passar pela loja) e manda notificações ao professor. A primeira notificação é a do dia de cobrar: um toque abre o painel do dia e, de lá, o WhatsApp com a mensagem pronta. Como instalar e liberar as notificações não é óbvio, sobretudo no iPhone, o Quitô guia o professor passo a passo até a primeira notificação de teste chegar. Esta funcionalidade começa depois da Cobrança, porque antes dela não há o que notificar.

## O que entra

- Cara do app: ícone simples com a letra Q e as cores do Quitô, propostos pelo agente e aprovados pelo dono, e o nome Quitô no lugar de "quito".
- App instalável: o ícone, o nome e as cores na tela inicial, abrindo em tela cheia como um app.
- Inscrição nas notificações: o Quitô pede a permissão na hora certa, guarda a inscrição de cada aparelho do professor e mostra se ela está ativa.
- Horário do aviso: o professor escolhe a hora, só hora cheia, com 9h de partida, no fuso do celular dele.
- Disparo diário: no horário escolhido, inclusive em domingo e feriado, o Quitô avisa quem tem cobrança ou lembrete naquele dia. Na tela bloqueada aparece só a quantidade ("3 cobranças para enviar hoje"), sem nome nem valor. Dia sem nada a fazer não tem notificação.
- Toque na notificação: abre o painel do dia. Se houver só uma cobrança, abre a prévia dela com o botão de enviar.
- Cobrança que não ficou pronta: se falta marcar aula no dia do vencimento, a mesma notificação avisa ("2 cobranças precisam de aula marcada") e o toque leva ao painel.
- Repetição no dia seguinte: se a cobrança não foi enviada no dia, a notificação repete uma única vez no dia seguinte.
- Aviso na véspera da primeira cobrança: uma única notificação, que lembra o professor do dia seguinte e mostra se a inscrição continua valendo depois da espera.
- Guia de ativação para Android, oferecido no fim da sequência dos Primeiros passos e de novo quando a primeira cobrança ficar pronta: passo a passo com imagens para instalar o app e liberar as notificações, terminando numa notificação de teste.
- Guia de ativação para iPhone, nos mesmos dois momentos: passo a passo para adicionar à tela de início pelo Safari, abrir pelo ícone, entrar de novo no app e liberar as notificações, porque no iPhone a notificação só funciona com o app instalado. Se o simulador não mostrar a notificação chegando, este guia só é lançado depois de um teste num iPhone de verdade.
- Guia no computador: quem abre o guia no computador vê um QR code para continuar no celular.
- Aviso de notificação desligada: se a inscrição sumir ou a permissão for negada, o Quitô mostra um alerta no painel e leva o professor de volta ao guia. Sem notificação, o painel com as cobranças do dia, visto ao abrir o app, é o caminho de reserva.
- Registro para medir: o Quitô guarda quando a inscrição está ativa, o tipo de celular e o toque na notificação, para calcular os números de Como medir.

## O que fica de fora

- App nas lojas da Apple e do Google.
- Notificações para o responsável ou para o aluno.
- Outras notificações além das de cobrança, como lembrete diário de marcar as aulas. O aviso de aula sem marcar só sai no dia do vencimento, junto da cobrança.
- E-mail de reserva quando a notificação não estiver ativa, porque o envio de e-mail tem custo e pesaria no plano grátis.
- Abrir o WhatsApp direto pelo toque na notificação, que pularia a prévia e não serve para várias cobranças no mesmo dia.
- Nome do responsável ou valor na tela bloqueada.
- Mais de uma repetição da mesma cobrança.

## Perguntas em aberto

- Se a notificação chega e abre o Quitô num iPhone de verdade. Quem responde é o Spike de notificação em celular de verdade, com um iPhone emprestado se o simulador não confirmar.

## Como medir

- Parte dos professores com a notificação ativa uma semana depois do cadastro. A meta inicial é 70%, olhando iPhone e Android separados.
- Parte dos professores com a notificação ativa no dia da primeira cobrança, que pode vir até dois meses depois do cadastro. A meta inicial é 70%, olhando iPhone e Android separados.
- Parte das notificações do dia de cobrar que viram mensagem enviada no WhatsApp no mesmo dia. A meta inicial é 70%, acima dos 60% que a Cobrança espera só com o painel.

## Descobertas e Spikes
<!-- virgilio:items -->
- Spike: [Notificação em celular de verdade](../spikes/notificacao-em-celular-real.md)
<!-- virgilio:items-end -->
