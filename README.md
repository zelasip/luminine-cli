# Luminine CLI 🌙 (v2.1.0)

A powerful AI coding assistant CLI with streaming support, built for Termux and desktop.

## Features

- **Streaming Responses** — Real-time token-by-token output
- **Multi-Tool Execution** — Runs multiple tool calls in sequence automatically
- **Shell Confirmation** — Interactive approval before executing commands
- **Command History** — Persistent history with ↑/↓ navigation
- **Image Generation** — Free AI image generation via Pollinations.ai
- **File Operations** — Create, read, write, list files
- **Web Search** — Search the web from the CLI
- **Multi-Provider** — Gemini, OpenRouter, Anthropic, OpenAI, Custom, Luminine AI

## Installation

```bash
npm install -g luminine-cli
```

## Usage

```bash
luminine
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/new` | New session (clear history) |
| `/resume` | Load previous session |
| `/compress` | Summarize history |
| `/remember <fact>` | Save a fact |
| `/models` | Switch provider/model |
| `/config` | Configure API keys |
| `/ls` | List files |
| `/cat` | Read file |
| `/run` | Run shell command |
| `/exit` | Quit |

### Keyboard Shortcuts

- **↑/↓** — Navigate command history
- **Ctrl+Y** — Toggle command restrictions

## Configuration

Create a `.env` file:

```env
LUMININE_PROVIDER=luminine
LUMININE_MODEL=claude-opus-4-8
GEMINI_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```

## Providers

| Provider | Models |
|----------|--------|
| Luminine | claude-opus-4-8, gpt-5-5, gemini-3-flash, etc. |
| Gemini | gemini-1.5-pro, gemini-2.5-flash |
| OpenRouter | auto, llama-3.1-405b, claude-3.5-sonnet |
| Anthropic | claude-3-5-sonnet, claude-3-opus |
| OpenAI | gpt-4o, gpt-4-turbo |

## License

MIT
