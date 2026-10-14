import moment from "moment-timezone";
import colors from "colors";
import { config } from "../config/env.js";

const stamp = () => {
	const tz = moment.tz.zone(config.timezone) ? config.timezone : "UTC";
	return colors.gray(`[${moment().tz(tz).format("HH:mm:ss")}]`);
};

const write = (stream, label, color, args) => {
	stream(`${stamp()} ${color(label)}`, ...args);
};

export const logger = {
	info: (...args) => write(console.log, "info ", colors.cyan, args),
	ok: (...args) => write(console.log, "ok   ", colors.green, args),
	warn: (...args) => write(console.warn, "aviso", colors.yellow, args),
	error: (...args) => write(console.error, "erro ", colors.red, args),

	/**
	 * Erro com contexto completo. Nao depende de DEBUG_PROMPT:
	 * quando algo quebra em producao, o stack trace e a unica pista
	 * que existe, entao ele sempre aparece.
	 */
	failure: (error, context = "") => {
		const detail = error?.message ?? String(error);
		write(console.error, "erro ", colors.red, [context ? `${context}: ${detail}` : detail]);

		if (error?.stack) console.error(colors.gray(error.stack));
		else console.error(colors.gray(`(sem stack trace - valor lancado: ${JSON.stringify(error)})`));
	},
	bot: (...args) => write(console.log, "pipoca", colors.magenta, args),
	debug: (...args) => {
		if (config.debugPrompt) write(console.log, "debug", colors.gray, args);
	},
};
