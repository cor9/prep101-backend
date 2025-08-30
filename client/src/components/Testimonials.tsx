import React from "react";
import { testimonials } from "../data/testimonials";

const Star = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B">
    <path d="M12 2l2.9 6.9 7.6.6-5.7 4.8 1.8 7.4L12 17.9 5.4 21.7l1.8-7.4L1.5 9.5l7.6-.6L12 2z"/>
  </svg>
);

export default function Testimonials() {
  return (
    <section className="card" aria-labelledby="goldWall">
      <h2 id="goldWall" className="h2">Why Parents Call It "Gold"</h2>
      <div className="t-grid">
        {testimonials.map((t, i) => (
          <article key={i} className="t-card" aria-label={`Testimonial from ${t.name}`}>
            <div className="t-stars" aria-hidden="true">
              <Star/><Star/><Star/><Star/><Star/>
            </div>
            <blockquote className="t-quote">"{t.quote}"</blockquote>
            <div className="t-author">
              <span className="t-name">{t.name}</span>
              {t.role ? <span className="t-role"> · {t.role}</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
