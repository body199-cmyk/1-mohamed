/** Consistent, presentation-only icons for workspace navigation and actions. */
const iconPaths = {
  daily: "M3 6h11v11H3zM14 10h4l3 4v3h-7M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  reports: "M4 4h16v17H4zM8 2v4M16 2v4M4 9h16M8 13h3M14 13h3M8 17h3",
  contractor: "M5 3h14v18H5zM8 7h8M8 11h8M8 15h5",
  cash: "M3 6h18v13H3zM3 10h18M6 15h4M16 14h2",
  master: "M4 3h6v6H4zM14 3h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  sun: "M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  moon: "M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.6 8.6 0 1 0 20.5 14.2Z",
  refresh: "M20 7v5h-5M4 17v-5h5M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2",
} as const;

type WorkspaceIconName = keyof typeof iconPaths;

export function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
