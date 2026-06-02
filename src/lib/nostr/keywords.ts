export function parseKeywordInput(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\s]+/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )
  ];
}
