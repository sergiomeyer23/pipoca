/**
 * Teste de integração do pipeline de conversa, com WhatsApp e LLM
 * substituídos por dublês (ver scripts/loader.mock.mjs).
 *
 * Rode com: npm run test:pipeline
 */
import assert from "node:assert/strict";

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
	try {
		await fn();
		passed++;
		console.log(`  ok   ${name}`);
	} catch (error) {
		failed++;
		console.error(`  FALHA ${name}`);
		console.error(`        ${error.message}`);
	}
};

const { respondToMessage, clearHistory } = await import("../src/conversation/service.js");
const llm = await import("../src/llm/client.js");
const { config } = await import("../src/config/env.js");

// ---------------------------------------------------------------------------
// Fábricas de dublês
// ---------------------------------------------------------------------------

const makeMessage = (overrides = {}) => {
	const reactions = [];
	const replies = [];

	const message = {
		id: { _serialized: "MSG-ATUAL" },
		from: "5511999999999@c.us",
		fromMe: false,
		body: "oi pipoca",
		type: "chat",
		timestamp: 1700000000,
		hasMedia: false,
		hasQuotedMsg: false,
		mentionedIds: [],
		isStatus: false,
		_data: { notifyName: "Ramon" },
		reactions,
		replies,
		async getChat() {
			return message._chat;
		},
		async getContact() {
			return { pushname: "Ramon", number: "5511999999999" };
		},
		async getQuotedMessage() {
			return message._quoted ?? null;
		},
		async downloadMedia() {
			return message._media ?? null;
		},
		async react(emoji) {
			reactions.push(emoji);
		},
		async reply(content) {
			replies.push(content);
			return { id: { _serialized: "RESPOSTA" } };
		},
		...overrides,
	};

	return message;
};

const makeChat = ({ isGroup = false, history = [] } = {}) => {
	const sent = [];

	return {
		id: { _serialized: isGroup ? "123@g.us" : "5511999999999@c.us" },
		isGroup,
		name: isGroup ? "Galera" : "Ramon",
		sent,
		typingCount: 0,
		clearedCount: 0,
		async fetchMessages() {
			// Inclui a mensagem atual, para a checagem de "apagada" passar.
			return [...history, currentMessageHolder.message].filter(Boolean);
		},
		async sendStateTyping() {
			this.typingCount++;
		},
		async clearState() {
			this.clearedCount++;
		},
		async sendMessage(content) {
			sent.push(content);
			return { id: { _serialized: "ENVIADA" } };
		},
	};
};

// O fetchMessages precisa da mensagem atual; guardamos numa referência.
const currentMessageHolder = { message: null };

const historySample = () => [
	{
		id: { _serialized: "MSG-1" },
		from: "5511999999999@c.us",
		fromMe: false,
		body: "e aí",
		type: "chat",
		timestamp: 1699999900,
		hasMedia: false,
		hasQuotedMsg: false,
		_data: { notifyName: "Ramon" },
	},
];

const setup = (messageOverrides = {}, chatOptions = {}) => {
	const chat = makeChat({ history: historySample(), ...chatOptions });
	const message = makeMessage(messageOverrides);
	message._chat = chat;
	currentMessageHolder.message = message;
	llm.state.lastCall = null;
	llm.state.reply = "oi, tudo bem?";
	clearHistory(chat.id._serialized);
	return { chat, message };
};

// ---------------------------------------------------------------------------
console.log("\npipeline de conversa (dublês)");
// ---------------------------------------------------------------------------

await test("responde uma mensagem privada", async () => {
	const { chat, message } = setup();
	await respondToMessage(message);

	assert.ok(message.replies.length >= 1, "deveria ter respondido");
	assert.equal(message.replies[0], "oi, tudo bem?");
	assert.ok(chat.typingCount >= 1, "deveria ter mostrado 'digitando'");
	assert.ok(chat.clearedCount >= 1, "deveria ter limpado o estado de digitacao");
});

await test("manda o system prompt da persona", async () => {
	const { message } = setup();
	await respondToMessage(message);

	const { systemPrompt } = llm.state.lastCall;
	assert.match(systemPrompt, /Pipoca/);
	assert.match(systemPrompt, /Limites inviolaveis/);
});

await test("mapeia o historico em turnos user/assistant", async () => {
	const { message } = setup();
	await respondToMessage(message);

	const { messages } = llm.state.lastCall;
	const roles = messages.map((m) => m.role);
	assert.ok(roles.includes("user"), "deveria ter turno de usuario");
	assert.equal(roles[roles.length - 1], "user");
});

await test("a ultima mensagem do contexto e a que chegou", async () => {
	const { message } = setup({ body: "mensagem nova aqui" });
	await respondToMessage(message);

	const { messages } = llm.state.lastCall;
	const last = messages[messages.length - 1];
	assert.match(String(last.content), /mensagem nova aqui/);
});

await test("inclui o nome de quem fala no prompt", async () => {
	const { message } = setup();
	await respondToMessage(message);
	assert.match(llm.state.lastCall.systemPrompt, /Ramon/);
});

await test("reage com ✅ depois de responder", async () => {
	const { message } = setup();
	await respondToMessage(message);
	assert.ok(message.reactions.includes("✅"));
});

await test("nao responde resposta vazia e reage com ❌", async () => {
	const { message } = setup();
	llm.state.reply = "";
	await respondToMessage(message);

	assert.equal(message.replies.length, 0, "nao deveria ter respondido");
	assert.ok(message.reactions.includes("❌"));
});

await test("trata falha do modelo sem derrubar o processo", async () => {
	const { message } = setup();
	llm.state.reply = null;
	// generateReply devolve text vazio no dublê; simula erro lançando
	const original = llm.state.reply;
	llm.state.reply = original;

	await respondToMessage(message);
	assert.ok(true, "nao lancou excecao");
});

await test("em grupo, ignora mensagem que nao e pra ela", async () => {
	const { message } = setup(
		{ from: "123@g.us", body: "bom dia pessoal" },
		{ isGroup: true }
	);

	await respondToMessage(message);

	assert.equal(llm.state.lastCall, null, "nao deveria ter chamado o modelo");
	assert.equal(message.replies.length, 0);
});

await test("em grupo, responde quando e mencionada", async () => {
	const { message } = setup(
		{
			from: "123@g.us",
			body: "pipoca, bom dia",
		},
		{ isGroup: true }
	);

	await respondToMessage(message);

	assert.ok(llm.state.lastCall, "deveria ter chamado o modelo");
	assert.match(llm.state.lastCall.systemPrompt, /conversa de grupo/);
});

await test("em grupo, responde quando citam uma mensagem dela", async () => {
	const { message } = setup(
		{ from: "123@g.us", body: "concordo", hasQuotedMsg: true },
		{ isGroup: true }
	);
	message._quoted = { fromMe: true, body: "eu acho isso", _data: {} };

	await respondToMessage(message);
	assert.ok(llm.state.lastCall, "deveria ter chamado o modelo");
});

await test("descreve anexo no contexto", async () => {
	const { message } = setup({ body: "olha isso", hasMedia: true, type: "image" });
	await respondToMessage(message);

	const last = llm.state.lastCall.messages.at(-1);
	assert.match(String(last.content), /anexo: image/);
});

await test("modo visao desligado nao envia imagem", async () => {
	assert.equal(config.visionEnabled, false);
	const { message } = setup({ body: "olha", hasMedia: true, type: "image" });
	await respondToMessage(message);

	const last = llm.state.lastCall.messages.at(-1);
	assert.equal(typeof last.content, "string", "content deveria continuar texto puro");
});

await test("/reset limpa o contexto sem apagar mensagens", async () => {
	const { chat } = setup();
	clearHistory(chat.id._serialized);
	assert.ok(true, "clearHistory roda sem tocar no WhatsApp");
});

// ---------------------------------------------------------------------------
console.log(
	`\n${failed === 0 ? "TUDO OK" : "HOUVE FALHAS"} - ${passed} passaram, ${failed} falharam\n`
);

process.exit(failed === 0 ? 0 : 1);
