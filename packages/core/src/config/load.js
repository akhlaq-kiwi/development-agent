import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { BuilderConfigSchema } from "./schema.js";
const GLOBAL_CONFIG_PATH = join(homedir(), ".config", "builder", "config.yml");
function readYamlIfExists(path) {
    if (!existsSync(path))
        return {};
    const raw = readFileSync(path, "utf8");
    return parseYaml(raw) ?? {};
}
/** Deep-merge project config over global config, project taking precedence. */
function mergeConfig(base, override) {
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        const existing = out[key];
        if (value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            existing &&
            typeof existing === "object" &&
            !Array.isArray(existing)) {
            out[key] = mergeConfig(existing, value);
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
/**
 * Resolves the effective config: global (~/.config/builder/config.yml)
 * merged with the project-local override (<projectDir>/.builder.yml).
 */
export function loadConfig(projectDir) {
    const global = readYamlIfExists(GLOBAL_CONFIG_PATH);
    const project = readYamlIfExists(join(projectDir, ".builder.yml"));
    const merged = mergeConfig(global, project);
    return BuilderConfigSchema.parse(merged);
}
export { GLOBAL_CONFIG_PATH };
