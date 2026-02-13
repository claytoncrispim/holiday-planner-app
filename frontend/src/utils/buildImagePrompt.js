export default function buildImagePrompt({
    destinationName,
    weatherSummary,
    hasMinors,
}) {
  const dest = destinationName || "a popular holiday destination";
  const weatherLine = weatherSummary
    ? weatherSummary
    : "";

  if (hasMinors) {
    // Minors present → scenery-focused, adults only, no explicit kids
    return `
            Photorealistic travel scene in ${dest}, focusing mainly on the scenery and atmosphere.

            The image should highlight the destination itself: local streets, coastline, nature, or landmarks that clearly feel like ${dest},
            with bright, natural lighting and a relaxed holiday mood. ${weatherLine}

            You may include a few generic ADULT travellers in the distance to give a sense of scale and activity,
            but DO NOT depict or explicitly focus on children, kids, minors, teens, or infants.

            Use a mix of different adult skin tones and ethnic backgrounds (Black, Brown, White, East Asian, South Asian, and mixed-race people),
            presented positively and naturally without stereotypes. No single person is the main focus.

            Avoid extreme luxury props, brand logos, or text. Candid, documentary-style travel photography.
    `.trim();
  }

    // No minors → diverse adult group is OK
    return `
            Photorealistic travel photo of a diverse group of ADULT travellers enjoying ${dest}.

            The group includes adults with a mix of different skin tones and ethnic backgrounds
            (Black, Brown, White, East Asian, South Asian, and mixed-race people), all presented positively and naturally.
            No single person is the main focus; they are sharing the scene together as friends or family.

            They are dressed casually and comfortably for their holiday. ${weatherLine}
            The scene focuses on the destination itself: local scenery, coastline, streets or landmarks that clearly feel like ${dest},
            with bright, natural lighting.

            Avoid stereotypes or linking people’s appearance to wealth or status.
            No exaggerated luxury props, no brand logos, no text.
            Candid, documentary-style travel photography.
    `.trim();
}