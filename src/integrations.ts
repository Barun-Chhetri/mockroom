/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default).
 * - 'user': The calling user pays.
 *
 * All paid integrations are set to 'user' so no developer balance
 * or card is required.
 */

export const integrations: Record<
  string,
  { billing: 'developer' | 'user'; anonymous?: boolean }
> = {
  anthropic: { billing: 'user' },
  openai: { billing: 'user' },
  google: { billing: 'user' },
  composio: { billing: 'user' },
}
