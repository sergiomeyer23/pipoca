import { parseCommand } from "./parse.js";
import {
	handleImageToSticker,
	handleStickerToImage,
	handleTranscribe,
	handleReset,
	handleHelp,
} from "./handlers.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";

/**
 * Registro de comandos.
 * Para criar um comando novo: escreva o handler em handlers.js e
 * adicione uma linha aqui. Nada mais precisa mudar.
 */
export const commands = {
	fig: {
		handler: handleImageToSticker,
		description: "transforma imagem em figurinha",
	},
	img: {
		handler: handleStickerToImage,
		description: "transforma figurinha em imagem",
	},
	escreva: {
		handler: handleTranscribe,
		description: "transcreve audio ou video",
	},
	transcrever: {
		handler: handleTranscribe,
		description: "apelido de /escreva",
	},
	reset: {
		handler: handleReset,
		description: "apaga o contexto da conversa",
	},
	help: {
		handler: handleHelp,
		description: "mostra os comandos",
	},
	ajuda: {
		handler: handleHelp,
		description: "apelido de /help",
	},
};

/** Resolve e executa o comando da mensagem, se houver. */
export const runCommand = async (message, context = {}) => {
	const parsed = parseCommand(message.body, config.prefix);

	if (!parsed) return false;

	const entry = commands[parsed.name];

	if (!entry) {
		// Prefixo usado, mas comando inexistente: avisa em vez de
		// deixar o modelo tentar responder.
		if (message.body.startsWith(config.prefix)) {
			await message.reply(
				`nao conheco "${config.prefix}${parsed.name}". tenta ${config.prefix}help`
			);
			return true;
		}
		return false;
	}

	try {
		await entry.handler({ parsed, message, ...context });
	} catch (error) {
		logger.failure(error, `comando "${parsed.name}" falhou`);
	}

	return true;
};
