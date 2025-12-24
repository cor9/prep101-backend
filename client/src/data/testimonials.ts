export type Testimonial = {
  name: string;
  quote: string;
  role?: string;      // e.g., Parent of 12-year-old actor
  short?: string;     // optional pull-quote
};

export const testimonials: Testimonial[] = [
  {
    name: "Sara S.",
    quote:
      "Holy Moly! Really phenomenal. I would easily pay up to $125 for this.",
    short: ""Really phenomenal."",
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
    name: "Ty C.",
    quote:
      "It gave me so much to work with and I really used it to inform a lot of choices.",
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
    name: "Agent David Doan",
    quote: "These are incredible!",
    short: ""Incredible."",
    role: "Agent"
  }
];
