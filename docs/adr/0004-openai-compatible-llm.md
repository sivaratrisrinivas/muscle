# Discovery talks OpenAI chat, not a vendor SDK

Discovery needs tool calls. Replay needs none. We will call an OpenAI-compatible Chat Completions API (`base URL` + `api key` + `model` from env) with tools `observe`, `act`, `finish`, `escalate`. Default host is Cerebras (`https://api.cerebras.ai/v1`, `gpt-oss-120b`) because it documents tools and the submitter has credit there. TensorMux is the same client with a different base URL. We do not bind the loop to the OpenAI platform or to a computer-use product.
