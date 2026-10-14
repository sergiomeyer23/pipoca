import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { persona } from "../persona/persona.js";
import { buildSystemPrompt } from "../persona/prompt.js";
import { generateReply } from "../llm/client.js";
import { getClient } from "../whatsapp/client.js";
import {
	transformHistory,
	buildContext,
	isMessageForMe,
	isMessageRevoked,
	appendMessageToHistory,
} from "./history.js";
import { reactOk, reactError, replySafe, displayName } from "../commands/helpers.js";

/**
 * Estado em memoria: contexto por conversa.
 * Some quando o processo cai, o que e aceitavel (e ate desejavel)
 * para uma persona de conversa.
 */
const chatMemory = new Map();

export const clearHistory = (chatId) => {
	chatMemory.delete(chatId);
	logger.debug(`contexto apagado: ${chatId}`);
};

export const knownChats = () => chatMemory.size;

const memoryFor = (chatId) => {
	if (!chatMemory.has(chatId)) {
		chatMemory.set(chatId, { seen: false, lastAt: null });
	}
	return chatMemory.get(chatId);
};

const IMAGE_TYPES = ["image", "sticker"];

/** Coleta imagens da mensagem (e da citada) para o modo visao. */
const collectImages = async (message) => {
	if (!config.visionEnabled) return [];

	const candidates = [message];

	if (message.hasQuotedMsg) {
		try {
			const quoted = await message.getQuotedMessage();
			if (quoted) candidates.push(quoted);
		} catch {
			// citacao ilegivel: ignora
		}
	}

	const images = [];

	for (const candidate of candidates.slice(0, 2)) {
		const kind = String(candidate?.type ?? "").split("_")[0];
		if (!candidate?.hasMedia || !IMAGE_TYPES.includes(kind)) continue;

		try {
			const media = await candidate.downloadMedia();
			if (media?.data && media?.mimetype?.startsWith("image/")) {
				images.push({ dataUrl: `data:${media.mimetype};base64,${media.data}` });
			}
		} catch (error) {
			logger.debug(`nao consegui baixar a imagem: ${error.message}`);
		}
	}

	return images;
};

/** Mapa id -> mensagem citada, resolvido de uma vez so. */
const resolveQuotedMap = async (messages) => {
	const map = new Map();

	await Promise.all(
		messages
			.filter((msg) => msg?.hasQuotedMsg)
			.map(async (msg) => {
				try {
					const quoted = await msg.getQuotedMessage();
					if (quoted) map.set(msg.id._serialized, quoted);
				} catch {
					// citacao indisponivel
				}
			})
	);

	return map;
};

/** Junta o texto do turno com as imagens, no formato multimodal. */
const withImages = (turn, images) => {
	if (images.length === 0 || turn.role !== "user") return turn;

	const text = typeof turn.content === "string" ? turn.content : "";
	const parts = [
		...(text ? [{ type: "text", text }] : []),
		...images.map((image) => ({ type: "image_url", image_url: { url: image.dataUrl } })),
	];

	return { ...turn, content: parts };
};

/**
 * Fluxo principal de conversa:
 * historico -> prompt -> modelo -> resposta.
 */
export const respondToMessage = async (message) => {
	const chat = await message.getChat();
	const chatId = chat.id._serialized;
	const memory = memoryFor(chatId);

	// Grupos: so responde se for pra ela.
	if (chat.isGroup && !(await isMessageForMe(getClient(), message))) {
		return;
	}

	const contact = await message.getContact().catch(() => null);

	let typing = false;
	const stopTyping = async () => {
		if (!typing) return;
		typing = false;
		try {
			await chat.clearState();
		} catch {
			// o estado de digitacao expira sozinho
		}
	};

	try {
		// Historico real do WhatsApp, do mais antigo para o mais novo.
		const recent = await chat.fetchMessages({ limit: config.historyLimit });
		const context = buildContext(recent, message, config.historyLimit);

		const quoted = await resolveQuotedMap(context);
		const turns = await transformHistory(context, {
			resolveQuoted: async (msg) => quoted.get(msg.id._serialized) ?? null,
		});

		if (turns.length === 0) return;

		const images = await collectImages(message);
		if (images.length > 0) {
			turns[turns.length - 1] = withImages(turns[turns.length - 1], images);
		}

		const systemPrompt = buildSystemPrompt({
			persona,
			context: {
				chatType: chat.isGroup ? "group" : "private",
				chatName: chat.name,
				speakerName: displayName(contact),
				isFirstTurn: !memory.seen,
			},
		});

		typing = true;
		await chat.sendStateTyping().catch(() => {});

		const started = Date.now();
		const { text, model } = await generateReply({ systemPrompt, messages: turns });
		logger.debug(`resposta de "${model}" em ${Date.now() - started}ms`);

		await stopTyping();

		// Se apagaram a mensagem enquanto ela pensava, nao responde.
		if (await isMessageRevoked(getClient(), message)) {
			logger.debug("mensagem apagada antes da resposta; descartando.");
			return;
		}

		if (!text) {
			await reactError(message);
			return;
		}

		await message.reply(text);

		memory.seen = true;
		memory.lastAt = Date.now();

		await reactOk(message);
	} catch (error) {
		logger.failure(error, "falha ao responder");
		await stopTyping();
		await reactError(message);
		await replySafe(message, "deu ruim aqui do meu lado, tenta de novo?");
	}
};
