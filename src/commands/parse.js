import { config } from "../config/env.js";

/**
 * Reconhece um comando no inicio da mensagem.
 * PURO e testavel.
 *
 * Ex.: prefix "/", body "/fig agora" -> { name: "fig", args: "agora" }
 */
export const parseCommand = (body, prefix = config.prefix) => {
	const text = String(body ?? "").trim();

	if (!text.startsWith(prefix)) return null;

	const withoutPrefix = text.slice(prefix.length);
	if (withoutPrefix === "") return null;

	const [word, ...rest] = withoutPrefix.split(/\s+/);
	const name = word.toLowerCase();

	return { name, args: rest.join(" ").trim() };
};
