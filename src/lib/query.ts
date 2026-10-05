// The address of this page with one query parameter set or cleared, and the other parameters
// kept. A filter's value lives in the query string (issue #338), so it survives a reload and a
// Back into the page; the returned href drops the origin, so it navigates inside the app.
export function withParam(url: URL, param: string, value: string | null): string {
	const next = new URL(url);
	if (value === null) next.searchParams.delete(param);
	else next.searchParams.set(param, value);
	return `${next.pathname}${next.search}`;
}
