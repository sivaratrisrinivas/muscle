# Playwright, accessibility first, screenshots for evidence

We need a live surface that still works when markup is hostile, and a replay path that does not guess. Discovery sends the accessibility tree to the model each turn. Screenshots are written on failure (and at the end of a run) for evidence. They are not model input. Replay acts through a two-step locator chain: role and name, then visible text. We rejected CSS/XPath, pixel coordinates, and table-index fallbacks.
