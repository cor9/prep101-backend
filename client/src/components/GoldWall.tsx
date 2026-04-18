import React from 'react';

const TESTIMONIALS = [
  {
    author: "Sara S.",
    quote: "Holy Moly! Really phenomenal. I would easily pay up to $125 for this.",
    role: "Parent",
    context: "Parent perspective"
  },
  {
    author: "Jennifer D.",
    quote: "How in the world do you come up with all of this? This is gold!",
    role: "Parent",
    context: "Parent perspective"
  },
  {
    author: "Kristina B.",
    quote: "O. M. G. Corey, You. Are. A Wizard! Seriously, this is pure gold, thank you so much!",
    role: "Parent",
    context: "Parent perspective",
    featured: true
  },
  {
    author: "Ty C.",
    quote: "It gave me so much to work with and I really used it to inform a lot of choices.",
    role: "Actor",
    context: "Actor perspective"
  },
  {
    author: "Olivia E.",
    quote: "This is so great to have—very helpful!",
    role: "Parent",
    context: "Parent perspective"
  },
  {
    author: "Agent David Doan",
    quote: "These are incredible!",
    role: "Agent",
    context: "Industry perspective"
  }
];

export default function GoldWall() {
  return (
    <section className="goldWall" aria-labelledby="goldWallTitle">
      <div className="goldWallHeader">
        <p className="goldWallEyebrow">Parent Feedback</p>
        <h2 id="goldWallTitle">Why Parents Call It "Gold"</h2>
        <p className="goldWallSub">Real feedback from parents, actors, and reps after using a guide.</p>
      </div>
      <div className="goldWallGrid">
        {TESTIMONIALS.map((t, i) => (
          <article key={i} className={`goldCard ${t.featured ? 'goldCard--featured' : ''}`} aria-label={`Testimonial from ${t.author}`}>
            <p className="goldQuote">"{t.quote}"</p>
            <p className="goldAuthor">
              — <strong>{t.author}</strong>
              {t.role ? <span className="goldRole"> · {t.role}</span> : null}
            </p>
            {t.context ? <p className="goldContext">{t.context}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
