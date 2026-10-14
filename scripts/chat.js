/**
 * Conversa com a Pipoca direto no terminal, sem WhatsApp.
 *
 * Serve para testar e ajustar a personalidade: aqui o cerebro e a
 * persona, sem transporte no meio. Cada resposta mostra qual modelo
 * respondeu e quanto demorou.
 *
 * Uso:
 *   npm run chat                       (interativo)
 *   npm run chat -- Ana                (define o nome de quem fala)
 *
 * Modo de teste (sem interacao, util para validar a persona):
 *   node scripts/chat.js --teste "oi" "quem te criou?" "vc e um robo?"
 *
 * Comandos durante a conversa:
 *   /reset   esquece o historico
 *   /prompt  mostra o system prompt que esta sendo enviado
 *   /sair    encerra
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import colors from "colors";
import { config, validateConfig } from "../src/config/env.js";
import { persona } from "../src/persona/persona.js";
import { buildSystemPrompt } from "../src/persona/prompt.js";
import { generateReply } from "../src/llm/client.js";

// --------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const testAt = args.indexOf("--teste");

const testMessages = testAt >= 0 ? args.slice(testAt + 1) : null;
const interactive = testMessages === null;

// O nome de quem fala e o primeiro argumento solto ANTES de --teste.
const antesDoTeste = testAt >= 0 ? args.slice(0, testAt) : args;
const speaker = antesDoTeste.find((arg) => !arg.startsWith("--")) ?? "Você";

// ------------------------------------------------------------------ estado
let history = [];

const freshPrompt = () =>
	buildSystemPrompt({
		persona,
		context: {
			chatType: "private",
			speakerName: speaker === "Você" ? "alguem" : speaker,
			isFirstTurn: true,
		},
	});

let systemPrompt = freshPrompt();

// -------------------------------------------------------------- pre-checagem
const problems = validateConfig();
if (problems.length > 0) {
	console.error(colors.red("\nAntes de conversar, resolva isto no .env:\n"));
	for (const problem of problems) console.error(colors.yellow(`  - ${problem}`));
	console.error(colors.gray("\n  Sem OPENAI_API_KEY a Pipoca nao tem como pensar.\n"));
	process.exit(1);
}

// ------------------------------------------------------------------ cabecalho
if (interactive) {
	console.log(colors.magenta(`\n  🍿 ${config.botName} - conversa direta`));
	console.log(colors.gray(`  modelo: ${config.llm.model}  |  provedor: ${config.llm.baseUrl}`));
	console.log(colors.gray("  /reset  /prompt  /sair\n"));
}

// -------------------------------------------------------------- um turno
const send = async (text) => {
	history.push({ role: "user", content: text });

	const started = Date.now();
	try {
		const { text: reply, model } = await generateReply({ systemPrompt, messages: history });
		const ms = Date.now() - started;

		history.push({ role: "assistant", content: reply });

		console.log(`${colors.magenta(`${config.botName}:`)} ${reply}`);
		console.log(colors.gray(`  (${model}, ${ms}ms)\n`));
	} catch (error) {
		history.pop(); // nao guarda o turno que falhou
		console.error(colors.red(`  falhou: ${error.message}`));

		// Erro esperado (chave errada, modelo inexistente): so a mensagem.
		if (!error.expected) console.error(colors.gray(error.stack));

		console.log("");
	}
};

// -------------------------------------------------------------- modo teste
if (!interactive) {
	console.log(colors.magenta(`\n  🍿 ${config.botName} - teste de persona`));
	console.log(colors.gray(`  modelo: ${config.llm.model}  |  provedor: ${config.llm.baseUrl}\n`));

	for (const message of testMessages) {
		console.log(colors.cyan(`${speaker}: `) + message);
		await send(message);
	}

	process.exit(0);
}

// ------------------------------------------------------------- modo interativo
const rl = createInterface({ input: stdin, output: stdout });

while (true) {
	let line;
	try {
		line = await rl.question(colors.cyan(`${speaker}: `));
	} catch {
		break; // Ctrl+C ou entrada fechada
	}

	const text = line.trim();
	if (text === "") continue;

	if (["/sair", "/exit", "/quit"].includes(text)) break;

	if (text === "/reset") {
		history = [];
		systemPrompt = freshPrompt();
		console.log(colors.gray("  historico limpo\n"));
		continue;
	}

	if (text === "/prompt") {
		console.log(colors.gray("\n--- system prompt ---"));
		console.log(systemPrompt);
		console.log(colors.gray("--- fim ---\n"));
		continue;
	}

	if (text.startsWith("/")) {
		console.log(colors.gray(`  (comando desconhecido: ${text}) — tente /reset, /prompt ou /sair\n`));
		continue;
	}

	await send(text);
}

rl.close();
console.log(colors.gray("\n  ate mais 👋\n"));
