/**
 * Normalizes numbers typed in Arabic/Indic numerals or the Arabic decimal separator
 * to standard ASCII digits and dots.
 */
export function normalizeArabicNumbers(input: string): string {
  if (!input) return "";

  return input
    // Arabic-Indic digits ٠-٩ (U+0660 to U+0669)
    .replace(/[\u0660-\u0669]/g, (char) => (char.charCodeAt(0) - 0x0660).toString())
    // Extended Arabic-Indic / Persian digits ۰-۹ (U+06F0 to U+06F9)
    .replace(/[\u06F0-\u06F9]/g, (char) => (char.charCodeAt(0) - 0x06F0).toString())
    // Arabic decimal separator '٫' (U+066B)
    .replace(/\u066B/g, ".");
}
