export const KNOWN_MEMBER_ID = "12345";
export const KNOWN_SAVINGS_BALANCE = "$2,450.00";

const staffShell = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Harbor Credit Union — Staff</title>
<style>
  body { margin: 0; background: #d4d0c8; font: 12px Tahoma, Verdana, sans-serif; color: #000; }
  .banner { background: #003366; color: #fff; padding: 6px 10px; font-size: 14px; }
  .banner small { color: #99b; }
  table.outer { width: 100%; background: #d4d0c8; }
  table.panel { background: #fff; border: 2px solid #808080; }
  table.grid { border-collapse: collapse; }
  table.grid td { border: 1px solid #808080; padding: 4px 8px; }
  input[type="text"] { width: 140px; }
</style>
</head>
<body>
<div class="banner">Harbor Credit Union <small>Core Connect 4.2 — staff only</small></div>
`;

const foot = `
</body>
</html>
`;

export const lookupPage = `${staffShell}
<table class="outer"><tr><td>
<table class="outer"><tr><td>
<table class="panel" cellpadding="8"><tr><td>
<table><tr><td>Member lookup</td></tr>
<tr><td>
<form action="/member" method="get">
<table class="grid">
<tr><td>Member ID</td><td><input type="text" name="id"></td></tr>
<tr><td>&nbsp;</td><td><input type="submit" value="Search"></td></tr>
</table>
</form>
</td></tr>
</table>
</td></tr></table>
</td></tr></table>
</td></tr></table>
${foot}`;

export function memberPage(memberId: string, savings: string): string {
  return `${staffShell}
<table class="outer"><tr><td>
<table class="panel" cellpadding="8"><tr><td>
<table>
<tr><td>Member record</td></tr>
<tr><td>
<table class="grid">
<tr><td>Member</td><td>${memberId}</td></tr>
<tr><td>
<table class="grid">
<tr><td>Type</td><td>Available</td></tr>
<tr><td>Savings</td><td>${savings}</td></tr>
<tr><td>Checking</td><td>$318.42</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td><button type="button">Open sub-account</button></td></tr>
</table>
</td></tr></table>
</td></tr></table>
${foot}`;
}

export function sessionTimeoutPage(memberId: string): string {
  return `${staffShell}
<table class="outer"><tr><td>
<table class="panel" cellpadding="8"><tr><td>
<table>
<tr><td>Session timed out</td></tr>
<tr><td>Your staff session expired. Dismiss to continue the lookup.</td></tr>
<tr><td>
<form action="/member" method="get">
<input type="hidden" name="id" value="${memberId}">
<input type="hidden" name="resume" value="1">
<input type="submit" value="Dismiss">
</form>
</td></tr>
</table>
</td></tr></table>
</td></tr></table>
${foot}`;
}

export function unexpectedDialogPage(memberId: string): string {
  return `${staffShell}
<table class="outer"><tr><td>
<div role="dialog" aria-label="System message">
<table class="panel" cellpadding="8"><tr><td>
<table>
<tr><td>Unexpected system message</td></tr>
<tr><td>Batch job 4412 failed. Contact operations.</td></tr>
<tr><td>
<form action="/member" method="get">
<input type="hidden" name="id" value="${memberId}">
<input type="hidden" name="ack" value="1">
<input type="submit" value="OK">
</form>
</td></tr>
</table>
</td></tr></table>
</div>
</td></tr></table>
${foot}`;
}

export const memberNotFoundPage = `${staffShell}
<table class="outer"><tr><td>
<table class="panel" cellpadding="8"><tr><td>Member not found</td></tr></table>
</td></tr></table>
${foot}`;
