import { logger } from "../utils/logger.js";

/**
 * Helpers compartilhados pelos comandos.
 * Todos engolem os proprios erros: uma reacao que falha nao pode
 * derrubar o handler inteiro.
 */

/** Reage com seguranca (o WhatsApp as vezes recusa reacoes). */
export const react = async (message, emoji) => {
	try {
		await message.react(emoji);
	} catch (error) {
		logger.debug(`reacao "${emoji}" falhou: ${error.message}`);
	}
};

/** Reage com sucesso; se houver texto, tambem responde. */
export const reactOk = async (message, text = null) => {
	await react(message, "✅");
	if (text) await replySafe(message, text);
};

/** Reage com erro e, opcionalmente, explica o motivo. */
export const reactError = async (message, text = null) => {
	await react(message, "❌");
	if (text) await replySafe(message, text);
};

/** Responde citando; se falhar, manda direto na conversa. */
export const replySafe = async (message, content) => {
	try {
		return await message.reply(content);
	} catch (error) {
		logger.debug(`reply falhou, enviando na conversa: ${error.message}`);
		try {
			const chat = await message.getChat();
			return await chat.sendMessage(content);
		} catch (innerError) {
			logger.error(`nao consegui enviar mensagem: ${innerError.message}`);
			return null;
		}
	}
};

/**
 * Pega a midia a usar: a propria mensagem se tiver midia,
 * senao a mensagem citada.
 */
export const downloadQuotedOrSelf = async (message) => {
	if (message.hasMedia) return message;

	if (message.hasQuotedMsg) {
		try {
			const quoted = await message.getQuotedMessage();
			if (quoted?.hasMedia) return quoted;
		} catch (error) {
			logger.debug(`nao consegui ler a mensagem citada: ${error.message}`);
		}
	}

	return null;
};

/** Nome de exibicao do contato, com fallbacks. */
export const displayName = (contact, fallback = "alguem") =>
	contact?.pushname || contact?.name || contact?.number || fallback;
