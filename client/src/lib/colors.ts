const PROVIDER_COLORS = ["violet", "coral", "lime", "sky", "amber"] as const;

export type ProviderColor = (typeof PROVIDER_COLORS)[number];

export function providerColorMap(names: string[]): Map<string, ProviderColor> {
  const unique = [...new Set(names)].sort();
  const colors = new Map<string, ProviderColor>();

  unique.forEach((name, index) => {
    colors.set(name, PROVIDER_COLORS[index % PROVIDER_COLORS.length] ?? "violet");
  });

  return colors;
}
