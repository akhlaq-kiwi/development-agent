import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { BuilderConfigSchema, type BuilderConfig } from "./schema.js";
import type { StateStore } from "../state/store.js";

const GLOBAL_CONFIG_PATH = join(homedir(), ".config", "builder", "config.yml");

function readYamlIfExists(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  return (parseYaml(raw) as Record<string, unknown>) ?? {};
}

/** Deep-merge project config over global config, project taking precedence. */
function mergeConfig(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = mergeConfig(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Resolves the effective config: global (~/.config/builder/config.yml)
 * merged with the workspace-local override, which lives in the SQLite state
 * store (keyed by workspaceId) rather than a .builder.yml file.
 */
export function loadConfig(workspaceId: string, store: StateStore): BuilderConfig {
  const global = readYamlIfExists(GLOBAL_CONFIG_PATH);
  const project = (store.getProjectConfig(workspaceId) as Record<string, unknown> | null) ?? {};
  const merged = mergeConfig(global, project);
  return BuilderConfigSchema.parse(merged);
}

export { GLOBAL_CONFIG_PATH };
