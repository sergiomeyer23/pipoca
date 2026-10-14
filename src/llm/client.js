import OpenAI from "openai";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

let client;

/** Cliente da API (lazy: so falha quando realmente for usar). */
export const getLlm = () => {
	if (!config.llm.apiKey) {
		throw new Error(
			"OPENAI_API_KEY nao configurada. Preencha o .env para o bot conseguir responder."
		);
	}

	if (!client) {
		client = new OpenAI({
			apiKey: config.llm.apiKey,
			baseURL: config.llm.baseUrl,
		});
	}

	return client;
};

/** Limpa sobras que alguns modelos insistem em mandar. */
export const sanitizeReply = (text) => {
	let out = String(text ?? "").trim();

	// Remove cercas de codigo
	if (out.startsWith("```") && out.endsWith("```")) {
		out = out.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
	}

	// Remove aspas envolvendo a resposta inteira
	if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
		if (!out.slice(1, -1).includes(out[0])) out = out.slice(1, -1).trim();
	}

	// Remove prefixos tipo "Pipoca:" / "Assistente:"
	out = out.replace(/^(assistant|assistente|bot|resposta)\s*:\s*/i, "");
	out = out.replace(new RegExp(`^${config.botName}\\s*:\\s*`, "i"), "");

	return out.trim();
};

/** Junta o system prompt com o historico e chama o modelo. */
const callModel = async (model, { systemPrompt, messages }) => {
	const llm = getLlm();

	const completion = await llm.chat.completions.create({
		model,
		messages: [{ role: "system", content: systemPrompt }, ...messages],
		temperature: 0.9,
		max_tokens: 500,
	});

	const raw = completion.choices?.[0]?.message?.content ?? "";
	return { text: sanitizeReply(raw), model, usage: completion.usage };
};

/**
 * Marca o erro como "esperado" (chave invalida, modelo inexistente,
 * rede fora). O terminal de chat usa isso para mostrar so a mensagem,
 * sem um stack trace que assusta e nao ajuda.
 */
const expected = (error, message) => {
	const wrapped = new Error(message);
	wrapped.expected = true;
	wrapped.cause = error;
	return wrapped;
};

/**
 * Gera uma resposta. Se o MODEL principal falhar, tenta o
 * FALLBACK_MODEL (mesma ideia da Monra, mas com erro mais claro).
 */
export const generateReply = async ({ systemPrompt, messages }) => {
	const primary = config.llm.model;
	const fallback = config.llm.fallbackModel;

	try {
		const result = await callModel(primary, { systemPrompt, messages });
		if (!result.text) throw new Error("resposta vazia");
		return result;
	} catch (error) {
		logger.warn(`modelo "${primary}" falhou: ${error.message}`);

		if (!fallback || fallback === primary) {
			throw expected(error, `Falha ao gerar resposta com "${primary}": ${error.message}`);
		}

		try {
			const result = await callModel(fallback, { systemPrompt, messages });
			if (!result.text) throw new Error("resposta vazia");
			logger.info(`fallback "${fallback}" respondeu.`);
			return result;
		} catch (fallbackError) {
			throw expected(
				fallbackError,
				`"${primary}" falhou (${error.message}) e o fallback "${fallback}" tambem (${fallbackError.message}).`
			);
		}
	}
};

/**
 * Define um lembrete curto para a imagem recebida.
 * Usado quando VISION_ENABLED=true e o modelo nao aceita imagem.
 */
export const describeImages = async (images = []) => {
	if (images.length === 0) return null;

	try {
		const llm = getLlm();
		const content = [
			{
				type: "text",
				text: "Descreva em uma frase curta e objetiva o que aparece nesta imagem. Responda so a descricao.",
			},
			...images.map((image) => ({
				type: "image_url",
				image_url: { url: image.dataUrl },
			})),
		];

		const completion = await llm.chat.completions.create({
			model: config.llm.model,
			messages: [{ role: "user", content }],
			max_tokens: 120,
		});

		const text = completion.choices?.[0]?.message?.content;
		return text ? sanitizeReply(text) : null;
	} catch (error) {
		logger.warn(`nao consegui descrever a imagem: ${error.message}`);
		return null;
	}
};

/** Transcreve audio/video (whisper). Recebe um Buffer. */
export const transcribeAudio = async (buffer, filename = "audio.ogg") => {
	const llm = getLlm();

	const { toFile } = OpenAI;
	const file = await toFile(buffer, filename);

	const result = await llm.audio.transcriptions.create({
		file,
		model: "whisper-1",
	});

	return String(result?.text ?? "").trim();
};

/** Testa a conexao com o provedor no boot. Nao derruba o bot se falhar. */
export const checkLlmConnection = async () => {
	if (!config.llm.apiKey) return { ok: false, reason: "OPENAI_API_KEY ausente" };

	try {
		const llm = getLlm();
		await llm.models.list();
		return { ok: true };
	} catch (error) {
		return { ok: false, reason: error.message };
	}
};
