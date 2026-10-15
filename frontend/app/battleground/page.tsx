import type { Metadata } from "next";
import BattlegroundLoader from "./BattlegroundLoader";

export const metadata: Metadata = {
  title: "Battleground",
  description: "Third-person battle royale in the browser: loot guns, fight 24 bots and survive the shrinking zone.",
};

export default function BattlegroundPage() {
  return <BattlegroundLoader />;
}
