// The Backup container: a plain ustar archive (ADR-0024). Tar stores each file uncompressed and
// back to back, so an Attachment is copied in and out without being held whole, and there is no
// dependency to keep. Only what a Backup needs is here: regular files, short names, no directories.
import { closeSync, openSync, readSync, fstatSync } from 'node:fs';

const BLOCK = 512;
const CHUNK = 64 * 1024;
const MAX_SIZE = 8 ** 11 - 1; // the largest size the 11-digit octal field holds

export class BadArchive extends Error {}

const encoder = new TextEncoder();

function header(name: string, size: number): Uint8Array {
	if (name.length > 100) throw new Error(`Tar entry name too long: ${name}`);
	if (size > MAX_SIZE) throw new Error(`Tar entry too large: ${name}`);
	const block = new Uint8Array(BLOCK);
	const put = (offset: number, text: string) => block.set(encoder.encode(text), offset);

	put(0, name);
	put(100, '0000644\0');
	put(108, '0000000\0');
	put(116, '0000000\0');
	put(124, `${size.toString(8).padStart(11, '0')}\0`);
	put(136, '00000000000\0');
	put(148, '        '); // the checksum field counts as spaces while it is summed
	block[156] = 0x30; // '0': a regular file
	put(257, 'ustar\0');
	put(263, '00');
	put(148, `${checksum(block).toString(8).padStart(6, '0')}\0 `);
	return block;
}

function checksum(block: Uint8Array): number {
	let sum = 0;
	for (const byte of block) sum += byte;
	return sum;
}

function padding(size: number): Uint8Array {
	return new Uint8Array((BLOCK - (size % BLOCK)) % BLOCK);
}

/** The archive's total length: what a Content-Length has to say before the first byte is sent. */
export function tarLength(sizes: number[]): number {
	return sizes.reduce((sum, size) => sum + BLOCK + size + padding(size).length, 0) + 2 * BLOCK;
}

/**
 * Yields the archive one chunk at a time. Each file is opened when its turn comes and closed before
 * the next, so memory does not grow with the number of files. The size in a header is the size the
 * caller measured; a file that has changed length since is a fault, not something to paper over.
 * An entry that brings its own `fd` keeps it: the caller closes it.
 */
export async function* tarChunks(
	entries: { name: string; size: number; fd?: number; path?: string }[]
): AsyncGenerator<Uint8Array> {
	for (const entry of entries) {
		yield header(entry.name, entry.size);
		const fd = entry.fd ?? openSync(entry.path!, 'r');
		const owned = entry.fd === undefined;
		try {
			let sent = 0;
			while (sent < entry.size) {
				const chunk = new Uint8Array(Math.min(CHUNK, entry.size - sent));
				const read = readSync(fd, chunk, 0, chunk.length, sent);
				if (read !== chunk.length) throw new Error(`${entry.name} changed while it was read`);
				sent += read;
				yield chunk;
			}
		} finally {
			if (owned) closeSync(fd);
		}
		yield padding(entry.size);
	}
	yield new Uint8Array(2 * BLOCK);
}

export function sizeOfFd(fd: number): number {
	return fstatSync(fd).size;
}

class Reader {
	private buffer = new Uint8Array(0);
	private source: ReadableStreamDefaultReader<Uint8Array>;

	constructor(stream: ReadableStream<Uint8Array>) {
		this.source = stream.getReader();
	}

	/** Up to `n` bytes; fewer only at the end of the stream. */
	async take(n: number): Promise<Uint8Array> {
		while (this.buffer.length < n) {
			const { done, value } = await this.source.read();
			if (done) break;
			const joined = new Uint8Array(this.buffer.length + value.length);
			joined.set(this.buffer);
			joined.set(value, this.buffer.length);
			this.buffer = joined;
		}
		const out = this.buffer.subarray(0, n);
		this.buffer = this.buffer.subarray(out.length);
		return out;
	}
}

const decoder = new TextDecoder();

function parseHeader(block: Uint8Array): { name: string; size: number } {
	const stored = parseInt(decoder.decode(block.subarray(148, 154)), 8);
	const copy = block.slice();
	copy.fill(0x20, 148, 156);
	if (stored !== checksum(copy)) throw new BadArchive('Header checksum does not match.');

	if (block[156] !== 0x30 && block[156] !== 0) throw new BadArchive('Unsupported entry type.');
	const name = decoder.decode(block.subarray(0, 100)).split('\0')[0];
	const size = parseInt(decoder.decode(block.subarray(124, 135)), 8);
	if (!Number.isInteger(size) || size < 0) throw new BadArchive('Unreadable entry size.');
	return { name, size };
}

/**
 * Unpacks the archive, calling `write` for each entry to learn where it goes and writing the bytes
 * there a chunk at a time. `write` returns an open writer or throws `BadArchive` to refuse the
 * name. The archive must end with its two empty blocks, so a truncated file is refused.
 */
export async function untar(
	stream: ReadableStream<Uint8Array>,
	open: (name: string) => { write(chunk: Uint8Array): void; close(): void }
): Promise<void> {
	const reader = new Reader(stream);

	for (;;) {
		const block = await reader.take(BLOCK);
		if (block.length < BLOCK) throw new BadArchive('The archive ends early.');
		if (block.every((byte) => byte === 0)) {
			const second = await reader.take(BLOCK);
			if (second.length < BLOCK || !second.every((byte) => byte === 0)) {
				throw new BadArchive('The archive has no proper end.');
			}
			return;
		}

		const { name, size } = parseHeader(block);
		const out = open(name);
		try {
			let left = size;
			while (left > 0) {
				const chunk = await reader.take(Math.min(CHUNK, left));
				if (chunk.length === 0) throw new BadArchive('The archive ends early.');
				out.write(chunk);
				left -= chunk.length;
			}
		} finally {
			out.close();
		}
		const pad = padding(size).length;
		if ((await reader.take(pad)).length < pad) throw new BadArchive('The archive ends early.');
	}
}
