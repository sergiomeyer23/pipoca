import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { transcribeAudio } from "../llm/client.js";
import { resolveFfmpegPath } from "../utils/sysinfo.js";
import { reactOk, reactError, replySafe, downloadQuotedOrSelf } from "./helpers.js";

/** /fig - imagem (ou video/gif) -> figurinha */
export const handleImageToSticker = async ({ message, chat, contact }) => {
	const mediaMessage = await downloadQuotedOrSelf(message);

	if (!mediaMessage || !mediaMessage.hasMedia) {
		await reactError(message, `❌ manda ou cita uma imagem pra eu virar figurinha.`);
		return;
	}

	await message.react("⏳");

	try {
		const media = await mediaMessage.downloadMedia();

		if (!media?.data) throw new Error("midia vazia");

		const author = contact?.pushname || config.sticker.author;

		const options = {
			sendMediaAsSticker: true,
			stickerName: `${config.sticker.pack} - ${author}`,
			stickerAuthor: config.author || config.sticker.author,
		};

		try {
			// chatId explícito: o reply precisa do destino correto tanto
			// em conversa privada quanto em grupo.
			await message.reply(media, message.from, options);
		} catch (error) {
			logger.debug(`reply de figurinha falhou, tentando pela conversa: ${error.message}`);
			await chat.sendMessage(media, options);
		}

		await reactOk(message);
	} catch (error) {
		logger.error(`/fig falhou: ${error.message}`);
		await reactError(message, "❌ nao consegui criar a figurinha.");
	}
};

/** /img - figurinha -> imagem */
export const handleStickerToImage = async ({ message, chat }) => {
	const mediaMessage = await downloadQuotedOrSelf(message);

	if (!mediaMessage || !mediaMessage.hasMedia) {
		await reactError(message, "❌ cita uma figurinha pra eu virar imagem.");
		return;
	}

	await message.react("⏳");

	try {
		const media = await mediaMessage.downloadMedia();
		if (!media?.data) throw new Error("midia vazia");

		await chat.sendMessage(media);
		await reactOk(message);
	} catch (error) {
		logger.error(`/img falhou: ${error.message}`);
		await reactError(message, "❌ nao consegui converter a figurinha.");
	}
};

const AUDIO_TYPES = ["audio", "ptt", "video"];

/** /escreva - transcreve audio ou video */
export const handleTranscribe = async ({ message, chat }) => {
	const mediaMessage = await downloadQuotedOrSelf(message);

	if (!mediaMessage || !mediaMessage.hasMedia) {
		await reactError(message, "❌ cita um audio ou video pra eu transcrever.");
		return;
	}

	const kind = String(mediaMessage.type ?? "").split("_")[0];
	if (!AUDIO_TYPES.includes(kind)) {
		await reactError(message, "❌ isso nao e audio nem video.");
		return;
	}

	await message.react("⏳");

	try {
		const media = await mediaMessage.downloadMedia();
		if (!media?.data) throw new Error("midia vazia");
		if (kind === "video" && !resolveFfmpegPath()) {
			throw new Error("transcricao de video precisa de ffmpeg");
		}

		await chat.sendStateTyping?.();

		const buffer = Buffer.from(media.data, "base64");
		const extension = kind === "video" ? "mp4" : "ogg";
		const text = await transcribeAudio(buffer, `audio.${extension}`);

		if (!text) throw new Error("transcricao vazia");

		await mediaMessage.reply(`No audio foi dito:\n\n${text}`);
		await reactOk(message);
	} catch (error) {
		logger.error(`/escreva falhou: ${error.message}`);
		await reactError(message, "❌ nao consegui transcrever.");
	} finally {
		try {
			await chat.clearState?.();
		} catch {
			// o estado de digitacao expira sozinho
		}
	}
};

/** /reset - esquece o contexto desta conversa */
export const handleReset = async ({ message, chat, clearHistory }) => {
	try {
		clearHistory(chat.id._serialized);
		await reactOk(message);
		await replySafe(message, "contexto apagado ✅ pode comecar de novo");
	} catch (error) {
		logger.error(`/reset falhou: ${error.message}`);
		await reactError(message);
	}
};

/** /help - lista o que ela sabe fazer */
export const handleHelp = async ({ message }) => {
	const p = config.prefix;

	const lines = [
		`*${config.botName}* - comandos`,
		`${p}fig - transforma imagem em figurinha`,
		`${p}img - transforma figurinha em imagem`,
		`${p}escreva - transcreve audio ou video (cite a midia)`,
		`${p}reset - apaga o contexto da conversa`,
		`${p}help - mostra esta lista`,
		"",
		"fora dos comandos, e so conversar.",
	];

	await replySafe(message, lines.join("\n"));
};
