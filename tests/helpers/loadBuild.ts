// Loads automations/build.mjs for tests.
export async function loadBuild(): Promise<{ buildPrompt: () => Promise<string> }> {
  return import('../../automations/build.mjs' as string);
}
