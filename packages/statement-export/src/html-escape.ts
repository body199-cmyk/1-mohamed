const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_UNSAFE_PATTERN = /[&<>"']/g;

export function escapeHtmlText(value: string): string {
  return value.replace(
    HTML_UNSAFE_PATTERN,
    (char) => HTML_ESCAPE_MAP[char] ?? char
  );
}
