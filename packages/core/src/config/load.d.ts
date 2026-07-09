import { type BuilderConfig } from "./schema.js";
declare const GLOBAL_CONFIG_PATH: string;
/**
 * Resolves the effective config: global (~/.config/builder/config.yml)
 * merged with the project-local override (<projectDir>/.builder.yml).
 */
export declare function loadConfig(projectDir: string): BuilderConfig;
export { GLOBAL_CONFIG_PATH };
