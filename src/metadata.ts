import axios from "axios";
import domino from "domino";
import iconv from "iconv-lite";
import { getMetadata, type IPageMetadata } from "page-metadata-parser";
import { detectEncode } from "./encoding";

export class MetadataParseError extends Error {
	constructor(
		public statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "MetadataParseError";
	}
}

export async function fetchPageMetadata(url: string): Promise<{
	metadata: IPageMetadata;
	responseUrl: string;
}> {
	const r = await axios.get<Buffer>(encodeURI(url), {
		headers: { "User-Agent": "Twitterbot/1.0" },
		responseType: "arraybuffer",
		validateStatus: () => true,
	});

	if (r.status !== 200) {
		throw new MetadataParseError(
			r.status,
			`remote status code was ${r.status}`,
		);
	}

	if (![r.headers["content-type"]].flat().shift()?.startsWith("text/html")) {
		throw new MetadataParseError(400, "remote content was not html");
	}

	const buf = r.data;
	let html: string;
	const encoding = detectEncode(buf);
	if (encoding) {
		html = iconv.decode(buf, encoding);
	} else {
		html = buf.toString("ascii");
	}

	const { document } = domino.createWindow(html);
	const responseUrl = r.request?.res?.responseUrl || url;
	const metadata = getMetadata(document, responseUrl);

	return { metadata, responseUrl };
}

export type { IPageMetadata };
