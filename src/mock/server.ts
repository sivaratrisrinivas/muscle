import { memberNotFoundPage, memberPage, lookupPage, sessionTimeoutPage, unexpectedDialogPage, KNOWN_MEMBER_ID, KNOWN_SAVINGS_BALANCE } from "./pages.ts";

export const MOCK_PORT = 47821;
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;

export function startMock(port = MOCK_PORT) {
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      const inject = readCookie(req, "inject") || url.searchParams.get("inject") || "";

      if (url.pathname === "/" || url.pathname === "/lookup") {
        return html(lookupPage);
      }
      if (url.pathname === "/member") {
        const id = url.searchParams.get("id") ?? "";
        const resumed = url.searchParams.get("resume") === "1" || readCookie(req, "timeout_cleared") === "1";
        const acked = url.searchParams.get("ack") === "1" || readCookie(req, "dialog_acked") === "1";
        if (inject === "member_not_found") {
          return html(memberNotFoundPage);
        }
        if (inject === "unexpected_dialog" && !acked) {
          return html(unexpectedDialogPage(id));
        }
        if (inject === "session_timeout" && !resumed) {
          return html(sessionTimeoutPage(id));
        }
        const headers: Record<string, string> = {};
        if (inject === "session_timeout" && resumed) {
          headers["set-cookie"] = "timeout_cleared=1; Path=/";
        }
        if (inject === "unexpected_dialog" && acked) {
          headers["set-cookie"] = "dialog_acked=1; Path=/";
        }
        if (id === KNOWN_MEMBER_ID) {
          return html(memberPage(id, KNOWN_SAVINGS_BALANCE), headers);
        }
        return html(memberNotFoundPage, headers);
      }
      return new Response("Not found", { status: 404 });
    },
  });
}

function readCookie(req: Request, name: string): string {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

function html(body: string, extra: Record<string, string> = {}) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", ...extra },
  });
}
