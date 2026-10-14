import wwebjs from "whatsapp-web.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { resolveFfmpegPath, resolveChromePath } from "../utils/sysinfo.js";
import { showQrInTerminal } from "./qr.js";

const { Client, LocalAuth } = wwebjs;

let client;

const buildOptions = () => {
	const ffmpeg = resolveFfmpegPath();

	if (!ffmpeg) {
		logger.warn(
			"ffmpeg nao encontrado. Figurinhas de video e conversao de audio podem falhar. " +
				"Defina FFMPEG_PATH no .env ou instale o ffmpeg."
		);
	} else {
		logger.debug(`ffmpeg: ${ffmpeg}`);
	}

	const options = {
		authStrategy: new LocalAuth({
			clientId: config.botName.toLowerCase(),
			dataPath: config.paths.auth,
		}),
		puppeteer: {
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
		},
	};

	// Usa o Chrome ja instalado, se houver: evita os ~150 MB do
	// Chromium que o puppeteer baixaria.
	const chrome = resolveChromePath();
	if (chrome) {
		options.puppeteer.executablePath = chrome;
		logger.debug(`chrome: ${chrome}`);
	} else {
		logger.debug("nenhum Chrome do sistema encontrado; usando o Chromium do puppeteer.");
	}

	// O nome da opcao mudou entre versoes do whatsapp-web.js.
	if (ffmpeg) {
		options.ffmpegPath = ffmpeg;
		options.ffmpeg = ffmpeg;
	}

	return options;
};

/** Cria o client (sem conectar ainda). */
export const createClient = () => {
	if (client) return client;
	client = new Client(buildOptions());
	return client;
};

export const getClient = () => {
	if (!client) throw new Error("Cliente do WhatsApp ainda nao foi inicializado.");
	return client;
};

/** ID serializado do proprio bot ("5511...@c.us"), ou null. */
export const getBotId = () => client?.info?.wid?._serialized ?? null;

/**
 * Liga os eventos do client aos handlers da aplicacao.
 * `handlers` = { onQr, onReady, onMessage, onDisconnected, onAuthFailure }
 */
export const wireEvents = (handlers = {}) => {
	const instance = getClient();

	if (handlers.onQr) instance.on("qr", handlers.onQr);
	if (handlers.onReady) instance.on("ready", handlers.onReady);
	if (handlers.onMessage) instance.on("message", handlers.onMessage);
	if (handlers.onAuthFailure) instance.on("auth_failure", handlers.onAuthFailure);
	if (handlers.onDisconnected) instance.on("disconnected", handlers.onDisconnected);

	instance.on("loading_screen", (percent) => {
		logger.debug(`carregando WhatsApp Web: ${percent}%`);
	});

	instance.on("change_state", (state) => {
		logger.debug(`estado da conexao: ${state}`);
	});

	return instance;
};

// O QR muda a cada ~20s; so avisamos uma vez para nao poluir.
let qrShown = false;

export const handleQr = async (qr) => {
	if (!qrShown) {
		logger.info("Escaneie o QR Code para conectar:");
		qrShown = true;
	}
	await showQrInTerminal(qr);
};
