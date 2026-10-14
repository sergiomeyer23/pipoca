/**
 * Mostra o system prompt exato que sera enviado ao modelo.
 *
 * Serve para conferir o que a persona realmente virou, sem precisar
 * de WhatsApp nem de API key — as regras da personalidade sao
 * instrucoes de prompt, entao este e o lugar de verdade onde elas vivem.
 *
 * Uso: npm run prompt
 */
import { buildSystemPrompt } from "../src/persona/prompt.js";
import { persona } from "../src/persona/persona.js";

const speaker = process.argv[2] ?? "Ramon";
const chatType = process.argv[3] === "grupo" ? "group" : "private";

const prompt = buildSystemPrompt({
	persona,
	context: {
		chatType,
		chatName: chatType === "group" ? "Galera" : undefined,
		speakerName: speaker,
		isFirstTurn: true,
	},
});

console.log(prompt);
console.log(`\n--- ${prompt.length} caracteres, ~${Math.round(prompt.length / 4)} tokens ---`);
