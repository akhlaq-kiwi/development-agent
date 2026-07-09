import { BuilderConfigSchema, type BuilderConfig } from "./schema.js";
import type { StateStore } from "../state/store.js";

/** Reads the config override for a workspace from the SQLite store only (no global merge). */
export function readProjectConfig(store: StateStore, workspaceId: string): Partial<BuilderConfig> {
  return (store.getProjectConfig(workspaceId) as Partial<BuilderConfig> | null) ?? {};
}

/**
 * Validates and persists a workspace's config override, replacing it in full.
 * Also mirrors `config.projectDir` onto the workspace row so the Projects list
 * can display/filter by path without parsing the config JSON.
 */
export function writeProjectConfig(store: StateStore, workspaceId: string, config: unknown): BuilderConfig {
  const parsed = BuilderConfigSchema.parse(config);
  store.setProjectConfig(workspaceId, parsed, Date.now());
  if (parsed.projectDir) store.setWorkspaceProjectDir(workspaceId, parsed.projectDir);
  return parsed;
}
