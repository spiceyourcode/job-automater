export const landingFaqs = [
  {
    q: "Does JobAutomater apply without my permission?",
    a: "No. Every submission requires your explicit approval. Automation handles collection, matching, and drafting—you decide what ships.",
  },
  {
    q: "Where does my CV go?",
    a: "Your documents stay in your workspace. We index content for matching and generation—we don't sell data or train public models on your files.",
  },
  {
    q: "Which job sources work out of the box?",
    a: "Pick from our curated catalog of boards and feeds during onboarding. Advanced users can still add custom RSS, email, or scrapers in Settings.",
  },
  {
    q: "Is this only for developers?",
    a: "It's built for knowledge workers who apply at volume—engineers, designers, product, and data roles—but anyone with a structured CV benefits.",
  },
] as const;

export const landingFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: landingFaqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
