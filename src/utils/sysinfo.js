import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { config } from "../config/env.js";

let cached;

/**
 * Descobre um ffmpeg utilizavel, na ordem:
 *   1. FFMPEG_PATH do .env
 *   2. ffmpeg-static (se estiver instalado)
 *   3. ffmpeg / ffmpeg.exe no PATH
 * Retorna o caminho ou null (o whatsapp-web.js usa o do sistema nesse caso).
 */
export const resolveFfmpegPath = () => {
	if (cached !== undefined) return cached;

	// 1) .env
	if (config.ffmpegPath) {
		const fromEnv = path.isAbsolute(config.ffmpegPath)
			? config.ffmpegPath
			: path.join(config.paths.root, config.ffmpegPath);

		if (fs.existsSync(fromEnv)) {
			cached = fromEnv;
			return cached;
		}
	}

	// 2) binario local do projeto
	const localName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
	const local = path.join(config.paths.root, localName);
	if (fs.existsSync(local)) {
		cached = local;
		return cached;
	}

	// 3) PATH
	const fromPath = findInPath(localName);
	cached = fromPath ?? null;
	return cached;
};

const findInPath = (binary) => {
	const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);

	for (const dir of dirs) {
		try {
			const candidate = path.join(dir, binary);
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
		} catch {
			// diretorio ilegivel: ignora
		}
	}

	return null;
};

/** Caminho temporario unico dentro de <raiz>/tmp. */
export const tmpFilePath = (extension = "") => {
	const dir = config.paths.tmp;
	fs.mkdirSync(dir, { recursive: true });

	const name = `pipoca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
	return path.join(dir, name);
};

/** Locais padrao do Chrome instalado, por sistema operacional. */
const chromeCandidates = () => {
	switch (process.platform) {
		case "win32":
			return [
				"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
				"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
				process.env.LOCALAPPDATA
					? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
					: null,
			];
		case "darwin":
			return [
				"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
				"/Applications/Chromium.app/Contents/MacOS/Chromium",
			];
		default:
			return [
				"/usr/bin/google-chrome",
				"/usr/bin/google-chrome-stable",
				"/usr/bin/chromium",
				"/usr/bin/chromium-browser",
				"/snap/bin/chromium",
			];
	}
};

/**
 * Descobre um Chrome/Chromium utilizavel, na ordem:
 *   1. CHROME_PATH do .env
 *   2. Chrome instalado no sistema
 *   3. null -> deixa o puppeteer usar o Chromium que ele baixou
 *
 * Ter a opcao 2 evita os ~150 MB de download do puppeteer para quem
 * ja tem o Chrome instalado.
 */
export const resolveChromePath = () => {
	const explicit = config.chromePath;

	if (explicit) {
		const resolved = path.isAbsolute(explicit) ? explicit : path.join(config.paths.root, explicit);
		if (fs.existsSync(resolved)) return resolved;

		// Caminho informado mas inexistente: avisa e cai na deteccao.
		console.warn(`[pipoca] CHROME_PATH aponta para um arquivo inexistente: ${resolved}`);
	}

	for (const candidate of chromeCandidates()) {
		if (!candidate) continue;
		try {
			if (fs.existsSync(candidate)) return candidate;
		} catch {
			// caminho ilegivel: ignora
		}
	}

	return null;
};

export const platformInfo = () => `${os.platform()} ${os.release()} / node ${process.version}`;
