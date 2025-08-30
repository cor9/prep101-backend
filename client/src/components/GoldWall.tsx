import React from 'react';

// Tiny gold clapper icon
const Clapper = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" fill="#FFD54A" stroke="#C08700"/>
    <path d="M3 9l2.5-5.5a2 2 0 0 1 1.8-1.2h6.2a2 2 0 0 1 1.8 1.2L18 9H3z" fill="#FFE899" stroke="#C08700"/>
    <path d="M6 6l3-3M10 6l3-3M14 6l3-3" stroke="#C08700"/>
  </svg>
);

const TESTIMONIALS = [
  {
    author: "Sara Shaddix",
    quote: "Holy Moly! That audition breakdown was incredible. Really phenomenal. It broke down every little bit and my daughter really took it to heart. I would easily pay $75–$125 for this.",
    role: "Parent"
  },
  {
    author: "Jennifer Diamond",
    quote: "How in the world do you come up with all of this? This is gold!",
    role: "Parent"
  },
  {
    author: "Kristina Brunelle",
    quote: "O. M. G. Corey, You. Are. A Wizard! Seriously, this is pure gold, thank you so much!",
    role: "Parent"
  },
  {
    author: "Ty Correira",
    quote: "Thanks so much for the audition preparation guide, Corey. It gave me so much to work with and I really used it to inform a lot of choices in the audition.",
    role: "Actor"
  },
  {
    author: "Olivia Eppe",
    quote: "This is so great to have!!! Very helpful!",
    role: "Parent"
  },
  {
    author: "Lynnette L.",
    quote: "This is AWESOME! Thanks, Corey!! He dove right into it this morning.",
    role: "Parent"
  },
  {
    author: "Agent David Doan",
    quote: "These are incredible!",
    role: "Agent"
  }
];

export default function GoldWall() {
  return (
    <section className="goldWall" aria-labelledby="goldWallTitle">
      <div className="goldWallHeader">
        <Clapper />
        <h2 id="goldWallTitle">Why Parents Call It "Gold"</h2>
        <Clapper />
      </div>
      <div className="goldWallGrid">
        {TESTIMONIALS.map((t, i) => (
          <article key={i} className="goldCard" aria-label={`Testimonial from ${t.author}`}>
            <p className="goldQuote">"{t.quote}"</p>
            <p className="goldAuthor">
              — <strong>{t.author}</strong>
              {t.role ? <span className="goldRole"> · {t.role}</span> : null}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
