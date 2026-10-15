/** Wardrobe: each outfit tints the soldier's armour. Ids match the backend list. */
export const OUTFITS = [
  { id: "classic", name: "Classic", tint: "#ffffff" },
  { id: "desert", name: "Desert Storm", tint: "#e6cf9c" },
  { id: "woodland", name: "Woodland", tint: "#98aa7c" },
  { id: "urban", name: "Urban Grey", tint: "#a4a9b0" },
  { id: "night", name: "Night Ops", tint: "#4c525c" },
  { id: "crimson", name: "Crimson", tint: "#c0625a" },
  { id: "arctic", name: "Arctic", tint: "#dde9f4" },
  { id: "royal", name: "Royal Blue", tint: "#7d8fd6" },
  // Earned with the login streak (3 and 7 days in a row).
  { id: "ember", name: "Ember", tint: "#e0773a" },
  { id: "gold", name: "Gold Elite", tint: "#e8c25a" },
] as const;

export type OutfitId = (typeof OUTFITS)[number]["id"];

export function outfitTint(id: string | null | undefined) {
  return (OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]).tint;
}
