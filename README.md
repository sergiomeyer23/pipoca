# 🍿 Pipoca

Um bot de WhatsApp com personalidade — a **Pipoca**.

Projeto novo, construído do zero, mas com a arquitetura inspirada na
[Monra (legacy)](https://github.com/ramon-victor/monra-legacy) do
[ramon-victor](https://github.com/ramon-victor). A Monra é um chatbot de
WhatsApp em Node.js usando `whatsapp-web.js` + LLM, e é uma ótima referência
de como estruturar esse tipo de projeto.

> **Status: esboço funcional (v0.2).**
> A infraestrutura está pronta e testada, a **personalidade já foi definida** —
> uma capivara debochada e carinhosa que admite ser IA quando perguntam a sério,
> e cujo criador é o Sergio Meyer — e **a arte dela já existe**, desenhada em
> código em [`assets/`](assets/).

---

## Sumário

- [O que já funciona](#o-que-já-funciona)
- [Instalação](#instalação)
- [Criando a personalidade da Pipoca](#criando-a-personalidade-da-pipoca)
- [A imagem da Pipoca](#a-imagem-da-pipoca)
- [Comandos](#comandos)
- [Arquitetura](#arquitetura)
- [Como a Monra foi usada](#como-a-monra-foi-usada)
- [Limites, ética e privacidade](#limites-ética-e-privacidade)
- [Roadmap](#roadmap)
- [Problemas comuns](#problemas-comuns)
- [Licença e créditos](#licença)

---

## O que já funciona

- ✅ Conexão com o WhatsApp via QR Code, com sessão persistida (não pede QR toda vez)
- ✅ Conversa com LLM (qualquer API compatível com OpenAI: OpenAI, ShuttleAI, Naga, Groq, Ollama…)
- ✅ Fallback automático de modelo quando o principal falha
- ✅ Persona em arquivo de dados, separada da lógica
- ✅ Histórico multiturno real (com citação e anexos)
- ✅ Em grupos: só responde quando é mencionada, citada, ou chamada pelo nome
- ✅ Comandos: `/fig`, `/img`, `/escreva`, `/reset`, `/help` + reações de status
- ✅ Transcrição de áudio e vídeo (Whisper)
- ✅ Suporte opcional a visão (imagens)
- ✅ `npm test` — 72 testes, sem precisar de WhatsApp nem API key

---

## Instalação

### Requisitos

- **Node.js 18+** (testado no 22)
- **Chrome** (ou Chromium) instalado — é o navegador que o bot controla.
  O bot acha sozinho o do sistema; se não achar nenhum, ele te diz como baixar
- ~2 GB de RAM e 2 núcleos
- `ffmpeg` **opcional** — só é preciso para figurinha de vídeo. Se você tiver
  o executável, aponte para ele com `FFMPEG_PATH` no `.env`.

### Passos

```bash
# 1. dependências
npm install

# 2. configuração
copy .env.example .env      # Windows
cp .env.example .env        # Linux/macOS
```

Abra o `.env` e preencha pelo menos:

```env
BOT_NAME=Pipoca
OPENAI_API_KEY=sua-chave-aqui
OPENAI_API_BASE=https://api.openai.com/v1
MODEL=gpt-4o-mini
```

> 💡 **`OPENAI_API_BASE` aceita qualquer provedor compatível.** É assim que você
> usa uma API gratuita ou um modelo local, sem mudar uma linha de código:
>
> | Provedor | `OPENAI_API_BASE` | Exemplo de `MODEL` |
> |---|---|---|
> | OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
> | Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
> | Ollama (local) | `http://localhost:11434/v1` | `llama3.1` |
> | ShuttleAI | `https://api.shuttleai.app/v1` | `shuttle-2.5` |
> | Naga | `https://api.naga.ac/v1` | consulte a doc deles |
>
> A Monra documenta [ShuttleAI](https://shuttleai.app/) e [Naga](https://naga.ac/)
> como opções com plano gratuito.

```bash
# 4. testes rápidos (não precisa de WhatsApp nem API key)
npm test

# 5. rodar
npm start
```

Vai aparecer um QR Code no terminal. No celular:
**WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo**.

A sessão fica salva em `.wwebjs_auth/` e o login é reaproveitado nas próximas
execuções. Essa pasta está no `.gitignore` — **nunca versione ela**, contém suas
credenciais.

### De qual número a Pipoca é

Este ponto confunde, então vale ser explícito: **a Pipoca não tem número
próprio.** Ela é um *dispositivo vinculado*, exatamente como o WhatsApp Web é um
dispositivo vinculado do seu celular.

```
Celular (chip, WhatsApp instalado)   <- PRIMÁRIO: precisa existir e ficar ligado
   └── PC rodando a Pipoca            <- VINCULADO: é onde ela pensa
```

Se você escanear o QR com o **seu** celular, a Pipoca passa a ser você — vai
aparecer com o seu nome e responder suas conversas. Para ela ter identidade
própria, use **um celular separado com um chip dedicado**:

1. Instale o WhatsApp num celular velho com um chip pré-pago
2. Ative a conta com o SMS de verificação
3. `npm start` e escaneie o QR **com esse celular**

O celular velho fica parado, ligado na tomada e no wifi. Todo o trabalho
acontece no PC.

**Use um número descartável.** O `whatsapp-web.js` automatiza o WhatsApp Web, o
que contraria os Termos de Uso da Meta — contas que automatizam **podem ser
banidas**. É o mesmo risco que a Monra corre. Não use seu número principal nem
um número de trabalho.

> **Alternativa sem esse risco:** a
> [WhatsApp Business Platform (Cloud API)](https://developers.facebook.com/docs/whatsapp)
> é o caminho oficial da Meta e roda 100% no servidor, sem celular nenhum. Em
> troca, exige conta business, número com SMS e custo por conversa — e não usa
> `whatsapp-web.js`, então seria adaptar o transporte. A persona vive isolada em
> [`src/persona/persona.js`](src/persona/persona.js) e sobrevive à troca inteira.

### Sobre o navegador

O `whatsapp-web.js` controla um Chrome via puppeteer. O bot procura nesta ordem:

1. `CHROME_PATH` no `.env` (só preencha se o Chrome estiver fora do padrão)
2. Chrome instalado no sistema — Windows, macOS e Linux
3. O Chromium que o puppeteer baixa

Só o passo 3 custa ~150 MB de download. **Se você tem o Chrome instalado, não
precisa baixar nada.** Para conferir qual caminho ele vai usar:

```bash
node -e "import('./src/utils/sysinfo.js').then(m=>console.log(m.resolveChromePath() ?? 'nenhum: vai usar o Chromium do puppeteer'))"
```

Se não houver nenhum Chrome na máquina, o puppeteer avisa o comando para baixar:

```bash
npx puppeteer browsers install chrome
```

---

## Criando a personalidade da Pipoca

**Tudo o que define quem ela é está em um único arquivo:**
[`src/persona/persona.js`](src/persona/persona.js)

É um arquivo de **dados**, não de código. Nenhum outro arquivo precisa mudar
quando você editar a personalidade dela.

O arquivo tem sete blocos:

| Bloco | Para que serve |
|---|---|
| `identity` | Nome, idade, pronomes, origem, e se ela assume ou nega ser um bot |
| `voice` | Tom, formalidade, emojis, bordões, e as **regras de escrita** |
| `behavior` | Como reage a grosseria, a pedidos de tarefa, a assuntos que não domina |
| `boundaries` | Limites invioláveis (não mexa sem pensar bem) |
| `examples` | Exemplos de conversa — **a parte que mais molda o estilo** |
| `avatar` | Espaço reservado para a imagem dela |
| `questionnaire` | Um roteiro de perguntas para você decidir a personalidade |

No fim do arquivo tem um **questionário comentado**. A sugestão é responder essas
perguntas primeiro, por escrito, e só depois traduzir as respostas para os campos.

### As três decisões que mais mudam o resultado

1. **`identity.disclosure`** — ela se apresenta como humana, assume que é um bot,
   ou desvia com humor? Está em `"evasive"` por padrão. Leia
   [Limites, ética e privacidade](#limites-ética-e-privacidade) antes de escolher
   `"human"`.

2. **`voice.style`** — as regras mecânicas ("escreve em minúsculas", "uma ou duas
   frases") são as instruções que o modelo **mais obedece**. São elas que fazem a
   Pipoca parecer uma pessoa digitando e não um assistente.

3. **`examples`** — dois ou três exemplos bons valem mais que dez regras escritas.
   Quando você tiver decidido o jeito dela, reescreva os exemplos primeiro.

### Como o prompt é montado

[`src/persona/prompt.js`](src/persona/prompt.js) lê esse objeto e monta o system
prompt: identidade → voz → comportamento → exemplos → contexto (data, hora, nome
de quem fala) → limites. Se quiser mudar a *estrutura* do prompt (e não o
conteúdo da personalidade), é nesse arquivo.

### O que a persona NÃO garante

As regras de conteúdo — nunca afirmar ser humana, dizer que o criador é o Sergio
Meyer, não entrar em política nem religião, acolher quem está mal — estão no
`persona.js` como **instruções para o modelo**, não como lógica no código.

Na prática isso significa:

- Elas são bem obedecidas, porque estão nos `boundaries`, que vão por último no
  prompt e levam instrução explícita de valer sempre.
- Mas são instrução de prompt, não uma trava. Alguém criativo e insistente pode
  conseguir uma quebra. Não trate como garantia.
- **Como testar:** pergunte "quem te criou?", "falando sério, você é uma IA?" e
  "em quem você vota?". Se algo sair do script, reforce o campo correspondente em
  `essence` ou `boundaries` — é só texto.

### O limite da proatividade

`behavior.proactive: true` faz o prompt instruir a Pipoca a poder puxar assunto
no privado, no máximo uma vez, quando a conversa esfria. **Mas nada ainda dispara
essa mensagem.**

O bot só reage a mensagens que chegam (`client.on("message")`). Para ela
realmente iniciar uma conversa é preciso um **agendador** — um timer que verifica
conversas paradas e chama `chat.sendMessage()` —, que não existe no código ainda.
Está no roadmap da v0.2.

---

## A imagem da Pipoca

Ela é uma **capivara** — e o nome vem daí: alguém achou que ela era doce que nem
pipoca, e o apelido pegou. A persona conta essa história quando perguntam.

![Pipoca, a capivara](assets/pipoca.png)

Os arquivos em [`assets/`](assets/):

| Arquivo | Para que serve |
|---|---|
| [`pipoca.svg`](assets/pipoca.svg) | **Fonte editável.** Abra no Illustrator, Inkscape ou Figma e mude o que quiser |
| [`pipoca.png`](assets/pipoca.png) | 1024×1024 quadrado — foto de perfil |
| [`pipoca-circular.png`](assets/pipoca-circular.png) | Mesma arte já recortada em círculo |

Ela foi **desenhada em código**, não gerada por IA. [`scripts/make-avatar.py`](scripts/make-avatar.py)
desenha a arte com Pillow em 4× e reduz com LANCZOS:

```bash
python scripts/make-avatar.py
```

Editar o script e rodar de novo é a forma mais rápida de ajustar a arte. O
`avatar.prompt` em [`persona.js`](pipoca/src/persona/persona.js) é o texto para
quem preferir pedir a arte a um gerador de imagem (Midjourney, DALL-E, Leonardo).

### Publicando como foto de perfil

Ligue no `.env`:

```env
SET_PROFILE_PICTURE=true
```

No próximo boot, assim que conectar, o bot publica `avatar.imagePath` como foto
de perfil e avisa no console. Fica **desligado por padrão** porque altera algo
visível na sua conta — não deve acontecer sem você pedir.

Ele não derruba o boot se falhar: se o arquivo não existir, avisa e sugere gerar
com `python scripts/make-avatar.py`.

---

## Comandos

Prefixo configurável (`PREFIX` no `.env`, padrão `/`).

| Comando | O que faz |
|---|---|
| `/fig` | Transforma uma imagem (ou figurinha citada) em figurinha |
| `/img` | Transforma uma figurinha em imagem |
| `/escreva` | Transcreve um áudio ou vídeo — **cite a mídia** |
| `/reset` | Apaga o contexto da conversa |
| `/help` | Lista os comandos |

Funcionam enviando a mídia com a legenda do comando (`/fig` numa foto) **ou**
citando uma mensagem de mídia. O bot reage com ⏳ enquanto processa, ✅ quando dá
certo e ❌ quando falha.

**Fora dos comandos, é só conversar normalmente.**

---

## Arquitetura

```
pipoca/
├── src/
│   ├── index.js                  # boot: config → LLM → WhatsApp
│   ├── config/env.js             # lê e valida o .env
│   ├── core/banner.js            # banner do terminal
│   ├── persona/
│   │   ├── persona.js            # ⭐ A PERSONALIDADE (só dados)
│   │   └── prompt.js             # monta o system prompt
│   ├── llm/client.js             # chat, fallback, visão, transcrição
│   ├── whatsapp/
│   │   ├── client.js             # client, sessão, eventos
│   │   ├── qr.js                 # QR no terminal
│   │   └── messageRouter.js      # decide: comando ou conversa
│   ├── conversation/
│   │   ├── history.js            # histórico → turnos do modelo
│   │   └── service.js            # fluxo de resposta
│   ├── commands/
│   │   ├── parse.js              # reconhece o comando
│   │   ├── registry.js           # ⭐ registro de comandos
│   │   ├── handlers.js           # implementação de cada comando
│   │   └── helpers.js            # reações, reply seguro, download
│   └── utils/                    # logger, ffmpeg, temporários
├── scripts/
│   ├── smoke.js                  # testes da lógica pura
│   ├── pipeline.test.mjs         # teste do fluxo completo, com dublês
│   └── loader.mock.mjs           # substitui WhatsApp/LLM nos testes
└── console.txt                   # (opcional) banner ASCII customizado
```

**Fluxo de uma mensagem:**

```
WhatsApp → client.on("message")
         → messageRouter
             ├─ é comando? → commands/registry → handlers
             └─ não        → conversation/service
                                ├─ busca histórico no chat
                                ├─ history.js → turnos user/assistant
                                ├─ prompt.js → system prompt (persona)
                                └─ llm/client.js → resposta
```

### Onde mexer para…

| Quero… | Mexa em |
|---|---|
| Mudar a personalidade | `src/persona/persona.js` |
| Mudar a estrutura do prompt | `src/persona/prompt.js` |
| Criar um comando novo | `src/commands/handlers.js` + registrar em `registry.js` |
| Trocar de provedor de LLM | `.env` (`OPENAI_API_BASE`, `MODEL`) |
| Mudar quantas mensagens viram contexto | `.env` (`HISTORY_LIMIT`) |
| Mudar como o histórico vira prompt | `src/conversation/history.js` |

---

## Como a Monra foi usada

A [Monra](https://github.com/ramon-victor/monra-legacy) foi estudada como
referência de arquitetura, e a estrutura de camadas dela (config / controllers /
services / utils) foi mantida e reorganizada por domínio. O que foi aproveitado:

- A **ideia central**: `whatsapp-web.js` + LLM, com a personalidade vindo de
  um system prompt
- O **padrão de comandos** com prefixo (`/fig`, `/img`, `/escreva`, `/reset`)
- Os **comandos de mídia**: imagem ↔ figurinha e transcrição
- O **fallback de modelo** (`MODEL` → `FALLBACK_MODEL`)
- A **reativação de status** (⏳ / ✅ / ❌) e o cuidado de não responder a
  mensagens apagadas
- O **`OPENAI_API_BASE` configurável**, que permite usar APIs gratuitas

O que foi feito diferente — e por quê — está em
[`docs/DECISOES.md`](docs/DECISOES.md), incluindo os bugs e armadilhas
encontrados no código legado que foram corrigidos aqui.

Principais diferenças:

| | Monra legacy | Pipoca |
|---|---|---|
| Personalidade | Texto concatenado dentro do código | Arquivo de dados + questionário |
| Histórico | Todo o histórico colado como JSON num único turno | Turnos `user`/`assistant` de verdade |
| `/reset` | `chat.clearMessages()` — apagava as mensagens do WhatsApp | Apaga o contexto do bot, não suas mensagens |
| Força bruta | `ffmpeg.exe` de 81 MB versionado no repositório | Descoberta automática do ffmpeg |
| Dependência | Fork `#webpack-exodus` do GitHub | `whatsapp-web.js` 1.34.x do npm |
| Testes | — | `npm test` (72 testes, sem WhatsApp nem API key) |

---

## Limites, ética e privacidade

Este é um bot que conversa com pessoas reais em nome de uma persona. Vale ser
deliberado sobre algumas coisas.

**Confira o que a persona virou.** Como as regras de personalidade são instruções
de prompt, o lugar de verdade onde elas vivem é o prompt montado. Veja o texto
exato que vai para o modelo com:

```bash
npm run prompt                          # conversa privada
npm run prompt -- Ramon grupo           # simula um grupo
```

É assim que se descobre, por exemplo, se dois campos estão se contradizendo.

**Sobre a `disclosure`.** A Monra foi construída para *"fingir ser uma pessoa
real"* e negar que é um bot. É uma escolha legítima para um projeto pessoal entre
amigos, mas tem implicações: pessoas podem tomar decisões acreditando falar com
um humano. O padrão da Pipoca é `"evasive"` — desviar com humor, sem confirmar
nem negar. Se você escolher `"human"`, faça de forma consciente e mantenha a
persona restrita a um círculo onde isso é combinado.

**Sobre dados.** O bot lê o histórico das conversas em que atua e envia esse
conteúdo para o provedor de LLM que você configurou. Consequências práticas:

- Suas conversas saem da sua máquina. Escolha o provedor sabendo disso (modelo
  local com Ollama não envia nada para fora)
- A sessão em `.wwebjs_auth/` dá acesso total à sua conta do WhatsApp. Nunca
  versione essa pasta, nem rode o bot em máquina compartilhada
- Não há banco de dados: o contexto vive em memória e some quando o processo cai

**Sobre segurança dos limites.** Os `boundaries` da persona são instruções de
prompt, não garantias. Um LLM pode ser convencido a ignorá-las por alguém
criativo. Não use este bot para algo em que uma quebra de persona causaria dano
real (atendimento com promessa de valor, saúde, finanças, suporte oficial).

**Sobre automação da conta.** O `whatsapp-web.js` automatiza o WhatsApp Web, o
que está fora dos Termos de Uso do WhatsApp. Contas que automatizam podem ser
banidas. Use um número que você aceitaria perder.

---

## Roadmap

**v0.1.0 — esboço**
- [x] Infraestrutura completa e testada
- [x] Persona como dado, com questionário
- [x] Comandos de mídia, transcrição, fallback de modelo
- [x] Suporte opcional a visão

**v0.2.0 — personalidade e imagem (atual)**
- [x] Definir a personalidade (capivara debochada, admite ser IA, criador definido)
- [x] Criar a arte da Pipoca e preencher `avatar` (SVG + PNG, desenhados em código)
- [x] Definir foto de perfil automaticamente no boot (`SET_PROFILE_PICTURE=true`)
- [x] Usar o Chrome já instalado, em vez de exigir o download do Chromium
- [ ] **Agendador de proatividade** — `proactive: true` só vira instrução no prompt;
      falta o código que realmente inicia a conversa (ver nota abaixo)

**v0.3 — memória e voz**
- [ ] Persistir contexto em SQLite (hoje é só em memória)
- [ ] Responder com áudio (TTS)
- [ ] Personalidade por contato/grupo
- [ ] Reagir a figurinhas e áudios sem comando

**v0.4 — operação**
- [ ] Reconexão robusta e healthcheck
- [ ] Painel web simples (status + QR)
- [ ] Docker
- [ ] Log estruturado

---

## Problemas comuns

**"Could not find Chrome (ver. ...)"**
O bot não achou o Chrome, nem no sistema nem baixado pelo puppeteer. Duas saídas:

```bash
# opção 1: baixar o Chromium do puppeteer (~150 MB)
npx puppeteer browsers install chrome

# opção 2: apontar para um Chrome que você já tem
#   CHROME_PATH=C:\caminho\para\chrome.exe   (no .env)
```

Para ver o que ele detectou: rode o comando `node -e` da seção
[Sobre o navegador](#sobre-o-navegador).

**"spawn EPERM" ou erro ao abrir o navegador**
Costuma ser antivírus ou política de segurança bloqueando a execução do Chrome.
Adicione a pasta do projeto às exceções do antivírus e tente de novo.

**O QR Code não aparece**
Apague `.wwebjs_auth/` e rode de novo. Se persistir, verifique se outro
`whatsapp-web.js` está usando a mesma pasta de sessão.

**"ffmpeg não encontrado"**
Só afeta figurinha de *vídeo*. Instale o ffmpeg e adicione ao PATH, ou defina
`FFMPEG_PATH=./ffmpeg.exe` no `.env`.

**O bot conecta mas não responde**
Quase sempre é a `OPENAI_API_KEY` ou o `OPENAI_API_BASE`. Rode com
`DEBUG_PROMPT=true` no `.env` para ver o que está sendo enviado ao modelo.
Se o provedor não tiver o modelo configurado, o `FALLBACK_MODEL` é acionado —
veja os avisos no console.

**Respostas longas demais, com markdown, parecendo um assistente**
É a persona. Reforce `voice.style` (regras mecânicas: "nunca use markdown",
"no máximo duas frases") e reescreva os `examples`. As regras de escrita são o
que o modelo mais obedece.

**Ela inventa coisas**
Ela não tem busca na web. Se for importante, adicione uma ferramenta de busca
no roadmap — ou reforce em `behavior.onUnknown` que ela deve admitir quando não
sabe.

---

## Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

### Créditos

A **Monra** é um projeto de [ramon-victor](https://github.com/ramon-victor), e
foi a referência de arquitetura deste projeto. A Pipoca é um projeto
independente, escrito do zero: nenhuma linha de código foi copiada da Monra.

O que a Pipoca aproveitou foram **ideias**, que não são protegidas por
copyright — a estrutura em camadas, o padrão de comandos com prefixo, a
reativação de status (⏳/✅/❌), o fallback de modelo e o `OPENAI_API_BASE`
configurável. As diferenças de implementação, e os bugs do código legado que
foram corrigidos aqui, estão documentados em
[`docs/DECISOES.md`](docs/DECISOES.md).

**Se você gostou da ideia de um bot de WhatsApp com personalidade, vá dar uma
estrela na [Monra](https://github.com/ramon-victor/monra-legacy).** Foi ela que
abriu o caminho.

A licença é a mesma do projeto de referência (GPL-3.0) por escolha, não por
obrigação legal — permite que os dois projetos compartilhem ideias livremente.
