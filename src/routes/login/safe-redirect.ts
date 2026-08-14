// A bare startsWith('/') also matches protocol-relative URLs like //evil.example, which browsers
// treat as a same-scheme redirect off-site.
export function safeRedirectTarget(target: string | null) {
	return target?.startsWith('/') && !target.startsWith('//') ? target : '/';
}
