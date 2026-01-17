import type { ProviderConfig, ImportProvider } from "../../types";
import { robinhoodConfig } from "./robinhood";

/**
 * Registry of all supported provider configurations.
 */
export const providers: Map<ImportProvider, ProviderConfig> = new Map([
  ["robinhood", robinhoodConfig],
]);

/**
 * Get a provider configuration by ID.
 */
export function getProviderConfig(providerId: string): ProviderConfig | null {
  return providers.get(providerId as ImportProvider) || null;
}

/**
 * Get all available provider configurations.
 */
export function getAllProviders(): ProviderConfig[] {
  return Array.from(providers.values());
}

/**
 * Detect which provider a file is from based on headers and content.
 */
export function detectProvider(
  headers: string[],
  firstRow?: Record<string, unknown>
): ProviderConfig | null {
  for (const [, config] of providers) {
    if (config.detect(headers, firstRow)) {
      return config;
    }
  }
  return null;
}

export { robinhoodConfig } from "./robinhood";
