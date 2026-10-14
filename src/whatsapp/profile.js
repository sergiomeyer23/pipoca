import fs from "node:fs";
import path from "node:path";
import wwebjs from "whatsapp-web.js";
import { config } from "../config/env.js";
import { persona } from "../persona/persona.js";
import { logger } from "../utils/logger.js";

const { MessageMedia } = wwebjs;

/**
 * Define a foto de perfil da conta com a arte do avatar.
 *
 * Fica atras de SET_PROFILE_PICTURE=true no .env (padrao: false) porque
 * troca uma coisa visivel na sua conta do WhatsApp — nao deve acontecer
 * sem voce pedir.
 *
 * Nunca derruba o boot: se falhar, avisa e segue.
 */
export const applyProfilePicture = async ({ client, force = false } = {}) => {
	if (!config.setProfilePicture && !force) return { skipped: true };

	const relative = persona?.avatar?.imagePath;
	if (!relative) {
		logger.warn("SET_PROFILE_PICTURE esta ligado, mas a persona nao define avatar.imagePath.");
		return { ok: false, reason: "avatar.imagePath vazio" };
	}

	const absolute = path.join(config.paths.root, relative);

	if (!fs.existsSync(absolute)) {
		logger.warn(`SET_PROFILE_PICTURE esta ligado, mas a arte nao existe: ${absolute}`);
		logger.info("gere com: python scripts/make-avatar.py");
		return { ok: false, reason: "arquivo nao encontrado" };
	}

	try {
		const media = MessageMedia.fromFilePath(absolute);
		const ok = await client.setProfilePicture(media);

		if (ok) logger.ok(`foto de perfil atualizada: ${relative}`);
		else logger.warn("o WhatsApp recusou a troca da foto de perfil.");

		return { ok: Boolean(ok) };
	} catch (error) {
		logger.warn(`nao consegui trocar a foto de perfil: ${error.message}`);
		return { ok: false, reason: error.message };
	}
};
