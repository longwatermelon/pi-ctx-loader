/**
 * writing-style
 *
 * Prepends ~/.pi/agent/writing-style.md to every user message, wrapped in
 * <writing-style-reminder> tags. Opt-in via the /writing-style toggle command,
 * per-session, default off. Missing/unreadable file is skipped silently.
 *
 * Install: copy to ~/.pi/agent/extensions/writing-style.ts
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STYLE_PATH = path.join(os.homedir(), ".pi", "agent", "writing-style.md");

// reads the style file trimmed (keeps the tag block tidy), undefined if missing/unreadable/empty
function readStyle(): string | undefined {
	try {
		const contents = fs.readFileSync(STYLE_PATH, "utf8").trim();
		return contents === "" ? undefined : contents;
	} catch {
		return undefined;
	}
}

// extension entry point: /writing-style toggles prepending the style file to each user message
export default function writingStyle(pi: ExtensionAPI) {
	let enabled = false; // per-session toggle, default off

	pi.registerCommand("writing-style", {
		description: "Toggle prepending ~/.pi/agent/writing-style.md to every user message",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			ctx.ui.notify(`writing style injection ${enabled ? "on" : "off"}`, "info");
		},
	});

	// prepend the style reminder to each user message when enabled
	pi.on("input", async (event) => {
		if (!enabled) return undefined;
		// leave slash commands untouched, prepending would break their expansion
		if (event.text.startsWith("/")) return undefined;
		// rewound messages already carry the reminder, don't duplicate it
		if (event.text.includes("<writing-style-reminder>")) return undefined;
		const style = readStyle();
		if (style === undefined) return undefined;
		return {
			action: "transform" as const,
			text: `<writing-style-reminder>\n${style}\n</writing-style-reminder>\n\n${event.text}`,
		};
	});
}
