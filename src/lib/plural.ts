/**
 * Polish pluralization — three grammatical forms. Polish picks a noun
 * form by number: 1 is singular, 2–4 (but not 12–14) take the "few"
 * form, everything else takes the "many" form.
 *
 *   plural(1, ["miejsce", "miejsca", "miejsc"]) → "miejsce"
 *   plural(2, ["miejsce", "miejsca", "miejsc"]) → "miejsca"
 *   plural(5, ["miejsce", "miejsca", "miejsc"]) → "miejsc"
 *   plural(12, ...) → "miejsc"   (teens are always "many")
 *
 * `forms` is [one, few, many]. Returns only the noun — compose the
 * number yourself: `${n} ${plural(n, [...])}`.
 */
export function plural(
  n: number,
  forms: [one: string, few: string, many: string],
): string {
  const abs = Math.abs(n);
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;
  if (abs === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return forms[1];
  }
  return forms[2];
}
