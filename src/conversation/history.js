import { config } from "../config/env.js";

/**
 * Converte mensagens do whatsapp-web.js em mensagens de chat
 * para o modelo.
 *
 * Tudo aqui e PURO: recebe as mensagens e devolve dados.
 * Assim da para testar sem subir o WhatsApp.
 *
 * Diferenca em relacao a Monra: o historico e enviado como
 * turnos `user`/`assistant` de verdade (multiturno), em vez de
 * um JSON gigante colado dentro de um unico turno.
 */

/** Extrai o nome exibido do remetente, com fallbacks. */
export const senderName = (msg) => {
	if (!msg) return "desconhecido";

	if (msg.fromMe) return config.botName;

	return (
		msg._data?.notifyName ||
		msg._data?.pushname ||
		msg.pushname ||
		msg.author ||
		msg.from ||
		"desconhecido"
	);
};

/** Tipo de midia normalizado ("image", "audio", "video", "document", "sticker"). */
export const mediaType = (msg) => {
	if (!msg?.hasMedia) return null;
	return String(msg.type ?? "").split("_")[0] || "midia";
};

/** Descricao textual de uma mensagem, incluindo citacao e anexo. */
export const describeMessage = (msg, quoted = null) => {
	const name = senderName(msg);
	const when = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString("pt-BR") : null;

	const parts = [];
	if (when) parts.push(`[${when}] ${name}: ${msg.body ?? ""}`.trim());
	else parts.push(`${name}: ${msg.body ?? ""}`.trim());

	if (quoted) {
		const quotedName = senderName(quoted);
		parts.push(`(respondendo a ${quotedName}: "${(quoted.body ?? "").slice(0, 200)}")`);
	}

	const media = mediaType(msg);
	if (media) parts.push(`[anexo: ${media}]`);

	return parts.join(" ");
};

/**
 * Transforma o array de mensagens em turnos para a API.
 * `resolveQuoted` e uma funcao async (msg) => quotedMsg|null,
 * injetada para manter o modulo testavel.
 */
export const transformHistory = async (messages = [], { resolveQuoted = null } = {}) => {
	const turns = [];

	for (const msg of messages) {
		if (!msg || msg.fromMe === undefined) continue;

		// Reacoes e mensagens de sistema nao entram no contexto.
		if (msg.body === "" && !msg.hasMedia) continue;

		const quoted = msg.hasQuotedMsg && resolveQuoted ? await resolveQuoted(msg) : null;
		const content = describeMessage(msg, quoted);

		turns.push({
			role: msg.fromMe ? "assistant" : "user",
			content,
		});
	}

	return turns;
};

/** Remove duplicata e coloca a mensagem nova no fim do historico. */
export const appendMessageToHistory = (history = [], message) => {
	const id = message?.id?._serialized;
	const filtered = id ? history.filter((msg) => msg.id?._serialized !== id) : [...history];
	return [...filtered, message];
};

/** A mensagem foi apagada para todos enquanto o bot pensava? */
export const isMessageRevoked = async (client, message) => {
	try {
		const chat = await client.getChatById(message.from);
		const messages = await chat.fetchMessages({});
		return !messages.some((msg) => msg.id._serialized === message.id._serialized);
	} catch {
		// Em caso de duvida assume que segue valida.
		return false;
	}
};

/**
 * A mensagem e destinada ao bot?
 * Usado em grupos para decidir se ela responde.
 */
export const isMessageForMe = async (client, message) => {
	if (!message.from.endsWith("@g.us")) return true;

	const myId = client.info?.wid?._serialized;
	if (!myId) return false;

	if (message.mentionedIds?.includes(myId)) return true;

	const body = String(message.body ?? "").toLowerCase();
	if (body.includes(config.botName.toLowerCase())) return true;

	if (message.hasQuotedMsg) {
		try {
			const quoted = await message.getQuotedMessage();
			return Boolean(quoted?.fromMe);
		} catch {
			return false;
		}
	}

	return false;
};

/** Historico + mensagem atual, com o tamanho do .env aplicado. */
export const buildContext = (history = [], message, limit = config.historyLimit) => {
	const withCurrent = appendMessageToHistory(history, message);
	return withCurrent.slice(-limit);
};
