export function safeAuthReturnPath(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\/join\/[A-Za-z0-9._~-]+$/.test(candidate)) return undefined;
  return candidate;
}
