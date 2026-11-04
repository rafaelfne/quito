# Entrar com Google ainda desligado
<!-- virgilio:finding feature=autenticacao -->

## O que descobrimos

A Autenticação está marcada como lançada, mas o Entrar com Google nunca foi ligado. O botão já está na tela de entrada, o Google está desligado na configuração do banco e as chaves ainda não existem. Pelo código, quem toca no botão hoje vê a mensagem "Entrar com Google ainda não está ligado" e segue pelo código por e-mail. Nada disso foi visto funcionar.

## O que muda

Para ligar, faltam três coisas:

- O dono cria o cliente OAuth no Google (console.cloud.google.com, Credenciais), com o endereço de retorno do Supabase autorizado, e guarda o identificador e o segredo.
- O Virgílio pede esses dois valores na revisão da sessão. Os nomes SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID e SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET já estão no .env.example.
- Uma tarefa de código troca o Google de desligado para ligado em supabase/config.toml.

Cada ambiente tem o próprio endereço de retorno: o banco de teste neste computador e, quando existir, o Supabase de produção. O Google só aceita endereço público ou o do próprio computador, então testar o Google no Android depende de como o celular alcança o Quitô.

## De onde veio

Conversa com o dono na sessão de descoberta de 04/11/2026, ao planejar o teste em celular de verdade.
