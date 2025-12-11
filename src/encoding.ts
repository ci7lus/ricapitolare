import jschardet from "jschardet";

/**
 * https://github.com/ktty1220/cheerio-httpcli/blob/5c82439074a41117bb3a853dcee983b9c0862d60/lib/encoding.js
 */

const headRegex = /<head[\s>]([\s\S]*?)<\/head>/i;
const charsetRegex = /<meta[^>]*[\s;]+charset\s*=\s*["']?([\w\-_]+)["']?/i;

const detectEncodeByHeader = (buf: Buffer) => {
	const head = buf.toString("ascii").match(headRegex);
	if (!head) return null;
	const charset = head[1].match(charsetRegex);
	if (!charset) return null;
	return charset[1].trim().toLowerCase();
};

const detectEncodeByBuffer = (buf: Buffer) => {
	const detected = jschardet.detect(buf);
	return detected?.encoding && (detected.confidence || 0) >= 0.99
		? detected.encoding.toLowerCase()
		: null;
};

export const detectEncode = (buf: Buffer) => {
	const encoding = detectEncodeByHeader(buf) || detectEncodeByBuffer(buf);
	return encoding && ["shift_jis", "sjis"].includes(encoding)
		? "CP932"
		: encoding;
};
