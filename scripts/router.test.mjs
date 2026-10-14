/**
 * Teste do roteador de mensagens.
 *
 * O roteador roda a partir do event emitter do whatsapp-web.js, onde uma
 * excecao vira rejeicao nao tratada. Por isso ele precisa sobreviver a
 * mensagens malformadas — o WhatsApp emite mensagens de sistema com
 * campos ausentes (protocolo, status, notificacao de grupo).
 *
 * Uso: npm run test:router
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

const { routeMessage } = await import("../src/whatsapp/messageRouter.js");

const malformadas = {
	"from undefined": { from: undefined, type: "protocol", body: "" },
	"from null": { from: null, type: "chat", body: "oi" },
	"from numerico": { from: 123, type: "chat", body: "oi" },
	"objeto vazio": {},
	"null": null,
	"undefined": undefined,
};

console.log("\nroteador de mensagens");

for (const [nome, message] of Object.entries(malformadas)) {
	await test(`nao lanca com ${nome}`, async () => {
		await routeMessage(message);
	});
}

await test("ignora status@broadcast", async () => {
	await routeMessage({ from: "status@broadcast", type: "chat", body: "oi" });
});

await test("ignora broadcast comum", async () => {
	await routeMessage({ from: "123@broadcast", type: "chat", body: "oi" });
});

await test("ignora e2e_notification", async () => {
	await routeMessage({ from: "5511@c.us", type: "e2e_notification", body: "" });
});

await test("ignora protocol", async () => {
	await routeMessage({ from: "5511@c.us", type: "protocol", body: "" });
});

await test("nao lanca quando a conversa nao existe", async () => {
	// getChat() indisponivel: o handler deve falhar por dentro, sem escapar.
	await routeMessage({
		from: "5511999999999@c.us",
		type: "chat",
		body: "oi",
		fromMe: false,
		hasMedia: false,
		hasQuotedMsg: false,
		mentionedIds: [],
		async getChat() {
			throw new Error("chat nao encontrado");
		},
		async getContact() {
			return { pushname: "Alguem" };
		},
	});
});

console.log(
	`\n${failed === 0 ? "TUDO OK" : "HOUVE FALHAS"} - ${passed} passaram, ${failed} falharam\n`
);

process.exit(failed === 0 ? 0 : 1);
