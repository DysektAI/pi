# Changelog

## [Unreleased]

## [0.82.0] - 2026-07-24

### Breaking Changes

- Replaced `getBuiltinModelDataUrl(provider)` with `getBuiltinModelDataGeneratedAt()` so built-in catalog freshness uses its recorded generation time instead of installation-dependent file metadata ([#7016](https://github.com/earendil-works/pi/pull/7016) by [@davidbrai](https://github.com/davidbrai)).

### Added

- Added Kimi Code subscription OAuth login for the `kimi-coding` provider, with device authorization, token refresh, and OAuth host overrides ([#6935](https://github.com/earendil-works/pi/pull/6935) by [@zaycruz](https://github.com/zaycruz)).
- Added OpenRouter OAuth PKCE login that mints a user-controlled API key for chat and image providers ([#6927](https://github.com/earendil-works/pi/pull/6927) by [@rsaryev](https://github.com/rsaryev)).
- Added `Tool.constrainedSampling` with strict JSON Schema (`prefer`/`require`) and OpenAI Lark/regex grammar variants, enforcing provider-side constrained tool sampling across OpenAI, Anthropic, Amazon Bedrock, Google Gemini, and Mistral. See [Constrained Sampling for Tools](README.md#constrained-sampling-for-tools).
- Added `supportsGrammarTools` and `supportsStrictTools` compatibility flags, expanded `supportsStrictMode` to Responses and Bedrock models, and generated model capability metadata to gate constrained sampling.

### Changed

- Changed generated model catalogs to expose only provider-verified reasoning effort levels from models.dev ([#6928](https://github.com/earendil-works/pi/pull/6928) by [@davidbrai](https://github.com/davidbrai)).

### Fixed

- Fixed OpenAI Codex cached WebSocket continuations after grammar tool calls to send only the real tool-result delta.
- Fixed constrained tool sampling across Google, Amazon Bedrock, Mistral, and Azure OpenAI Responses adapters, including model-aware strict-tool capabilities, grammar configuration validation, and malformed grammar-call replay errors.
- Fixed `cacheRetention: "none"` to disable implicit prompt-cache writes for supported OpenAI models and session-based caching for OpenAI Codex ([#6618](https://github.com/earendil-works/pi/pull/6618) by [@tmustier](https://github.com/tmustier)).
- Fixed DNS lookup failures such as `getaddrinfo`, `ENOTFOUND`, and `EAI_AGAIN` to trigger automatic assistant retries ([#6946](https://github.com/earendil-works/pi/pull/6946) by [@christianklotz](https://github.com/christianklotz)).
- Fixed OpenAI Codex WebSocket sessions to retry once without a missing previous-response continuation after `previous_response_not_found` errors ([#6955](https://github.com/earendil-works/pi/pull/6955) by [@davidbrai](https://github.com/davidbrai)).
- Fixed OpenAI and Anthropic provider retry waits to honor abort signals and configured delay limits ([#6980](https://github.com/earendil-works/pi/pull/6980) by [@petrroll](https://github.com/petrroll)).
- Fixed OpenRouter Anthropic cache breakpoints to advance through tool results and enabled cache control for `~anthropic/*-latest` aliases ([#6941](https://github.com/earendil-works/pi/pull/6941) by [@mteam88](https://github.com/mteam88)).

## [0.81.1] - 2026-07-21

### Added

- Added `retryAssistantCall()` for bounded retries of transient assistant failures with lifecycle callbacks and abort handling ([#6901](https://github.com/earendil-works/pi/pull/6901) by [@davidbrai](https://github.com/davidbrai)).

### Fixed

- Fixed Kimi K3 models from Moonshot AI and Moonshot AI China to use the OpenAI thinking format and expose reasoning effort support.

## [0.81.0] - 2026-07-21

### Added

- Added Qwen Token Plan and Qwen Token Plan China as built-in providers with regional endpoints, API-key authentication, and generated model catalogs ([#6858](https://github.com/earendil-works/pi/pull/6858) by [@QuintinShaw](https://github.com/QuintinShaw)).
- Added `contentText` for extracting joined text from message content ([#6840](https://github.com/earendil-works/pi/pull/6840) by [@xl0](https://github.com/xl0)).
- Added a shared `uuidv7` utility for time-ordered identifiers ([#6834](https://github.com/earendil-works/pi/pull/6834) by [@xl0](https://github.com/xl0)).
- Added optional usage metadata to tool result messages ([#6671](https://github.com/earendil-works/pi/pull/6671) by [@davidbrai](https://github.com/davidbrai)).
