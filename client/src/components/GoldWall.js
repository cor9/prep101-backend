import React from 'react';

// helper: turn "First Last" -> "First L."
const abbrev = (name) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[1][0]}.`;
};

const DATA = [
  { author: "Sara Shaddix", quote: "Holy Moly! That audition breakdown was incredible. Really phenomenal. It broke down every little bit and my daughter really took it to heart. I would easily pay $75–$125 for this.", role: "Parent" },
  { author: "Jennifer Diamond", quote: "How in the world do you come up with all of this? This is gold!", role: "Parent" },
  { author: "Kristina Brunelle", quote: "O. M. G. Corey, You. Are. A Wizard! Seriously, this is pure gold, thank you so much!", role: "Parent" },
  { author: "Ty Correira", quote: "Thanks so much for the audition preparation guide, Corey. It gave me so much to work with and I really used it to inform a lot of choices in the audition.", role: "Actor" },
  { author: "Olivia Eppe", quote: "This is so great to have!!! Very helpful!", role: "Parent" },
  { author: "Lynnette L", quote: "This is AWESOME! Thanks, Corey!! He dove right into it this morning.", role: "Parent" },
  { author: "Agent David Doan", quote: "These are incredible!", role: "Agent" }
];

export default function GoldWall() {
  return (
    <section className="goldWall" aria-labelledby="goldTitle">
      <div className="goldHeader">
        <h2 id="goldTitle">Why Parents Call It "Gold"</h2>
      </div>
      <div className="goldGrid">
        {DATA.map((t, i) => {
          const display = t.author.startsWith("Agent ") ? t.author // keep agent full name for credibility
            : abbrev(t.author);
          return (
            <article key={i} className="goldCard" aria-label={`Testimonial from ${display}`}>
              <p className="goldQuote">{t.quote}</p>
              <p className="goldAuthor">— <strong>{display}</strong>{t.role ? <span className="goldRole"> · {t.role}</span> : null}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
