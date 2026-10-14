import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Raiz do projeto (a pasta que contem package.json / .env).
 * Arquivo: <raiz>/src/config/env.js  ->  sobe dois niveis.
 */
export const ROOT_DIR = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

const str = (value, fallback = "") => {
	const trimmed = typeof value === "string" ? value.trim() : "";
	return trimmed === "" ? fallback : trimmed;
};

const bool = (value, fallback = false) => {
	const trimmed = str(value).toLowerCase();
	if (trimmed === "") return fallback;
	return ["1", "true", "yes", "on", "sim"].includes(trimmed);
};

const int = (value, fallback) => {
	const parsed = Number.parseInt(str(value), 10);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const env = process.env;

export const config = {
	botName: str(env.BOT_NAME, "Pipoca"),
	author: str(env.AUTHOR, ""),

	prefix: str(env.PREFIX, "/"),
	timezone: str(env.TIMEZONE, "America/Sao_Paulo"),
	groups: bool(env.GROUPS, true),

	sticker: {
		author: str(env.STICKER_AUTHOR, str(env.BOT_NAME, "Pipoca")),
		pack: str(env.STICKER_PACK, str(env.BOT_NAME, "Pipoca")),
	},

	llm: {
		apiKey: str(env.OPENAI_API_KEY),
		baseUrl: str(env.OPENAI_API_BASE, "https://api.openai.com/v1"),
		model: str(env.MODEL, "gpt-4o-mini"),
		fallbackModel: str(env.FALLBACK_MODEL, "gpt-4o-mini"),
	},

	visionEnabled: bool(env.VISION_ENABLED, false),
	setProfilePicture: bool(env.SET_PROFILE_PICTURE, false),
	historyLimit: Math.max(1, int(env.HISTORY_LIMIT, 15)),
	debugPrompt: bool(env.DEBUG_PROMPT, false),

	ffmpegPath: str(env.FFMPEG_PATH),
	chromePath: str(env.CHROME_PATH),
	paths: {
		root: ROOT_DIR,
		banner: path.join(ROOT_DIR, "console.txt"),
		auth: path.join(ROOT_DIR, ".wwebjs_auth"),
		cache: path.join(ROOT_DIR, ".wwebjs_cache"),
		tmp: path.join(ROOT_DIR, "tmp"),
	},
};

/**
 * Checagens de configuracao feitas no boot.
 * Retorna uma lista de problemas (vazia = tudo certo).
 */
export const validateConfig = () => {
	const problems = [];

	if (!config.llm.apiKey) {
		problems.push(
			"OPENAI_API_KEY esta vazia. Sem ela o bot conecta no WhatsApp, mas nao consegue responder."
		);
	}

	if (!/^https?:\/\//i.test(config.llm.baseUrl)) {
		problems.push(`OPENAI_API_BASE invalida: "${config.llm.baseUrl}" (precisa comecar com http:// ou https://).`);
	}

	if (config.prefix.length > 3) {
		problems.push(`PREFIX muito longo ("${config.prefix}"). Use 1 a 3 caracteres.`);
	}

	if (!config.llm.model) {
		problems.push("MODEL nao definido.");
	}

	return problems;
};
