import QRCode from "qrcode";
import { logger } from "../utils/logger.js";

/** Mostra o QR no terminal (e gera o data URL para uso futuro, ex: painel web). */
export const showQrInTerminal = async (qr) => {
	try {
		const ascii = await QRCode.toString(qr, { type: "terminal", small: true });
		console.log(ascii);
		logger.info("Abra o WhatsApp > Dispositivos conectados > Conectar dispositivo e leia o QR acima.");
	} catch (error) {
		logger.error(`nao consegui desenhar o QR no terminal: ${error.message}`);
		console.log(qr);
	}
};

/** Retorna o QR como data URL PNG (util para uma interface web depois). */
export const qrToDataUrl = (qr) => QRCode.toDataURL(qr);
