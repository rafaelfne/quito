# Como tirar os números das notificações

Os três números de Como medir, da funcionalidade App no celular e notificações, saem de tabelas que o Quitô já preenche sozinho. Este documento diz de onde vem cada um. As contas são feitas lendo o banco, sem mudar nada.

## O que fica guardado

- `notification_events`: uma linha por professor, tipo de registro, tipo de celular (`android`, `iphone` ou `computer`) e dia, com a hora da última vez que aconteceu naquele dia.
  - `active`: o Quitô conferiu, com o app aberto, que as notificações daquele celular estão ativas. Vale ao abrir a tela Sua conta, o guia, o painel de cobranças e os Primeiros passos, e ao tocar em Ativar as notificações.
  - `inactive`: o Quitô viu as notificações desligadas ou bloqueadas no celular aberto, ou o disparo diário descobriu que a inscrição do aparelho sumiu.
  - `tap`: o professor tocou na notificação do dia de cobrar e abriu o painel.
- `notification_dispatches`: um aviso do dia de cobrar por professor e dia, com quantas cobranças e lembretes ele trazia.
- `first_charge_eves`: o aviso da véspera da primeira cobrança, com quantos aparelhos o receberam.
- `charges.sent_at`: a hora em que o professor tocou para enviar a cobrança pelo WhatsApp.
- `auth.users.created_at`: o dia do cadastro.

## Notificação ativa uma semana depois do cadastro

Para cada professor e tipo de celular, olhe o último registro `active` ou `inactive` com `occurred_at` até sete dias depois do cadastro. Conta como ativo quem tem `active` como último. Separe iPhone e Android pelo campo `device`.

## Notificação ativa no dia da primeira cobrança

O mesmo cálculo, com o dia do vencimento da primeira cobrança (`first_charge_eves.due_date`) no lugar dos sete dias. O campo `reached` de `first_charge_eves` confirma, na véspera, se o aviso chegou a algum aparelho.

## Notificação do dia de cobrar que vira mensagem enviada

Para cada linha de `notification_dispatches` com `charges` maior que zero, veja se alguma cobrança do professor tem `sent_at` no mesmo `day`, no fuso do professor (`notification_settings.time_zone`). Os registros `tap` do mesmo dia mostram quantos chegaram a abrir o painel pela notificação.
