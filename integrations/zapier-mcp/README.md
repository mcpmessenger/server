# Zapier MCP Integration

This directory contains a [Zapier Platform CLI](https://github.com/zapier/zapier-platform) app that lets you connect Zapier Zaps to an MCP Server.

## Features

* **Custom Authentication** – supply MCP Server Base URL + (optional) API Key.
* **Actions**
  * *Execute Command* – Calls `/api/command` with provider, command, prompt, etc.
  * *Execute Workflow* – Calls `/api/workflow` with a JSON array of steps.
* **Trigger**
  * *New Ping* – Poll-based connectivity check (useful as a Zapier Test trigger).

## Usage

1. Install Zapier CLI & Login:

```bash
npm i -g zapier-platform-cli
zapier login
```

2. From this folder:

```bash
npm install
zapier test   # run mocha tests (currently none)
zapier push   # upload the integration version to Zapier (follow prompts)
```

3. In Zapier's UI, add the new private integration to your account, set credentials, and start building Zaps.

## Development

* Add more triggers/actions by creating files under `triggers/`, `actions/`, etc. and referencing them in `index.js`.
* After code changes run `zapier push --watch` for live deploys.

## TODO / Next Steps

* Real-time webhook trigger support once MCP emits webhooks.
* Dynamic dropdowns for provider and command fields using `/api/providers` endpoint (not yet implemented).
* Unit tests for each action & trigger using `zapier-platform-core`'s testing utilities.

## License

MIT © MCP Team 