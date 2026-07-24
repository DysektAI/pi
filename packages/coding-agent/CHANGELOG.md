# Changelog

## [Unreleased]

## [0.82.0] - 2026-07-24

### New Features

- **Constrained tool sampling** — Tools can prefer or require strict JSON Schema sampling or use OpenAI Lark/regex grammars, with model capability metadata preventing unsupported requests. See [Constrained Sampling for Tools](../ai/README.md#constrained-sampling-for-tools).
- **OpenRouter and Kimi Code sign-in** — Use `/login` to authorize OpenRouter or a Kimi Code subscription without manually configuring API keys. See [OpenRouter](docs/providers.md#openrouter).
- **Session-aware, streaming bash integrations** — Bash tools receive current session/model metadata, while direct RPC bash commands stream correlated output. See [Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment) and [RPC bash events](docs/rpc.md#bash_execution_update).

### Added

- Added inherited `Tool.constrainedSampling` with strict JSON Schema (`prefer`/`require`) and OpenAI Lark/regex grammar variants across OpenAI, Anthropic, Amazon Bedrock, Google Gemini, and Mistral. See [Constrained Sampling for Tools](../ai/README.md#constrained-sampling-for-tools).
- Added inherited `supportsGrammarTools` and `supportsStrictTools` compatibility flags, expanded `supportsStrictMode` coverage, and generated model capability metadata to gate constrained sampling.
- Added inherited Kimi Code subscription OAuth login for the Kimi For Coding provider, including device authorization and automatic token refresh ([#6935](https://github.com/earendil-works/pi/pull/6935) by [@zaycruz](https://github.com/zaycruz)).
- Added inherited OpenRouter OAuth PKCE login through `/login`, minting a user-controlled API key. See [OpenRouter](docs/providers.md#openrouter) ([#6927](https://github.com/earendil-works/pi/pull/6927) by [@rsaryev](https://github.com/rsaryev)).
- Exposed `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, and `PI_REASONING_LEVEL` to commands run by built-in and factory-created bash tools. See [Bash Tool Session Environment](docs/environment-variables.md#bash-tool-session-environment).
- Added streaming `bash_execution_update` events for direct RPC bash commands, correlated with request IDs. See [RPC bash events](docs/rpc.md#bash_execution_update) ([#6971](https://github.com/earendil-works/pi/pull/6971) by [@ananthakumaran](https://github.com/ananthakumaran)).

### Changed

- Changed inherited generated model catalogs to expose only provider-verified reasoning effort levels from models.dev ([#6928](https://github.com/earendil-works/pi/pull/6928) by [@davidbrai](https://github.com/davidbrai)).

### Fixed

- Fixed inherited DNS lookup failures such as `getaddrinfo`, `ENOTFOUND`, and `EAI_AGAIN` to trigger automatic assistant retries ([#6946](https://github.com/earendil-works/pi/pull/6946) by [@christianklotz](https://github.com/christianklotz)).
- Fixed inherited OpenRouter Anthropic cache breakpoints to advance through tool results and enabled cache control for `~anthropic/*-latest` aliases ([#6941](https://github.com/earendil-works/pi/pull/6941) by [@mteam88](https://github.com/mteam88)).
- Fixed inherited OpenAI Codex WebSocket sessions to retry once without a missing previous-response continuation after `previous_response_not_found` errors ([#6955](https://github.com/earendil-works/pi/pull/6955) by [@davidbrai](https://github.com/davidbrai)).
- Fixed TUI debug and crash logs to respect custom agent directories instead of always writing under `~/.pi/agent` ([#6958](https://github.com/earendil-works/pi/pull/6958) by [@davidbrai](https://github.com/davidbrai)).
- Fixed slow Ctrl+G external-editor startup when the system temporary directory contains many entries ([#6903](https://github.com/earendil-works/pi/pull/6903) by [@christianklotz](https://github.com/christianklotz)).
- Fixed startup resource display to preserve relative paths for sibling npm extensions loaded by a package ([#6964](https://github.com/earendil-works/pi/pull/6964) by [@davidbrai](https://github.com/davidbrai)).
- Fixed compaction and branch-summary requests to use fresh routing session IDs with prompt caching disabled where supported ([#6618](https://github.com/earendil-works/pi/pull/6618) by [@tmustier](https://github.com/tmustier)).
- Fixed explicit self-updates when `PI_SKIP_VERSION_CHECK` is set ([#6977](https://github.com/earendil-works/pi/issues/6977)).
- Fixed scoped model IDs containing brackets to resolve as literal exact matches before glob matching ([#6210](https://github.com/earendil-works/pi/issues/6210)).
- Fixed inherited OpenAI and Anthropic provider retry waits to honor abort signals and configured delay limits ([#6980](https://github.com/earendil-works/pi/pull/6980) by [@petrroll](https://github.com/petrroll)).
- Fixed fresh installs from preferring bundled model catalogs over newer remote catalogs because package file mtimes were newer ([#7016](https://github.com/earendil-works/pi/pull/7016) by [@davidbrai](https://github.com/davidbrai)).
- Fixed inherited editor scroll indicators overflowing narrow terminals ([#7015](https://github.com/earendil-works/pi/pull/7015) by [@christianklotz](https://github.com/christianklotz)).
- Fixed llama.cpp models to use the loaded context window as their output token limit instead of capping it at 16K ([#7034](https://github.com/earendil-works/pi/pull/7034) by [@christianklotz](https://github.com/christianklotz)).
- Fixed release source archives to include the generated provider model data used to build standalone binaries.
- Updated the packaged `protobufjs` dependency to 7.6.5 to address GHSA-j3f2-48v5-ccww ([#7005](https://github.com/earendil-works/pi/issues/7005)).
- Fixed `/copy` on Wayland to fall back to X11 or OSC 52 when `wl-copy` fails ([#7009](https://github.com/earendil-works/pi/pull/7009) by [@rkfshakti](https://github.com/rkfshakti)).
- Fixed `/model` to reload updated `models.json` configuration when opening the model picker ([#6999](https://github.com/earendil-works/pi/issues/6999)).

## [0.81.1] - 2026-07-21

### New Features

- **Verifiable release source archives** — GitHub releases now include deterministic, checksummed source archives with instructions for rebuilding standalone binaries. See [Building standalone binaries from release source](../../README.md#building-standalone-binaries-from-release-source).
- **Resilient compaction and branch summaries** — Transient provider failures now follow the configured retry policy, with retry lifecycle events available to interactive, JSON, RPC, and SDK consumers. See [Compaction & Branch Summarization](docs/compaction.md) and [RPC retry events](docs/rpc.md#summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished).

### Added

- Added deterministic, checksummed source archives to GitHub releases with documented standalone binary rebuild instructions ([#6913](https://github.com/earendil-works/pi/pull/6913) by [@christianklotz](https://github.com/christianklotz)).

### Fixed

- Fixed compaction and branch summarization to retry transient provider failures using the configured retry policy, with retry lifecycle events exposed to interactive, JSON, RPC, and SDK consumers ([#6901](https://github.com/earendil-works/pi/pull/6901) by [@davidbrai](https://github.com/davidbrai)).
- Fixed interactive startup waiting for background model catalog refresh while computing the footer provider count.
- Restored the default stream fallback for extensions using the pre-0.81 agent-core API ([#6915](https://github.com/earendil-works/pi/issues/6915)).
- Fixed inherited Kimi K3 models from Moonshot AI and Moonshot AI China to use the OpenAI thinking format and expose reasoning effort support.

## [0.81.0] - 2026-07-21

### New Features

- **Local llama.cpp model management** — Connect to a llama.cpp router, search and download Hugging Face models, and explicitly load or unload models with live progress. See [llama.cpp](docs/llama-cpp.md).
- **Full provider extensions** — Extensions can register complete pi-ai providers with authentication, model refresh, filtering, and custom streaming. See [Register New Provider](docs/custom-provider.md#register-new-provider).
- **Qwen Token Plan providers** — Use the built-in international and China subscription providers with regional endpoints and API-key authentication. See [API Keys](docs/providers.md#api-keys).
- **Expanded usage accounting** — Tool, compaction, and branch-summary usage is persisted and included in session totals. See [Compaction & Branch Summarization](docs/compaction.md).

### Added

- Added Qwen Token Plan and Qwen Token Plan China to built-in provider setup, default model resolution, and provider documentation ([#6858](https://github.com/earendil-works/pi/pull/6858) by [@QuintinShaw](https://github.com/QuintinShaw)).
- Added the `get_available_thinking_levels` RPC command and `RpcClient.getAvailableThinkingLevels()` method ([#6865](https://github.com/earendil-works/pi/pull/6865) by [@cristinaponcela](https://github.com/cristinaponcela)).
- Exported message and tool execution lifecycle event types from the package root ([#6772](https://github.com/earendil-works/pi/pull/6772) by [@davidbrai](https://github.com/davidbrai)).
- Added built-in llama.cpp router support with `/login` connection setup and `/llama` Hugging Face model search and downloads, explicit loading, unloading, and live progress. See [llama.cpp](docs/llama-cpp.md).
- Added extension registration for complete pi-ai providers, including native authentication, model refresh, filtering, and streaming behavior.
- Added usage accounting for tools, compaction, and branch summaries in persisted sessions, footer totals, and session statistics ([#6671](https://github.com/earendil-works/pi/pull/6671) by [@davidbrai](https://github.com/davidbrai)).

### Fixed

- Updated the packaged `brace-expansion` dependency to 5.0.7 ([#6896](https://github.com/earendil-works/pi/pull/6896) by [@davidbrai](https://github.com/davidbrai)).
- Fixed persisted remote model catalogs from overriding newer bundled catalogs after an upgrade.
- Fixed inherited stored API-key credentials to apply their provider-scoped `env` values, including Amazon Bedrock profiles ([#6864](https://github.com/earendil-works/pi/pull/6864) by [@cristinaponcela](https://github.com/cristinaponcela)).
- Fixed inherited OpenAI-compatible cross-provider replay to keep tool call IDs unique when multiple calls share a provider call ID ([#6854](https://github.com/earendil-works/pi/pull/6854) by [@cristinaponcela](https://github.com/cristinaponcela)).
- Fixed inherited Kimi K3 thinking levels to expose low, high, and max, and normalized the `k2p7` alias to `kimi-for-coding`.
- Fixed inherited OpenCode Go models routed through the OpenAI Responses API.
- Fixed inherited `pi-ai` package metadata to avoid repeated consumer lockfile changes ([#6812](https://github.com/earendil-works/pi/pull/6812) by [@jmfederico](https://github.com/jmfederico)).
- Fixed inherited terminal shutdown to clear the editor's inverted software cursor before restoring the hardware cursor ([#6790](https://github.com/earendil-works/pi/pull/6790) by [@dam9000](https://github.com/dam9000)).
- Fixed inherited ANSI-aware text wrapping to recognize CRLF and CR line endings while preserving styles ([#6764](https://github.com/earendil-works/pi/pull/6764) by [@xz-dev](https://github.com/xz-dev)).
- Fixed inherited editor paste registry corruption after deleting and undoing paste markers, preventing literal or mismatched paste markers in submitted prompts ([#6844](https://github.com/earendil-works/pi/issues/6844)).
- Fixed sessionless OpenAI Codex WebSocket requests to use UUIDv7 request IDs ([#6834](https://github.com/earendil-works/pi/pull/6834) by [@xl0](https://github.com/xl0)).
- Fixed inherited GPT-5.6 Codex models to default to the 272K context window, avoiding automatic long-context pricing ([#6853](https://github.com/earendil-works/pi/pull/6853) by [@aadishv](https://github.com/aadishv)).
- Fixed messages queued during compaction to preserve steering and follow-up delivery behavior ([#6730](https://github.com/earendil-works/pi/pull/6730) by [@dannote](https://github.com/dannote)).
- Fixed read tool errors being syntax-highlighted as if they were file contents ([#6731](https://github.com/earendil-works/pi/pull/6731) by [@dannote](https://github.com/dannote)).
- Fixed llama.cpp router download progress updates and removed redundant wording from model action confirmations.
- Moved automatic model catalog network refresh out of startup initialization and into the running interactive and RPC modes.
- Fixed persisted sessions being read and parsed twice when opened, reducing startup latency for large sessions ([#6793](https://github.com/earendil-works/pi/issues/6793)).
- Fixed prompt-template defaults for all arguments (`${@:-default}` and `${ARGUMENTS:-default}`) ([#6695](https://github.com/earendil-works/pi/issues/6695)).
- Fixed obsolete custom UI, custom tool, and custom editor examples in the extension documentation ([#6735](https://github.com/earendil-works/pi/issues/6735)).
- Fixed Kimi Coding sessions to show API-equivalent implied costs with the subscription indicator.
- Fixed OpenAI Responses early stream endings to trigger automatic retry instead of ending the agent run ([#6727](https://github.com/earendil-works/pi/issues/6727)).

## [0.80.10] - 2026-07-16

### New Features

- **Kimi Coding thinking compatibility** — Kimi Coding models now use adaptive thinking correctly; K3 exposes its supported `max` level and supports replaying empty-signature thinking blocks. See [Kimi For Coding setup](docs/providers.md#api-keys) and [Model Options](docs/usage.md#model-options).

### Fixed

- Fixed inherited Kimi Coding requests to use Anthropic adaptive thinking effort without token budgets, and enabled empty thinking signatures for K3 and `kimi-for-coding`.
- Fixed inherited Kimi K3 pricing metadata for Moonshot AI and Moonshot AI China.
- Fixed inherited Kimi Coding K3 thinking-level metadata to expose only the supported `max` level ([#6737](https://github.com/earendil-works/pi/issues/6737)).
- Fixed inherited catalog generation restoring xAI models removed in 0.80.9 ([#6736](https://github.com/earendil-works/pi/issues/6736)).

## [0.80.9] - 2026-07-16

### New Features

- **Kimi K3 and deferred tool loading** — Use Kimi K3 across built-in providers, including progressive extension tool activation through Kimi’s native protocol. See [Dynamic Tool Loading](docs/extensions.md#dynamic-tool-loading), [OpenAI Compatibility](docs/models.md#openai-compatibility), and the [`kimi-deferred-tools.ts`](examples/extensions/kimi-deferred-tools.ts) example.

### Added

- Added inherited Kimi K3 support for Kimi Coding, Moonshot AI, Moonshot AI China, OpenRouter, and Vercel AI Gateway.
- Added Kimi deferred tool loading for extension-driven tool activation. See [Dynamic Tool Loading](docs/extensions.md#dynamic-tool-loading), [OpenAI Compatibility](docs/models.md#openai-compatibility), and the [`kimi-deferred-tools.ts`](examples/extensions/kimi-deferred-tools.ts) example.

### Changed

- Changed xAI login to use a prefilled device-authorization link labeled “Sign in with SuperGrok or X Premium,” and changed the default xAI model to Grok 4.5 ([#6734](https://github.com/earendil-works/pi-mono/pull/6734) by [@Jaaneek](https://github.com/Jaaneek)).

### Fixed

- Fixed inherited Kimi K3 output limits for Vercel AI Gateway and OpenRouter models.
- Fixed cloning or forking a session before its first assistant response to explain that the session must be saved first.

### Removed

- Removed Grok 3, Grok 3 Fast, Grok 4.20 variants, and Grok Code Fast 1 from the built-in xAI model catalog ([#6734](https://github.com/earendil-works/pi-mono/pull/6734) by [@Jaaneek](https://github.com/Jaaneek)).

## [0.80.8] - 2026-07-16

### New Features

- **Unified model runtime and provider authentication** — `ModelRuntime` centralizes model configuration, provider-owned `/login`, and dynamic provider catalogs. See [Providers](docs/providers.md).
- **Live model catalog refresh** — `/model` refreshes configured providers in the background, and `pi update --models` forces an immediate refresh. See [Install and Manage](docs/packages.md#install-and-manage).
- **xAI device-code OAuth and Grok 4.5 Responses support** — Sign in to xAI with a device code and use Grok 4.5 with low, medium, or high thinking. See [xAI](docs/providers.md#xai-grokx-subscription).
