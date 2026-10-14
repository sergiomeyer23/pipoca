import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { runCommand } from "../commands/registry.js";
import { respondToMessage, clearHistory } from "../conversation/service.js";

/** Conversas que nao devem ser tratadas. */
const isIgnored = (message) => {
	const from = typeof message?.from === "string" ? message.from : "";

	return (
		message?.isStatus === true ||
		from === "status@broadcast" ||
		from.endsWith("@broadcast") ||
		message?.type === "e2e_notification" ||
		message?.type === "protocol"
	);
};

/**
 * Descreve a mensagem para o log de erro.
 * Sem isto, um erro opaco ("r") nao da nenhuma pista de qual mensagem
 * o causou nem de onde veio.
 */
const describe = (message) => {
	if (!message) return "(mensagem nula)";

	try {
		return [
			`from=${message.from ?? "?"}`,
			`type=${message.type ?? "?"}`,
			`fromMe=${message.fromMe ?? "?"}`,
			`body=${JSON.stringify(String(message.body ?? "").slice(0, 40))}`,
		].join(" ");
	} catch {
		return "(nao consegui descrever a mensagem)";
	}
};

/** Loga o erro de verdade: o stack trace e a mensagem culpada. */
const logFailure = (message, error) => {
	logger.failure(error, "erro ao processar mensagem");

	try {
		console.error(`         mensagem: ${describe(message)}`);
	} catch {
		// nao deixar o proprio log derrubar o handler
	}
};

/**
 * Ponto de entrada de cada mensagem recebida.
 * Decide entre comando e conversa.
 *
 * TUDO aqui dentro e protegido: o handler roda a partir do event
 * emitter do whatsapp-web.js, onde uma excecao vira rejeicao nao
 * tratada e pode derrubar o processo.
 */
export const routeMessage = async (message) => {
	try {
		if (!message) return;
		if (isIgnored(message)) return;

		// Sem `from` nao da para saber a conversa: ignora em vez de quebrar.
		if (typeof message.from !== "string") return;

		const isGroup = message.from.endsWith("@g.us");

		if (isGroup && !config.groups) return;

		const handled = await runCommand(message, { clearHistory });

		if (handled) return;

		await respondToMessage(message);
	} catch (error) {
		logFailure(message, error);
	}
};
