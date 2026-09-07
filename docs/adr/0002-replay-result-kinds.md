# Replay ends in success, business outcome, or failure

Callers need to tell “no such member” from a broken step. A replay returns one of `success` (checkpoint held, outputs filled), `business_outcome` (coded app result), or `failure` (step, expected, observed). Retrying a slow load or dismissing a known interstitial is a recoverable condition handled inside a step. It is not a fourth terminal kind.
