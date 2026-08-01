# pi-ctx-loader

Pi extension that injects project files into the system prompt. In any project, create `.pi/context-loader.json` listing files (relative to project root):

```json
{
  "files": [
    "profile.md",
    "portfolio/README.md"
  ]
}
```

Each listed file is appended to the system prompt (filename + contents) on every turn. Files are re-read per turn, so edits are picked up live; as long as they don't change, the prompt is byte-identical and provider prompt caching applies. Projects without the config file are unaffected. A missing or unreadable listed file (or invalid config) hard-errors: the turn is blocked with an error message until fixed. Paths must stay inside the project root — absolute paths, and paths or symlinks escaping through `../`, are rejected, since the extension is global and a cloned repo's config must not be able to read arbitrary host files.

Install by copying the extension to pi's global extensions dir:

```bash
cp context-loader.ts ~/.pi/agent/extensions/context-loader.ts
```
