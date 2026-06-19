# Luminine CLI 🌙

Luminine is a powerful coding CLI designed to be your intelligent coding companion, inspired by Claude Code. It features a sleek interface with a purple moon aesthetic.

## Features

- **Interactive Shell**: A rich, interactive environment for coding tasks.
- **File System Tools**: List files, read content, and more.
- **Text Search**: Search for specific strings across your project files.
- **Goal Planning**: Generate structured plans for your development goals.
- **Shell Integration**: Execute system commands directly from the CLI.

## Installation

### Linux / macOS
```bash
curl -sL https://raw.githubusercontent.com/zelasip/luminine-cli/main/.github/install-scripts/install-linux.sh | bash
```

### Windows
Download and run `install-windows.bat` from [Releases](https://github.com/zelasip/luminine-cli/releases).

### Termux (Android)
```bash
curl -sL https://raw.githubusercontent.com/zelasip/luminine-cli/main/.github/install-scripts/install-termux.sh | bash
```

### Manual Install
```bash
git clone https://github.com/zelasip/luminine-cli.git
cd luminine-cli
npm install
npm run build
npm link
```

## Usage

Start the interactive session:
```bash
luminine
```

Or run commands directly:
```bash
luminine ls src
luminine search src "function"
luminine plan "Refactor the authentication module"
```

## Logo

The purple moon logo is displayed at every startup, symbolizing the light it brings to your coding journey.
