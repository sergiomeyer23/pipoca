/**
 * Registra os dublês de teste (WhatsApp e LLM) via module.register(),
 * que é a API do Node que realmente ativa o hook de resolução.
 *
 * Uso: node --import ./scripts/loader.register.mjs scripts/pipeline.test.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./loader.mock.mjs", pathToFileURL(import.meta.filename));
