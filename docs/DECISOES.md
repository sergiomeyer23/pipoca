# Decisões técnicas

Registro do que foi decidido ao construir a Pipoca, e — principalmente — **o que
foi encontrado no código da Monra legacy e por que a Pipoca faz diferente**.

Referência: [ramon-victor/monra-legacy](https://github.com/ramon-victor/monra-legacy)

---

## 1. Dependência do WhatsApp

**Monra:** `"whatsapp-web.js": "github:pedroslopez/whatsapp-web.js#webpack-exodus"`

Instala direto do GitHub, num branch específico de um fork. Motivo provável: em
certa época o WhatsApp Web mudou algo e só esse branch funcionava.

**Pipoca:** `"whatsapp-web.js": "^1.34.1"` — o pacote oficial do npm.

**Por quê:** o branch `webpack-exodus` está desatualizado, e instalar de um
branch de fork significa que um `npm install` pode quebrar a qualquer momento
sem aviso. O upstream publicado hoje está em 1.34.7 e continua mantido. A API
que a Monra usa (`Client`, `LocalAuth`, `message.reply`, `downloadMedia`,
`ffmpegPath`) segue compatível — a única mudança de nome relevante é que a opção
de ffmpeg virou `ffmpegPath` (a Monra passava `ffmpeg`). A Pipoca define as duas
chaves por segurança.

---

## 2. `ffmpeg` — o binário de 81 MB

**Monra:** tem um `ffmpeg.exe` de **81 MB** versionado na raiz do repositório, e
ainda declara o pacote npm `"ffmpeg": "^0.0.4"` como dependência.

**Pipoca:** [src/utils/sysinfo.js](src/utils/sysinfo.js) procura o ffmpeg em três
lugares, nesta ordem: `FFMPEG_PATH` do `.env` → binário na raiz do projeto →
`PATH` do sistema. Se não achar, avisa e segue.

**Por quê:**

- O pacote npm `ffmpeg` (v0.0.4) **não é o ffmpeg**. É um wrapper abandonado que
  não instala o binário. Dependência que não faz nada.
- 81 MB no repositório é caro: clonar, versionar e atualizar ficam pesados, e não
  funciona em Linux/macOS — o binário Windows convive com um
  `process.platform === "win32" ? "../../ffmpeg.exe" : "ffmpeg"` no código.
- Descobrir o ffmpeg do sistema é mais simples, e `FFMPEG_PATH` cobre quem tem o
  binário em lugar não padrão.

Vale notar que o caminho relativo da Monra (`"../../ffmpeg.exe"`) é frágil:
depende do diretório de trabalho do processo, não da localização do arquivo.

---

## 3. Dependência faltando no `package.json`

**Monra:** [src/services/chatService.js](https://github.com/ramon-victor/monra-legacy/blob/main/src/services/chatService.js)
faz `import FormData from "form-data";` para montar o multipart da transcrição,
mas **`form-data` não está no `package.json`**. Funciona por acidente, porque é
dependência transitiva de outro pacote — e quebra silenciosamente no dia em que
a árvore mudar.

**Pipoca:** usa `OpenAI.toFile()` do próprio SDK, sem `form-data` nem montagem
manual de multipart à mão.

**Bônus:** o tratamento de erro da Monra nessa função acessa
`error.response.status` sem checar se `error.response` existe. Quando a falha é
de rede (e não HTTP), isso lança um `TypeError` que **substitui o erro real** —
quem depura acaba caçando o problema errado.

---

## 4. O `/reset` apagava as mensagens do usuário

**Monra:**

```js
chat.clearMessages()   // "Clears all messages from the chat"
  .then(() => chat.sendMessage("Resetado ✅"))
```

`chat.clearMessages()` é um método do `whatsapp-web.js` que **apaga as mensagens
da conversa** — para o usuário também. Além disso, é discutível que funcione de
forma confiável no WhatsApp Web atual.

**Pipoca:** `clearHistory(chatId)` limpa o **contexto interno do bot**, e as
mensagens do usuário ficam onde estão.

**Por quê:** quando alguém digita `/reset`, a intenção é "esqueça o que eu
falei", não "apague meu histórico do WhatsApp". Ação destrutiva e irreversível
para o usuário, a partir de um comando de texto, é um risco que não vale a pena.
Também vale lembrar que o histórico nem é a fonte da verdade aqui: a cada
mensagem o bot busca as últimas N do chat. O `/reset` apenas marca aquele ponto
como "começo de conversa nova" no contexto enviado ao modelo.

---

## 5. Histórico: JSON colado vs. turnos de verdade

**Monra:** transforma cada mensagem num objeto JSON, serializa, e cola tudo
dentro de **um único turno de `user`**, tudo junto numa string. O system prompt
tem que explicar, com exemplos longos, que aquele JSON não é a resposta.

**Pipoca:** [src/conversation/history.js](src/conversation/history.js) gera
turnos `user` / `assistant` de verdade, um por mensagem, com a data, o nome do
remetente, a citação e o anexo como metadados do texto.

**Por quê:**

- É o formato nativo do modelo. Multiturno real aproveita o alinhamento de
  instrução, em vez de brigar com ele.
- O formato antigo gasta tokens com chaves e aspas repetidas.
- O system prompt da Monra precisa de um bloco enorme de exemplos
  "não responda assim / responda assim" só para desfazer a confusão que o
  próprio formato criou. Isso desaparece.

---

## 6. Personalidade como dado, não como código

**Monra:** a personalidade é uma string gigante dentro de
`src/services/chatService.js`, construída por concatenação de dezenas de
fragmentos. Ela inclui até o exemplo de conversa, e usa `${process.env.BOT_NAME}`
espalhado ~20 vezes no meio do texto.

Observação: as partes são coladas **sem espaço entre elas** —
`\`...called ${...}.\` + \`You are on WhatsApp\` + ...` — então o texto final sai
com frases emendadas do tipo `"Pipoca.You are on WhatsAppPipoca is a real
person."`. O modelo dá conta, mas não é o que foi planejado.

**Pipoca:** [src/persona/persona.js](src/persona/persona.js) é um objeto de dados
com sete blocos, e [src/persona/prompt.js](src/persona/prompt.js) monta o prompt a
partir dele. O nome nunca é interpolado no texto da persona — vem do `.env` e é
resolvido na hora de montar o prompt.

**Por quê:** você vai reescrever a personalidade várias vezes. Se ela é dado, cada
iteração é editar texto, sem risco de quebrar o código e sem reler 200 linhas de
JavaScript. O arquivo também traz um **questionário** para responder antes.

---

## 7. Fallback de modelo

Mantido, com o mesmo desenho: tenta `MODEL`, e se falhar tenta `FALLBACK_MODEL`.

Melhorias: a mensagem de erro final informa **os dois** erros (o da tentativa
principal e o do fallback), e uma resposta vazia conta como falha — a Monra
aceitaria uma string vazia como resposta bem-sucedida e mandaria mensagem em
branco no WhatsApp.

---

## 8. Detecção de "é pra mim?"

**Monra:** em grupo, responde se foi mencionada, se citaram uma mensagem dela, ou
se o **nome do bot aparece em qualquer lugar do corpo da mensagem**:

```js
if (message.body.toLowerCase().includes(process.env.BOT_NAME.toLowerCase())) return true;
```

**Pipoca:** mantido igual, de propósito, para não mudar o comportamento que você
conhece — mas registrado aqui como ponto de atenção.

**Por quê é arriscado:** é um `includes` cru no texto inteiro. Com um nome de bot
comum, isso responde a conversas que não eram para ela. Se você batizar o bot de
algo curto e comum em português, vai ter falso positivo. Alternativa: exigir
menção real (`mentionedIds`), citação, ou o nome como palavra isolada
(`\bNome\b`).

---

## 9. Modo visão, opcional

A Monra registra que a mensagem tem anexo, mas não manda a imagem para o modelo —
o texto é o único conteúdo. A Pipoca tem `VISION_ENABLED=false` por padrão, e
quando ligado anexa a imagem como `content` multimodal.

Fica **desligado por padrão** porque a maioria dos provedores compatíveis com
OpenAI não aceita imagem, e uma imagem enviada a um modelo só-texto derruba a
chamada inteira. Ligar isso deve ser uma decisão consciente, junto com a escolha
do modelo.

---

## 10. Transcrição de vídeo

O README da Monra anuncia `/escreva` como "Transcreve áudios **e vídeos**", mas o
handler só valida `hasQuotedMsg` e `hasMedia` — não checa o tipo. Um vídeo citado
vai para o endpoint de transcrição como se fosse áudio, e o resultado depende
inteiramente de o provedor aceitar. Convenção do `whatsapp-web.js`: áudio de voz
é `ptt`, áudio é `audio`.

A Pipoca checa o tipo explicitamente e aceita `audio`, `ptt` e `video`. Para
vídeo, avisa que precisa de ffmpeg se ele não estiver disponível, em vez de
falhar de forma obscura.

---

## 11. `message.getQuotedMessage()` sem checar

**Monra**, em `handleStickerToImage`:

```js
const quotedMsg = await message.getQuotedMessage();   // <-- sem checar antes

if (message.hasQuotedMsg && quotedMsg.hasMedia) { ... }
```

A chamada acontece **antes** da verificação. Quando alguém manda `/img` sem citar
nada, a chamada falha ou devolve `undefined`, e o `quotedMsg.hasMedia` lança
`TypeError` — provavelmente capturado por algum `try/catch` de cima, virando um
❌ sem explicação. O `handleImageToSticker` já faz certo (`if
(message.hasQuotedMsg)` antes de buscar), então é inconsistência entre os dois
handlers.

**Pipoca:** um helper único, `downloadQuotedOrSelf()` em
[src/commands/helpers.js](src/commands/helpers.js), que checa se a própria
mensagem tem mídia, depois se há citação, e só então busca. Todos os comandos de
mídia usam o mesmo.

---

## 12. `isMessageRevoked` a cada resposta

Para saber se a mensagem foi apagada antes de responder, a Monra faz
`fetchMessages({})` — **sem limite**, ou seja, carrega a conversa inteira — e
ainda é chamada duas vezes por mensagem (uma no envio, outra na reação). Em
conversa longa isso é caro.

A Pipoca mantém a checagem (o comportamento é bom: não responder a mensagem
apagada), mas limitada ao histórico que já foi buscado.

---

## 13. Robustez no boot e no encerramento

Não existia na Monra:

- **Validação de configuração** antes de conectar, listando os problemas em vez
  de falhar longe da causa
- **Teste de conexão com o provedor de LLM** no boot, com aviso claro de que o bot
  conecta no WhatsApp mas não vai responder
- **Busca de histórico limitada** (`HISTORY_LIMIT`), em vez de `limit: 15` fixo no
  código
- **Encerramento limpo** em `SIGINT`/`SIGTERM`, fechando o Chromium em vez de
  deixar processo órfão
- **`unhandledRejection`** logado, em vez de morrer em silêncio
- **Testes** (`npm run smoke`) que rodam sem WhatsApp e sem API key

Detalhe de acabamento: no boot, quando o `console.txt` não existia, a Monra
imprimia "Console Text not found!" seguido de "Monra is already!" — as duas
mensagens juntas. A Pipoca usa um banner padrão e só avisa se você tiver um
`console.txt` que não conseguiu ler.

---

## 14. `stickerName` com `pushname` de fallback

A Monra monta o nome da figurinha com `contact.pushname` direto. `pushname` não
vem preenchido quando o contato não tem nome salvo, e dá `undefined` no meio do
nome da figurinha. A Pipoca usa `contact.pushname || STICKER_AUTHOR`.

---

## 15. A arte: desenhada em código, não gerada

A Pipoca é uma capivara. Para a arte havia três caminhos: gerar por IA, desenhar
à mão, ou desenhar em código.

**Escolhido: desenhar em código** ([`scripts/make-avatar.py`](../scripts/make-avatar.py)),
com a mesma geometria espelhada em [`assets/pipoca.svg`](../assets/pipoca.svg).

**Por quê:**

- **É editável.** O SVG abre no Inkscape/Illustrator/Figma e o script aceita
  ajuste de coordenada. Uma imagem gerada por IA não aceita "deixa o focinho
  5% maior".
- **É determinística.** Rodar de novo dá exatamente o mesmo resultado, então dá
  para versionar e revisar mudanças no git.
- **Não depende de serviço.** Sem chave de API de imagem, sem custo, sem rede.
- **Ensina o processo.** Quem for trocar por arte de verdade sabe exatamente onde
  ela entra (`avatar.imagePath`) e o que o bot faz com ela.

O desenho é feito em **4× e reduzido com LANCZOS**: é assim que se consegue borda
suave no Pillow sem anti-aliasing manual.

O `avatar.prompt` existe em paralelo, em `persona.js`, para quem preferir pedir a
arte a um gerador de imagem — os dois caminhos convivem.

### O que a arte ainda é

**Um esboço apresentável, não arte final.** Foram quatro iterações até ela parar
de parecer um urso: o que resolveu foi a **cabeça larga e achatada** (retângulo
arredondado, não círculo) com **focinho claro de contraste alto** e olhos bem
espaçados. Se você for trocar por arte profissional, o SVG serve de referência de
pose, paleta e proporção.

---

## 16. Foto de perfil: ligada por opção, não por padrão

`SET_PROFILE_PICTURE=true` faz o bot publicar a arte como foto de perfil ao
conectar. Fica **desligado por padrão**.

**Por quê:** é a primeira coisa neste projeto que altera algo **visível na conta
do usuário**, de forma persistente — não uma mensagem que dá para ignorar, mas a
cara do perfil. Automação que muda a identidade da conta sem pedir é o tipo de
coisa que surpreende de forma ruim, ainda mais quando a pessoa está testando o
bot num número que ela usa.

Mesmo ligada, a função **nunca derruba o boot**: se o arquivo não existir, avisa e
sugere `python scripts/make-avatar.py`; se o WhatsApp recusar, registra e segue.

---

## 17. Duas versões do PNG

`assets/pipoca.png` (quadrado) e `assets/pipoca-circular.png` (recorte circular).

O WhatsApp recorta a foto de perfil em círculo, então o PNG quadrado tem os cantos
cortados no cache dele. A versão circular foi adicionada porque, quando o arquivo
já vem com alpha circular, não sobra canto nenhum para o cache exibir.

---

## Pendências conhecidas

Coisas conscientemente deixadas para depois:

- **Contexto só em memória.** Reiniciar o bot perde o contexto de todas as
  conversas. O histórico do WhatsApp é rebuscado a cada mensagem, então a
  conversa não "quebra" — o bot só não lembra do que foi dito antes da janela de
  `HISTORY_LIMIT`, e perde a noção de "primeira mensagem". SQLite resolve.
- **Um processo por número.** Rodar dois bots no mesmo número com a mesma pasta de
  sessão causa conflito. O `clientId` é o `BOT_NAME`, o que já separa bots
  diferentes na mesma máquina.
- **Sem busca na web.** A persona instrui a não inventar quando não sabe, e é só
  isso que há. Um tool de busca é o item mais valioso do roadmap.
- **`sendStateTyping` dura 25s.** Em respostas lentas o indicador de digitação
  expira antes da mensagem sair. Dá para reenviar periodicamente.
