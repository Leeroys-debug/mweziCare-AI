/** Dot-path flattening of a next-intl messages tree — arrays are treated as leaves (joined with " | "). */
export function flattenMessages(
  tree: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      result[path] = value.join(" | ");
    } else if (value && typeof value === "object") {
      Object.assign(
        result,
        flattenMessages(value as Record<string, unknown>, path),
      );
    } else {
      result[path] = String(value);
    }
  }

  return result;
}
