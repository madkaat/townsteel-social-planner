// Starter data for the planner.
// This is only what a brand-new (or reset) planner starts with.
// Everything here can also be changed inside the tool under Strategy & settings,
// and your day-to-day edits are saved in your browser, not in this file.

// color: 0-7, a slot in the planner's color set (see css/styles.css, --c0 to --c7)
// stages: optional sequence a pillar's posts move through (shown on the Journeys page)
// checklist: optional to-do list shown with that pillar's journey
const SEED_PILLARS = [
  {
    id: "odm",
    name: "ODM / Manufacturing Partnerships",
    short: "ODM",
    job: "Business development",
    audience: "Brands, product companies, OEMs, and businesses looking for a design and manufacturing partner.",
    goal: "Make it clear TownSteel designs and builds for other companies, and is open to new partnerships.",
    color: 0,
    stagesEnabled: true,
    stages: ["Awareness", "Credibility", "Conversion"],
    stageNotes: {
      Awareness: "TownSteel is more than a product brand. Introduce ODM and the kind of partnership we want.",
      Credibility: "Show the engineering, testing, production, and quality behind our manufacturing. Only confirmed capabilities.",
      Conversion: "Invite businesses to talk about product development or manufacturing, with a clear contact route."
    },
    checklistTitle: "Before the conversion posts go live",
    checklist: [
      "Confirm with my boss what the ODM offer includes (design and development, build to spec, customization, testing, packaging)",
      "Get a list of capability claims engineering is comfortable with us making publicly",
      "Agree on a clear contact route (named person, email, or form)",
      "Set up a landing page or website section for ODM inquiries",
      "Confirm which factory and engineering photos and footage are approved to share",
      "Confirm what we can and cannot say about brands we already build for"
    ]
  },
  {
    id: "aegis",
    name: "AegisSync",
    short: "AegisSync",
    job: "Product growth",
    audience: "Multifamily owners and operators, access-control decision makers, distributors.",
    goal: "Build awareness, explain AegisSecure, demo the hardware, drive product page visits and sales contacts.",
    color: 1
  },
  {
    id: "elock",
    name: "Multifamily Electronic Locks",
    short: "Electronic locks",
    job: "Portfolio growth",
    audience: "Multifamily distributors, locksmiths, property managers, access-control pros.",
    goal: "Give e-Genius and the wider electronic lock line visibility, one clear use case at a time.",
    color: 2
  },
  {
    id: "brand",
    name: "TownSteel Brand & Other Priorities",
    short: "Brand",
    job: "Brand awareness",
    audience: "The broader architectural hardware industry, channel partners, end users.",
    goal: "Company news, trade shows, people, partners, testing, and other timely content.",
    color: 3
  }
];

// 1 = Monday ... 5 = Friday. "alt" = a second pillar this day switches to every other week.
const SEED_THEMES = {
  1: { name: "Manufacturing Monday", pillar: "odm", alt: "" },
  2: { name: "Product Spotlight", pillar: "aegis", alt: "" },
  3: { name: "Electronic Access Wednesday", pillar: "elock", alt: "" },
  4: { name: "Growth Priority", pillar: "odm", alt: "aegis" },
  5: { name: "TownSteel in the Industry", pillar: "brand", alt: "" }
};

// "Posted" is always kept: it's what the Performance page counts.
const SEED_STATUSES = ["Idea", "In progress", "Ready", "Posted"];

const SEED_FORMATS = [
  "Carousel", "Short video", "Product photo", "Simple graphic", "Explainer graphic",
  "Product comparison", "Factory or engineering footage", "Screen recording", "Photo recap", "Text post"
];

// [week (1-4), weekday (1-5), pillar, title, format, goal, stage]
const SEED_POSTS = [
  [1, 1, "odm", "TownSteel does more than manufacture its own products", "Graphic or factory footage", "Introduce ODM capabilities and invite partnership inquiries.", "Awareness"],
  [1, 2, "aegis", "Familiar access. Modern technology.", "Product photo", "Reinforce the key-shaped RFID experience and AegisSecure."],
  [1, 3, "elock", "Meet the e-Genius 2990", "Product image or short video", "Highlight the lock's key features and intended application."],
  [1, 4, "aegis", "The lock is only part of the system", "AegisSecure screen recording", "Show the value of credential management and audit trails."],
  [1, 5, "brand", "Inside TownSteel's testing process", "Existing cycle-testing footage", "Demonstrate engineering and quality practices. Link to ODM capabilities where relevant."],

  [2, 1, "odm", "What makes a strong manufacturing partner?", "Carousel", "Discuss engineering collaboration, quality, and production capabilities TownSteel can back up.", "Credibility"],
  [2, 2, "aegis", "Four fob finishes, one familiar experience", "Four-finish product graphic", "Build recognition of the AegisSync credential options."],
  [2, 3, "elock", "Electronic access for different applications", "Product comparison", "Introduce the broader electronic portfolio without treating every product as interchangeable."],
  [2, 4, "odm", "A closer look at our in-house capabilities", "Factory or engineering video", "Make TownSteel's role as a potential design and manufacturing partner tangible.", "Credibility"],
  [2, 5, "brand", "TownSteel at work", "Team, facility, or partner photo", "Build familiarity and trust with the people behind the products."],

  [3, 1, "odm", "Your product concept needs the right manufacturing partner", "Simple graphic", "Speak directly to businesses exploring a product or manufacturing opportunity.", "Awareness"],
  [3, 2, "aegis", "Managing access as resident needs change", "Short video or carousel", "Explain adding and removing credentials through the software workflow."],
  [3, 3, "elock", "What to consider when choosing an electronic lock", "Educational carousel", "Help buyers understand application requirements and available options."],
  [3, 4, "aegis", "What does LAN-based access management mean?", "Simple explainer graphic", "Explain the practical side of AegisSecure's local-network setup, using technically approved claims."],
  [3, 5, "brand", "A product detail worth a closer look", "Product close-up", "Highlight a meaningful design or engineering detail from any priority product line."],

  [4, 1, "odm", "From design to finished hardware", "Process carousel", "Explain the stages TownSteel can support, based on confirmed capabilities.", "Credibility"],
  [4, 2, "aegis", "D-Sync or I-Sync: understanding the configurations", "Side-by-side comparison", "Help buyers identify the right configuration for their application."],
  [4, 3, "elock", "A closer look at another multifamily lock", "Product demonstration", "Give another portfolio product visibility and explain its specific use case."],
  [4, 4, "odm", "Exploring a manufacturing partnership?", "Simple branded graphic", "Make the invitation to discuss ODM opportunities explicit, with a clear contact route.", "Conversion"],
  [4, 5, "brand", "This month at TownSteel", "Photo recap or short montage", "Recap team, product, event, and engineering activity, or swap in a timely post."]
];

const SEED_WEEK_FOCUS = [
  "Introduce the four pillars",
  "Show capability and craft",
  "Educate and answer buyer questions",
  "Build trust and generate interest"
];

// Unscheduled ideas for the Idea bank: [pillar, title, format, goal, stage]
const SEED_IDEAS = [
  ["brand", "Employee spotlight", "Photo + short Q&A", "Put faces to the brand and build trust."],
  ["brand", "Trade show preview or recap", "Photo set or short video", "Show where TownSteel shows up in the industry."],
  ["brand", "Distributor or partner highlight", "Photo + quote", "Strengthen channel relationships and visibility."],
  ["brand", "School security hardware", "Educational graphic", "Show relevant product lines for education projects."],
  ["brand", "Behavioral health hardware", "Product close-up", "Show TownSteel solutions for specialized applications."],
  ["odm", "Repurpose cycle-testing footage for ODM", "Short video", "Reuse testing footage to show quality processes to prospective partners.", "Credibility"],
  ["aegis", "AegisSync buyer FAQ", "Carousel", "Answer the questions sales hears most often."]
];
