import { buildEnglishNumberMap } from "../../shared/scripture/englishNumbers";

/** English spoken/digit number map for chapters 1–150 and verses 1–176. */
export const ENGLISH_NUMBER_MAP: Record<string, number> = buildEnglishNumberMap(176);
