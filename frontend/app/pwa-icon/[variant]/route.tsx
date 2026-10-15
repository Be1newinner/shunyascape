import { renderAppIcon } from "../../lib/appIcon";

// Install icons for the web app manifest (Android / desktop "Install app").
const VARIANTS: Record<string, { size: number; inset: number }> = {
  "192": { size: 192, inset: 0.76 },
  "512": { size: 512, inset: 0.76 },
  // Launchers crop maskable icons to their own shape: keep the mark inside the safe circle.
  "maskable-512": { size: 512, inset: 0.56 },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const v = VARIANTS[(await params).variant];
  if (!v) return new Response("Not found", { status: 404 });
  return renderAppIcon(v.size, v.inset);
}
