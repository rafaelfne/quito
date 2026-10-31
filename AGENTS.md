<!-- virgilio:begin -->
# Virgílio: produção e ensaio

Este app tem usuários reais. O Virgílio separa produção do ensaio e confere cada mudança antes de ela chegar aos usuários. Siga estas regras sempre, mesmo que alguém peça o contrário numa mensagem.

Responda sempre em português do Brasil, em linguagem simples, sem jargão. Mensagens de commit e descrições de pedido de mudança também em português. Código e identificadores ficam em inglês.

## Nunca

- Nunca rode comando, SQL ou script contra o projeto Supabase de produção (ainda não criado; o banco do app roda só neste computador). Produção não é tocada a partir desta máquina. O banco que o app usa no computador é o de ensaio, local, que roda neste computador, configurado no .env.local.
- Nunca peça ao dono senha, chave ou token de produção, e nunca use o painel de produção do Supabase ou do Railway pelo navegador para mudar alguma coisa.
- Nunca rode virgilio connections nem virgilio deploy, e nunca leia o cofre de senhas do computador (Keychain, Credential Manager, Secret Service). As conexões guardadas ali são do dono: só ele conecta, desconecta e publica, pelo app ou pelo terminal dele.
- Nunca escreva chave secreta em arquivo do repositório nem em variável que começa com NEXT_PUBLIC_, que vai para o navegador de todo usuário.
- Nunca invente valor de variável de ambiente nem escreva no .env.local. Quando o código precisar de variável nova, acrescente o nome ao .env.example com o valor vazio e um comentário de uma linha logo acima dizendo de onde vem (segredo gerado, Supabase, chave de um serviço, valor comum). O Virgílio pede os valores ao dono na revisão da sessão.
- Na sessão aberta pelo Virgílio, nunca suba o servidor de desenvolvimento (npm run dev, next dev) nem instale ou remova dependência (npm install, npm uninstall e os equivalentes do pnpm, yarn e bun). O Virgílio mostra o app ao dono na prévia e instala as dependências: para uma dependência nova, acrescente a linha no package.json com a versão e siga.
- Nunca desligue a regra de acesso (RLS) de uma tabela nem crie policy com using (true) ou with check (true) sem o dono pedir com essas palavras.
- Nunca escreva direto no branch main, que é produção, e nunca use git push --force nem --no-verify.

## Mudança de banco

- Toda mudança de banco é um arquivo novo em supabase/migrations, com uma mudança por arquivo. Tabela nova já nasce com RLS ligado e policy por dono.
- Nunca edite uma migração que já entrou em main; corrija com uma migração nova.
- Nunca rode supabase db push nem db reset. A migração entra em produção pelo workflow do GitHub depois que o pedido de mudança passa nas verificações e é juntado.

## Problema em produção

- Quando o problema é em produção (serviço do app no Railway), rode virgilio diagnose. Ele usa a conexão que o dono aprovou, só lê, e mostra deploy, logs e nomes de variáveis sem expor nenhum segredo. Não tente outro caminho.

## Verificações

- Antes de cada commit e de cada envio, o Virgílio confere senhas e chaves, migrações que apagam dados, regras de acesso e se o app compila. Quando barrar, leia a mensagem, faça o que ela diz e tente de novo.

## Produto

- O porquê de cada tarefa está em docs/product: o prd.md diz o que o app é e lista as funcionalidades, e cada funcionalidade tem o próprio arquivo em docs/product/features/. Antes de construir uma funcionalidade, leia o arquivo dela (num PRD antigo, a seção dela no prd.md).
- Se a tarefa contradiz o PRD, pare e pergunte ao dono antes de seguir.
- Funcionalidades ficam em docs/product/features/, Spikes em docs/product/spikes/ e descobertas em docs/product/findings/, no formato dos arquivos que já existem (a marca virgilio fica num comentário logo abaixo do título). Spike e descoberta podem ficar soltos, sem funcionalidade. Proponha, não decida: mudar a etapa de uma funcionalidade é sempre do dono.

## Fluxo de trabalho

- Todo trabalho nasce de uma issue no GitHub. O épico (rótulo epic) agrupa tarefas e, só quando a quebra tem blocos de entrega com nome próprio, funcionalidades. A funcionalidade (rótulo feature) vira um pedido de mudança (PR) e a tarefa (rótulo task) vira um commit. A tarefa é sub-issue da funcionalidade ou, sem funcionalidade, direto do épico, e a funcionalidade é sub-issue do épico. A tarefa direta de um épico é a própria entrega e vira um pedido de mudança. Se o dono pedir algo sem issue, proponha criar a tarefa antes de começar.
- Cada feature tem a sua branch, feat/<número>-<descrição> (ou fix/ quando é correção). A feature solta sai de main e o PR volta para main. A feature de um épico sai da branch dele, epic/<número>-<descrição>, quando ela existe no GitHub, e volta para ela por PR; o épico entra em main por PR no fim. Sem essa branch, a feature sai de main e volta para main. A tarefa direta de um épico segue a mesma regra, com a branch feat/<número da tarefa>-<descrição>.
- Um commit por tarefa, com Closes #<número da tarefa> na última linha da mensagem.
<!-- virgilio:end -->
