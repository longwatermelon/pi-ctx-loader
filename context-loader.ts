/**
 * context-loader
 *
 * Injects project files listed in .pi/context-loader.json into the system prompt.
 * Config format: { "files": ["profile.md", "notes/README.md", ...] }
 * Paths are relative to the project root and must stay inside it.
 * Missing files hard-error (the turn is blocked).
 *
 * Install: copy to ~/.pi/agent/extensions/context-loader.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CONFIG_PATH = ".pi/context-loader.json";

// checks that a resolved path stays inside the project root
function insideRoot(root: string, target: string): boolean {
	const rel = path.relative(root, target);
	return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

// reads config + listed files and returns the prompt section to append,
// undefined if no config exists, throws on invalid config, unreadable
// file, or a path escaping the project root
function loadContext(cwd: string): string | undefined {
	const configFile = path.join(cwd, CONFIG_PATH);
	if (!fs.existsSync(configFile)) return undefined;

	let files: unknown;
	try {
		files = (JSON.parse(fs.readFileSync(configFile, "utf8")) as { files?: unknown }).files;
	} catch (err) {
		throw new Error(`${CONFIG_PATH}: invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (!Array.isArray(files) || !files.every((f): f is string => typeof f === "string")) {
		throw new Error(`${CONFIG_PATH}: "files" must be an array of strings`);
	}

	const root = fs.realpathSync(cwd);
	const sections = files.map((file) => {
		// this is a global extension, so a cloned project's config must not be
		// able to pull in files outside the project (via absolute, ../ or symlink paths)
		if (path.isAbsolute(file) || !insideRoot(root, path.resolve(root, file))) {
			throw new Error(`${CONFIG_PATH}: path escapes project root: ${file}`);
		}
		let real: string;
		try {
			real = fs.realpathSync(path.resolve(root, file));
		} catch {
			throw new Error(`${CONFIG_PATH}: cannot read listed file: ${file}`);
		}
		if (!insideRoot(root, real)) {
			throw new Error(`${CONFIG_PATH}: path escapes project root: ${file}`);
		}
		let contents: string;
		try {
			contents = fs.readFileSync(real, "utf8");
		} catch {
			throw new Error(`${CONFIG_PATH}: cannot read listed file: ${file}`);
		}
		return `## ${file}\n\n${contents}`;
	});

	return `# Project context files\n\nThe following project files are provided as context.\n\n${sections.join("\n\n")}`;
}

// extension entry point: validates context on input, injects it into the system prompt each turn
export default function contextLoader(pi: ExtensionAPI) {
	// context loaded during input validation and consumed by before_agent_start,
	// so both handlers see the same read (null = nothing cached)
	let pending: string | undefined | null = null;

	// before_agent_start can't cancel a turn and swallows errors, so hard-error
	// here instead: block the turn if the config or any listed file is broken
	pi.on("input", async (_event, ctx) => {
		try {
			pending = loadContext(ctx.cwd);
		} catch (err) {
			pending = null;
			const message = err instanceof Error ? err.message : String(err);
			ctx.ui.notify(message, "error");
			if (!ctx.hasUI) console.error(message); // notify is silent in non-interactive mode
			return { action: "handled" };
		}
		return undefined;
	});

	// append filenames + contents to the system prompt, re-read each turn
	pi.on("before_agent_start", async (event) => {
		const context = pending;
		pending = null;
		if (context === undefined || context === null) return undefined;
		return { systemPrompt: `${event.systemPrompt}\n\n${context}` };
	});
}
