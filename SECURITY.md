# Security

## Reporting a vulnerability

If you find a security issue, please open a private report via [GitHub Security Advisories](https://github.com/TheCodeDaniel/synapse/security/advisories/new) rather than a public issue. We'll acknowledge reports as quickly as we can.

## How secrets are handled

This project talks to two kinds of external services that need credentials: the Figma API and an LLM provider (Anthropic, OpenAI, or a custom/self-hosted endpoint). The key-handling model is:

- **Never commit real secrets.** `di.config.json` and `.env` are gitignored. Use `di.config.json.example` / `.env.example` as templates.
- **Environment variables are the preferred path.** If `ai.apiKey` is left blank in `di.config.json`, `ConfigLoader` automatically falls back to `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `DI_CUSTOM_API_KEY` depending on `ai.provider`. This means a real key never has to touch a file that could get committed.
- **In the VS Code extension**, the Figma access token and AI provider API key are stored via VS Code's `SecretStorage` API (`Design Intelligence: Set Figma Access Token` / `Set AI Provider API Key` commands), which is backed by your OS keychain — not written to any file in the workspace.
- **Figma OAuth tokens at rest** (`FigmaOAuthManager`) are encrypted with AES-256-GCM (a random salt and IV per write, key derived via `scrypt`) rather than stored in plaintext. This requires real key material (an `encryptionSecret`, or falling back to the OAuth `clientSecret`) — it's not a hardcoded, guessable default.
- **Logging is sanitized on the Figma API path**: `FigmaClient` only logs a extracted error message (e.g. `error.response.data.message`), never the raw Axios error object, which would otherwise embed the `X-Figma-Token` request header.

## Known limitations

- `Cache`'s optional disk-persistence layer stores whatever it's given as plaintext JSON. Don't point it at a cache directory that isn't already covered by your OS's normal file permissions, and avoid caching raw provider responses that might embed a credential.
- `di.config.json` itself is a plaintext file. If you do put a real key directly in `ai.apiKey`/`figma.accessToken` for local convenience instead of using an env var, make sure the file is actually gitignored in your setup (it is by default in this repo) before committing anything.
