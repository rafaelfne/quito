# O código de entrada chega no e-mail real em produção

Este é o passo a passo para o dono seguir ao criar o projeto Supabase de produção. Ele garante que o professor que digita o e-mail no Quitô recebe o código de 6 números, com a cara do Quitô, em menos de um minuto.

Por que existe: o envio pela Resend, o assunto e o modelo do e-mail estão só na configuração do ensaio (`supabase/config.toml` e `supabase/templates/codigo-de-entrada.html`), e nela o envio está desligado, porque no ensaio o e-mail cai na caixa de E-mails de teste. A publicação automática leva para produção apenas as mudanças de banco. Tudo o que está aqui é feito à mão, no painel, uma vez. Nada disto roda a partir do computador nem passa pelo repositório.

Regra de ouro: nenhuma senha, chave ou token é escrita em arquivo do projeto, nem neste documento. Cada valor é colado direto no painel que pede, e só lá.

## Antes de começar

Você vai precisar de:

- A conta do Supabase com o projeto de produção criado.
- Uma conta na Resend (resend.com). O plano grátis manda até 3.000 e-mails por mês e 100 por dia, o que dá folga para o começo do Quitô.
- Um domínio seu (por exemplo, o do site do Quitô) e acesso ao painel onde ele foi registrado, para colar registros de DNS. Sem domínio verificado, a Resend só entrega e-mail para o seu próprio endereço.
- Um e-mail real que não seja o da sua conta Supabase, para o teste do fim.

Leve uns 40 minutos, mais o tempo de o DNS propagar (de alguns minutos a algumas horas).

## Passo 1. Verificar o domínio na Resend

Onde: painel da Resend, menu **Domains**, botão **Add Domain**.

1. Digite o domínio que vai assinar o e-mail. Uma boa escolha é um subdomínio só para envio, como `mail.seudominio.com.br`: se um dia a reputação de envio cair, o site não é afetado.
2. Escolha a região mais perto do Brasil que a Resend oferecer.
3. A Resend mostra alguns registros de DNS (tipo TXT e MX, com nomes como `resend._domainkey`). Copie cada um e cole no painel do seu domínio, exatamente como está.
4. Volte à Resend e clique em **Verify**. Espere até todos os registros ficarem verdes, com o status **Verified**.

De onde vem cada valor: todos os registros vêm da própria tela da Resend. Nada é inventado.

## Passo 2. Definir o remetente

O remetente é o endereço que aparece como "de" no e-mail do professor. Ele precisa estar no domínio verificado no passo 1.

Escolha e anote (não é segredo):

- **Endereço:** algo como `entrar@mail.seudominio.com.br`. É o mesmo papel do campo `QUITO_EMAIL_FROM` do `.env.example`; em produção ele é digitado direto no painel do Supabase, não em variável.
- **Nome:** `Quitô`, igual ao `sender_name` da configuração do ensaio. É o que o professor vê na caixa de entrada.

Esse endereço não precisa existir como caixa postal. Se quiser que respostas cheguem a você, configure um encaminhamento no painel do domínio depois.

## Passo 3. Criar a chave de envio na Resend

Onde: painel da Resend, menu **API Keys**, botão **Create API Key**.

1. Nome: `quito-producao`, para você reconhecer depois.
2. Permissão: **Sending access** (só enviar). Não dê acesso total.
3. Domínio: restrinja ao domínio do passo 1.
4. Clique em criar. A Resend mostra a chave **uma única vez**.

Deixe essa tela aberta e vá direto ao passo 4 para colar a chave no Supabase. Não a mande por mensagem, não a guarde em arquivo e não a cole no `.env.local`. Se perder, apague essa chave na Resend e crie outra.

## Passo 4. Ligar o envio pela Resend no Supabase

Onde: painel do Supabase, projeto de produção, menu **Authentication**, seção **Emails**, aba **SMTP Settings**.

1. Ligue **Enable Custom SMTP**.
2. Preencha:

| Campo | Valor | De onde vem |
| --- | --- | --- |
| Sender email | o endereço do passo 2 | sua escolha, no domínio verificado |
| Sender name | `Quitô` | igual ao ensaio |
| Host | `smtp.resend.com` | igual ao ensaio |
| Port number | `465` | igual ao ensaio |
| Username | `resend` | igual ao ensaio |
| Password | a chave do passo 3 | colada da tela da Resend, só aqui |

3. Salve.

Agora o Supabase de produção manda e-mail pela Resend, com o mesmo caminho que a configuração do ensaio descreve na seção `[auth.email.smtp]`, só que ligado.

## Passo 5. Conferir o código de 6 números e a validade de 10 minutos

Onde: painel do Supabase, menu **Authentication**, seção **Sign In / Providers**, provedor **Email**.

1. **Enable Email provider**: ligado.
2. **Confirm email**: desligado. O Quitô cria a conta no mesmo passo em que o professor digita o código; não existe tela de confirmação separada. Isso espelha o `enable_confirmations = false` do ensaio.
3. **Email OTP Length**: `6`. É o que o app espera (`codeLength` em `lib/sign-in.ts`) e o que o texto do e-mail promete.
4. **Email OTP Expiration**: `600` segundos, que são os 10 minutos que o e-mail promete. O padrão do Supabase é 1 hora; não deixe o padrão.
5. Salve.

Se o comprimento ou a validade ficarem diferentes do que está escrito no e-mail, o professor lê uma coisa e vive outra.

## Passo 6. Colar o assunto e o modelo do e-mail do Quitô

Onde: painel do Supabase, menu **Authentication**, seção **Emails**, aba **Templates**.

O Quitô usa dois modelos do Supabase, e os dois recebem o mesmo conteúdo, porque o professor novo e o professor que já tem conta precisam ver o mesmo e-mail:

- **Magic Link**: usado quando o e-mail já tem conta.
- **Confirm sign up**: usado na primeira entrada daquele e-mail.

Em cada um dos dois:

1. **Subject heading**: `Seu código para entrar no Quitô`
2. **Message body**: apague o que estiver lá e cole o conteúdo inteiro do arquivo `supabase/templates/codigo-de-entrada.html` do repositório, do `<!doctype html>` até o `</html>`.
3. Confira que o corpo tem o trecho `{{ .Token }}`. É ele que vira o código de 6 números. Sem ele, o professor recebe um e-mail bonito e vazio.
4. Salve.

Se o modelo mudar no repositório, repita este passo. Ele não vai sozinho para produção.

## Passo 7. Conferir o limite de envios por hora

Onde: painel do Supabase, menu **Authentication**, seção **Rate Limits**.

1. **Rate limit for sending emails**: `30` por hora, igual ao `email_sent = 30` do ensaio. Esse campo só fica editável depois do passo 4.
2. Deixe os demais limites como estão.

O que esse número significa: o Supabase manda no máximo 30 e-mails de código por hora para o app inteiro, somando todos os professores. Quando passa, o app mostra "Já enviamos alguns códigos agora há pouco. Espere um minutinho e peça de novo." Para o começo, 30 basta. Se vários professores começarem a entrar na mesma hora e esse aviso aparecer, volte aqui e suba o número; o teto real passa a ser o limite diário da Resend.

## Passo 8. O teste que diz que ficou pronto

Faça com um e-mail real, de preferência num celular, do jeito que o professor faria.

1. Abra o Quitô em produção e digite o e-mail.
2. Marque o relógio. O e-mail precisa chegar em menos de um minuto.
3. Confira na caixa de entrada:
   - remetente: `Quitô`, no endereço do passo 2;
   - assunto: `Seu código para entrar no Quitô`;
   - um código de 6 números em destaque;
   - o texto "O código vale por 10 minutos" e o rodapé "Você dá a aula. O Quitô cuida da cobrança.";
   - nenhum texto em inglês, nenhum link para clicar.
4. Volte ao app, digite o código e confira que entrou.
5. Peça um código de novo, espere 11 minutos e tente usar. O app precisa recusar com "Código errado ou vencido".
6. No painel da Resend, menu **Emails**, confira que os envios aparecem como **Delivered**.

Se tudo isso aconteceu, a entrada por e-mail está pronta em produção.

## Se der problema

- **O e-mail não chega.** Olhe a caixa de spam. Depois, no painel da Resend, menu **Emails**: se o envio não está lá, o problema é entre Supabase e Resend (reveja a senha do passo 4, que é a chave do passo 3). Se está lá como **Bounced** ou **Complained**, o problema é o domínio ou o endereço de destino.
- **O e-mail chega em inglês, com um link.** O passo 6 não pegou nos dois modelos. Refaça nos dois.
- **O e-mail chega sem código.** Falta o `{{ .Token }}` no corpo. Refaça o passo 6.
- **O app diz que o código tem 6 números e o e-mail traz outro tamanho.** Reveja o passo 5.
- **"Já enviamos alguns códigos agora há pouco" logo no teste.** O passo 7 ficou com um número baixo demais, ou o passo 4 não salvou e o limite voltou ao padrão sem envio próprio.

Nada aqui se resolve mexendo no código do app. Se o problema persistir depois de rever os passos, rode `virgilio diagnose`.
