/**
 * Loader de teste: substitui o client do WhatsApp, o módulo de LLM e o
 * SDK da OpenAI por dublês, para exercitar o pipeline completo de
 * conversa sem precisar de Chromium nem de API key.
 *
 * Os dublês são servidos como data: URLs (esquema permitido pelo loader
 * padrão do Node), evitando a necessidade de encadear loaders.
 *
 * Uso: node --import ./scripts/loader.mock.mjs scripts/pipeline.test.mjs
 */

const SOURCES = {
	// --- dublê do client do WhatsApp -----------------------------------
	"whatsapp/client.js": `
		export const getClient = () => ({
			info: { wid: { _serialized: "551100000000@c.us" }, pushname: "Pipoca" },
		});

		export const createClient = getClient;
		export const wireEvents = () => ({});
		export const handleQr = async () => {};
		export const getBotId = () => "551100000000@c.us";
	`,

	// --- dublê do módulo de LLM ----------------------------------------
	"llm/client.js": `
		// Objetos mutáveis exportados: o namespace de um módulo ESM é
		// congelado, então os testes alteram PROPRIEDADES destes objetos.
		export const state = {
			lastCall: null,
			reply: "oi, tudo bem?",
		};

		export const generateReply = async ({ systemPrompt, messages }) => {
			state.lastCall = { systemPrompt, messages };
			return { text: state.reply, model: "mock-model", usage: {} };
		};

		export const sanitizeReply = (t) => String(t ?? "").trim();
		export const transcribeAudio = async () => "transcricao de teste";
		export const describeImages = async () => null;
		export const checkLlmConnection = async () => ({ ok: true });
		export const getLlm = () => ({});
	`,

	// --- dublê do SDK da OpenAI (caso algo escape) ---------------------
	openai: `
		export default class OpenAI {
			constructor() {
				this.chat = {
					completions: {
						create: async () => ({ choices: [{ message: { content: "mock" } }] }),
					},
				};
			}
			static async toFile() { return {}; }
		}
		export const toFile = async () => ({});
	`,
};

const MOCK_URLS = Object.fromEntries(
	Object.entries(SOURCES).map(([key, source]) => [
		key,
		`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`,
	])
);

export async function resolve(specifier, context, nextResolve) {
	const normalized = specifier.split("\\").join("/");
	if (process.env.MOCK_DEBUG) console.error(`[mock] resolve: ${specifier}`);

	for (const key of Object.keys(MOCK_URLS)) {
		if (normalized === key || normalized.endsWith(`/${key}`)) {
			if (process.env.MOCK_DEBUG) console.error(`[mock]   -> interceptado como ${key}`);
			return { url: MOCK_URLS[key], shortCircuit: true };
		}
	}

	return nextResolve(specifier, context);
}
