import colors from "colors";
import { config, validateConfig } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { printBanner, printReady } from "./core/banner.js";
import { checkLlmConnection } from "./llm/client.js";
import { createClient, wireEvents, getClient, handleQr } from "./whatsapp/client.js";
import { routeMessage } from "./whatsapp/messageRouter.js";
import { applyProfilePicture } from "./whatsapp/profile.js";
import { platformInfo } from "./utils/sysinfo.js";

const boot = async () => {
	printBanner();

	logger.info(`${config.botName} iniciando em ${platformInfo()}`);

	// --- Configuracao ------------------------------------------------
	const problems = validateConfig();
	if (problems.length > 0) {
		logger.warn("problemas de configuracao encontrados:");
		for (const problem of problems) console.log(colors.yellow(`   - ${problem}`));
	}

	// --- Provedor de LLM --------------------------------------------
	if (config.llm.apiKey) {
		const check = await checkLlmConnection();
		if (check.ok) {
			logger.ok(`provedor conectado: ${config.llm.baseUrl} (modelo ${config.llm.model})`);
		} else {
			logger.warn(`nao consegui falar com o provedor: ${check.reason}`);
			logger.warn("o bot conecta no WhatsApp, mas as respostas podem falhar.");
		}
	} else {
		logger.warn("sem OPENAI_API_KEY: o bot so vai executar comandos de midia.");
	}

	// --- WhatsApp ----------------------------------------------------
	const client = createClient();

	wireEvents({
		onQr: handleQr,

		onReady: async () => {
			console.clear();
			logger.ok(`conectado como ${getClient().info?.pushname ?? "?"}`);
			printReady();

			// Opcional: publica a arte da persona como foto de perfil.
			await applyProfilePicture({ client: getClient() });
		},

		onMessage: (message) => {
			// Nao bloqueia o event loop do client.
			routeMessage(message).catch((error) => logger.error(`handler: ${error.message}`));
		},

		onAuthFailure: (message) => {
			logger.error(`falha de autenticacao: ${message}`);
			logger.warn(`apague a pasta ${config.paths.auth} e tente de novo.`);
		},

		onDisconnected: (reason) => {
			logger.warn(`desconectado: ${reason}`);
			logger.info("o whatsapp-web.js tenta reconectar sozinho. Se nao voltar, reinicie o bot.");
		},
	});

	logger.info("abrindo o WhatsApp Web (pode levar alguns segundos)...");
	await client.initialize();
};

// --- Encerramento limpo ---------------------------------------------
const shutdown = async (signal) => {
	logger.warn(`recebi ${signal}, encerrando...`);
	try {
		await getClient().destroy();
	} catch {
		// client nem chegou a subir
	}
	process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
	logger.error(`promise rejeitada sem tratamento: ${reason}`);
});

boot().catch((error) => {
	logger.error(`falha no boot: ${error.message}`);
	logger.debug(error.stack);
	process.exit(1);
});
