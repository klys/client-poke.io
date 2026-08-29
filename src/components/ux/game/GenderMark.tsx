/**
 * ♂ / ♀ mark next to a venomon's name (party cards, stats window, battle
 * databox, pet window). Genderless venomons render nothing.
 */
import { Text } from "@chakra-ui/react";

export type VenomonGender = "male" | "female" | "genderless";

export const GENDER_SYMBOL: Record<VenomonGender, string> = { male: "♂", female: "♀", genderless: "" };
export const GENDER_COLOR: Record<VenomonGender, string> = { male: "#4dabf7", female: "#f783ac", genderless: "#adb5bd" };

export function GenderMark({ gender, size = "sm" }: { gender?: VenomonGender | null; size?: "sm" | "md" | "lg" }) {
  if (!gender || gender === "genderless") return null;
  const fontSize = size === "lg" ? "1.25em" : size === "md" ? "1.05em" : "0.95em";
  return (
    <Text
      as="span"
      color={GENDER_COLOR[gender]}
      fontWeight="900"
      fontSize={fontSize}
      lineHeight={1}
      ml={1}
      flexShrink={0}
      aria-label={gender === "male" ? "macho" : "hembra"}
      data-gender={gender}
      textShadow="0 0 2px rgba(0,0,0,0.35)"
    >
      {GENDER_SYMBOL[gender]}
    </Text>
  );
}

export default GenderMark;
