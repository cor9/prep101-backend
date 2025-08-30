export type Testimonial = {
  name: string;
  quote: string;
  role?: string;      // e.g., Parent of 12-year-old actor
  short?: string;     // optional pull-quote
};

export const testimonials: Testimonial[] = [
  {
    name: "Sara Shaddix",
    quote:
      "Holy Moly! That audition breakdown was incredible. Really phenomenal. It broke down every little bit and my daughter really took it to heart. I would easily pay $75–$125 for this.",
    short: ""Incredible. Worth $75–$125."",
    role: "Parent"
  },
  {
    name: "Jennifer Diamond",
    quote: "How in the world do you come up with all of this? This is gold!",
    short: ""This is gold!"",
    role: "Parent"
  },
  {
    name: "Kristina Brunelle",
    quote: "O. M. G. Corey, You. Are. A Wizard! Seriously, this is pure gold, thank you so much!",
    short: ""Pure gold."",
    role: "Parent"
  },
  {
    name: "Ty Correira",
    quote:
      "Thanks so much for the audition preparation guide, Corey. It gave me so much to work with and I really used it to inform a lot of choices in the audition.",
    short: ""Gave me so much to work with."",
    role: "Actor"
  },
  {
    name: "Olivia Eppe",
    quote: "This is so great to have—very helpful!",
    short: ""Very helpful!"",
    role: "Parent"
  },
  {
    name: "Lynnette L.",
    quote: "This is AWESOME! Thanks, Corey!! He dove right into it this morning.",
    short: ""AWESOME — dove right in."",
    role: "Parent"
  },
  {
    name: "Agent David Doan",
    quote: "These are incredible!",
    short: ""Incredible."",
    role: "Agent"
  }
];
