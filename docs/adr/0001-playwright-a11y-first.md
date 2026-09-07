# Playwright, accessibility first, pixels only for discovery

We need a live surface that still works when markup is hostile, and a replay path that does not guess. Discovery uses Playwright with an accessibility snapshot plus a screenshot. Replay acts only through a locator chain (role and name, then text, then structure). We rejected CSS/XPath as the strategy (it assumes a clean DOM) and screenshot coordinates on replay (they break on scroll and DPI).
