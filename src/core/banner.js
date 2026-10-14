import fs from "node:fs";
import path from "node:path";
import colors from "colors";
import { config } from "../config/env.js";
import { persona } from "../persona/persona.js";
import { logger } from "../utils/logger.js";

/**
 * Banner ASCII do boot.
 * Se existir <raiz>/console.txt, ele e impresso (como na Monra).
 * Caso contrario, usa o banner padrao da Pipoca.
 */
const DEFAULT_BANNER = String.raw`
   ___  _                            
  / _ \(_)__  ___  ___  ___ _          
 / ___/ / _ \/ _ \/ _ \/ _ \/ /         
/_/  /_/ .__/\___/\___/\___/_/          
      /_/                               
`;

/** Le a versao do package.json, para nao existirem duas verdades. */
const readVersion = () => {
	try {
		const raw = fs.readFileSync(path.join(config.paths.root, "package.json"), "utf8");
		return JSON.parse(raw).version ?? "?";
	} catch {
		return "?";
	}
};

export const printBanner = () => {
	let art = DEFAULT_BANNER;

	try {
		const custom = fs.readFileSync(config.paths.banner, "utf8");
		if (custom.trim() !== "") art = custom;
	} catch {
		// console.txt nao existe -> banner padrao
	}

	console.log(colors.magenta(art));
	console.log(colors.magenta(`  ${config.botName} v${readVersion()}`));
	console.log(colors.gray(`  persona: ${personaLine()}`));
	console.log("");
};

/** Resumo curto da persona, so para o banner. */
const personaLine = () => {
	const species = persona?.identity?.species;
	const model = config.llm.model;

	return [species ? `${species}` : config.botName, `modelo: ${model}`].join(" | ");
};

export const printReady = () => {
	logger.ok(`${config.botName} esta online e ouvindo o WhatsApp.`);
};
