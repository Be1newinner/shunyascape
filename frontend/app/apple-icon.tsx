import { renderAppIcon } from "./lib/appIcon";

// iOS home-screen icon: the logo mark on the brand's dark badge.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width);
}
