# Discovery talks OpenAI chat, not a vendor SDK

Discovery needs tool calls. Replay needs none. We will call an OpenAI-compatible Chat Completions API (`base URL` + `api key` + `model` from env). Each turn we attach a fresh accessibility snapshot. Tools are `act`, `finish`, and `escalate` only. There is no observe tool. Default host is Cerebras (`https://api.cerebras.ai/v1`, `gpt-oss-120b`). TensorMux is the same client with a different base URL.
