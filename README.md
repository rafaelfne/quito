# quito

Este é o seu app, criado pelo Virgílio com a rede de segurança já no lugar.

## O que já vem pronto

- Entrada sem senha: o professor digita o e-mail e recebe um código de 6 números, pelo Supabase. O e-mail sai pela Resend com a cara do Quitô (modelo em `supabase/templates/codigo-de-entrada.html`).
- Uma tabela de exemplo, `notes`, em que cada pessoa só vê o que é dela.
- Dois bancos: um de ensaio, que o seu computador usa, e um de produção,
  que os seus usuários usam.
- Mudanças no banco entram por arquivos em `supabase/migrations`, nunca
  direto no painel.

## No dia a dia

- `npm run dev` abre o app no seu computador, ligado ao banco de ensaio.
- Toda mudança vai para o GitHub por pedido de mudança (PR); o Railway
  publica sozinho quando entra em `main`.
- `virgilio doctor` mostra a saúde do app em português.
- `virgilio diagnose` explica o que quebrou em produção.

As regras para a sua ferramenta de IA estão em `AGENTS.md`.
