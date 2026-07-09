import { BuilderConfigSchema, type BuilderConfig } from "./schema.js";
import type { StateStore } from "../state/store.js";

/** Reads the project-local config override from the SQLite store only (no global merge). */
export function readProjectConfig(store: StateStore, projectDir: string): Partial<BuilderConfig> {
  return (store.getProjectConfig(projectDir) as Partial<BuilderConfig> | null) ?? {};
}

/** Validates and persists the project-local config override to the SQLite store, replacing it in full. */
export function writeProjectConfig(store: StateStore, projectDir: string, config: unknown): BuilderConfig {
  const parsed = BuilderConfigSchema.parse(config);
  store.setProjectConfig(projectDir, parsed, Date.now());
  return parsed;
}
