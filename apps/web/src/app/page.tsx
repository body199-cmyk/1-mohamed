import { redirect } from "next/navigation";

/** Private-system entry point: never land on a seeded demo. */
export default function RootPage() { redirect("/login"); }
