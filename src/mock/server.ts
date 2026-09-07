import { memberNotFoundPage, memberPage, lookupPage, KNOWN_MEMBER_ID, KNOWN_SAVINGS_BALANCE } from "./pages.ts";

export const MOCK_PORT = 47821;
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;

export function startMock(port = MOCK_PORT) {
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/" || url.pathname === "/lookup") {
        return html(lookupPage);
      }
      if (url.pathname === "/member") {
        const id = url.searchParams.get("id") ?? "";
        if (id === KNOWN_MEMBER_ID) {
          return html(memberPage(id, KNOWN_SAVINGS_BALANCE));
        }
        return html(memberNotFoundPage);
      }
      return new Response("Not found", { status: 404 });
    },
  });
}

function html(body: string) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
