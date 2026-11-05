# Notificação em celular de verdade
<!-- virgilio:spike feature=app-no-celular -->

## A pergunta

No app instalado, a notificação chega no horário, o toque abre o painel do dia, o WhatsApp abre com a mensagem pronta e o professor continua conectado? Quanto custa manter o disparo diário rodando?

## Por que importa

O Quitô ainda nunca foi instalado num celular: não há ícone, nem instalação, nem notificação no código. A Autenticação promete o Entrar com Google dentro do app instalado no iPhone, o que só pode ser visto depois que a instalação existir e o Google estiver ligado. E entre o cadastro e a primeira cobrança passam até dois meses, tempo em que a inscrição pode se perder sem o professor saber.

## Onde testar

- **Simulador do iPhone, no computador do dono:** serve para a instalação pelo Safari, o login dentro do app instalado e as capturas de tela do guia. Não tem WhatsApp, porque não tem loja de aplicativos, e pode não receber notificação do Quitô de verdade. O primeiro passo é confirmar isso.
- **Celular Android do dono:** serve para o caminho inteiro, do aviso até o WhatsApp. Precisa alcançar o Quitô por um endereço público com https ou ligado ao computador por cabo, porque o celular não instala a partir de um endereço comum da rede de casa.
- **iPhone de verdade, emprestado:** obrigatório antes de lançar o guia do iPhone se o simulador não mostrar a notificação chegando. Decisão do dono.

## Caminhos a comparar

- **Disparo pelo agendador do Supabase:** roda junto do banco, sem mais um serviço para manter. Falta ver o limite do plano grátis.
- **Disparo por uma tarefa agendada no Railway:** fica junto do app. Falta ver quanto soma na conta.

## Como responder

- Antes de começar, ligar o Entrar com Google, como diz a descoberta Entrar com Google ainda desligado.
- Montar uma versão mínima, que instala e manda uma notificação de teste.
- No Android: testar instalação, permissão, notificação com o app fechado, toque até o painel e abertura do WhatsApp.
- No simulador: testar a instalação, o Entrar com Google e o código por e-mail dentro do app instalado, e ver até onde a notificação vai.
- Deixar o Android alguns dias sem abrir o app e ver se a notificação ainda chega. Levantar o que se sabe sobre semanas de inatividade.
- Ver a partir de qual versão do iPhone a notificação funciona e o que acontece ao abrir o link dentro do WhatsApp ou do Instagram, que não instalam.
- Confirmar que a notificação em si não pede conta nem cartão, e escolher o caminho do disparo.
- Guardar as capturas de tela de cada passo para os guias de ativação.

## Prazo

Até dois dias, fora os dias de espera do teste de inatividade.
