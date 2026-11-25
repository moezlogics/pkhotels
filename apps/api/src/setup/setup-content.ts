/*
 * Data the setup jobs put in place once (see setup.service.ts). Editable
 * afterwards from the dashboard — these are only the starting values.
 */

/** Benefits per plan, matched by name. Prices and limits are not touched. */
export const PLAN_BENEFITS: Record<string, { perks: Record<string, unknown>; features: string[]; description?: string }> = {
  free: {
    perks: { verifiedBadge: false, teamMembers: 0, socialLinks: false, brandedProfile: false, autoPublish: false, spotlight: false, highlight: false },
    description: 'Start listing today — no card needed. Your listing stays live for a month; renew it for free.',
    features: [
      '1 live listing at a time',
      'Photos and a walkthrough video on every listing',
      'A map on your listing when you add a location',
      'Shown on city, area and size pages',
      'Call and WhatsApp buttons on your listing',
      'Your own agent profile page with a share link',
      'Views and enquiry stats',
    ],
  },
  starter: {
    perks: { verifiedBadge: false, teamMembers: 0, socialLinks: true, brandedProfile: false, autoPublish: false, spotlight: false, highlight: false },
    description: 'For landlords and new dealers with a few rentals.',
    features: [
      '5 live listings',
      '1 featured listing — pinned above the rest, with a Featured tag',
      'Social media links on your profile (Facebook, Instagram, YouTube, TikTok, website)',
      'Photos and a walkthrough video on every listing',
      'Pinned on the map on the listing page',
      'Views and enquiry stats',
      'Valid 1 month',
    ],
  },
  dealer: {
    perks: { verifiedBadge: false, teamMembers: 0, socialLinks: true, brandedProfile: true, autoPublish: false, spotlight: false, highlight: true },
    description: 'For working rental dealers who list every week.',
    features: [
      '15 live listings',
      '3 featured listings — pinned above the rest, with a Featured tag',
      'Social links on your profile',
      "Listed above Free and Starter on your city's dealers page",
      'Profile share button for WhatsApp and Facebook',
      'Pinned on the map on the listing page',
      'Views and enquiry stats per listing',
      'Valid 1 month',
    ],
  },
  agency: {
    perks: { verifiedBadge: true, teamMembers: 3, socialLinks: true, brandedProfile: true, autoPublish: true, spotlight: true, highlight: false },
    description: 'For established agencies with a few agents.',
    features: [
      '40 live listings',
      '10 featured listings — pinned above the rest, with a Featured tag',
      'Verified badge on your profile, every listing and every listing card',
      'Listings go live instantly — no waiting for review',
      'Spotlight in "Verified agencies" on the homepage and agents page',
      'Social links on your profile',
      "In the agencies section at the top of your city's dealers page",
      'Views and enquiry stats per listing',
      'Valid 1 month',
    ],
  },
  'agency plus': {
    perks: { verifiedBadge: true, teamMembers: 10, socialLinks: true, brandedProfile: true, autoPublish: true, spotlight: true, highlight: false },
    description: 'For bigger agencies with a team of agents.',
    features: [
      '100 live listings, shared by your team',
      '25 featured listings — pinned above the rest, with a Featured tag',
      'Up to 10 agent accounts — each agent manages their own listings, you see all of them',
      'Verified badge for you and every agent of your agency',
      'Listings go live instantly — no waiting for review',
      'Spotlight in "Verified agencies" on the homepage and agents page',
      'Agency profile with your team and social links',
      "Top of your city's dealers page, with your agents ranked first",
      'Views and enquiry stats per listing and per agent',
      'Valid 1 month',
    ],
  },
};

const p = (text: string) => `<p>${text}</p>`;

export const STATIC_PAGES: { slug: string; title: string; metaTitle: string; metaDescription: string; content: string }[] = [
  {
    slug: 'about',
    title: 'About PakHotels',
    metaTitle: "About PakHotels — Pakistan's Rental Property Portal",
    metaDescription:
      "Who we are: a Pakistani portal for rentals only, where tenants find houses, portions, flats, rooms and shops for rent and landlords and dealers fill them faster.",
    content: [
      p('PakHotels is a Pakistani portal for rentals — and only rentals. Landlords and dealers list houses, upper and lower portions, flats, rooms, hostels, shops, offices and warehouses for rent, and tenants contact them directly — by phone or WhatsApp, without signing up.'),
      '<h2>What you will find here</h2>',
      p('Rentals across Lahore, Islamabad, Rawalpindi, Karachi, Multan, Faisalabad, Gujranwala, Sahiwal and other cities, searchable by city, area, property type, size, bedrooms and monthly rent. Sizes are in marla and kanal and rents are per month, the way homes are rented here.'),
      p('Because we only do rentals, every page — from the search filters to the listing details — is built around what tenants ask: the monthly rent, which portion is available, the size and the area.'),
      '<h2>How listings work</h2>',
      '<ul><li>Every listing is checked — by our system and by our team — and anything that looks suspicious waits for review.</li><li>Each listing shows who posted it, with a link to their profile and their other properties.</li><li>When a property is rented out it is marked as such and its contact details are hidden.</li><li>Anything that looks wrong can be reported from the listing page, and we look at every report.</li></ul>',
      p('We are a listings platform, not a party to any rental agreement. Always visit the property and meet the owner before paying any advance or security.'),
      '<h2>For landlords and dealers</h2>',
      p('Anyone can create an account and post a rental; the first listing is free. Dealers who list more can choose a <a href="/packages">monthly package</a> for more listings, featured placement and a verified badge.'),
    ].join('\n'),
  },
  {
    slug: 'contact',
    title: 'Contact us',
    metaTitle: 'Contact PakHotels — Phone, WhatsApp & Email',
    metaDescription: 'Get in touch with PakHotels by phone, WhatsApp or email — for listing help, packages for agents, advertising or to report a problem.',
    content: [
      p('We are happy to help — with posting a rental, choosing a package, a problem with a listing, or advertising on the site.'),
      '<h2>The quickest way</h2>',
      p('Message us on WhatsApp or call during office hours; our details are on this page. For anything to do with a particular listing, please include its link.'),
      '<h2>Reporting a listing</h2>',
      p('If a listing looks wrong — already rented, a wrong rent or a suspected scam — use the <strong>Report this listing</strong> button on its page. Every report is reviewed.'),
    ].join('\n'),
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy — PakHotels',
    metaDescription: 'How PakHotels collects, uses and protects your information when you browse listings, create an account or post a property.',
    content: [
      p('This policy explains what information PakHotels collects, how it is used and the choices you have. By using the site you agree to it.'),
      '<h2>Information we collect</h2>',
      '<ul><li><strong>Account details</strong> — your name, email, phone and WhatsApp number, and anything you add to your profile.</li><li><strong>Listings</strong> — the details, photos, videos and location of properties you post. These are public.</li><li><strong>Usage</strong> — pages viewed, searches and clicks on call or WhatsApp buttons, used to show you and listing owners how listings perform.</li><li><strong>Cookies</strong> — to keep you signed in and to measure traffic (Google Analytics).</li></ul>',
      '<h2>How we use it</h2>',
      '<ul><li>To run your account and publish your listings.</li><li>To let tenants contact you — your phone and WhatsApp number appear on your listings and profile.</li><li>To review listings, prevent fraud and answer reports.</li><li>To improve the site.</li></ul>',
      p('We do not sell your personal information.'),
      '<h2>Sharing</h2>',
      p('Information you publish (listings and profile) is visible to everyone. We share other information only with service providers that help us run the site (hosting, analytics, email), or when required by law.'),
      '<h2>Your choices</h2>',
      p('You can edit your profile and listings at any time from your dashboard, mark a property rented or delete it, and ask us to close your account by contacting us.'),
      '<h2>Contact</h2>',
      p('Questions about this policy: see our <a href="/contact">contact page</a>.'),
    ].join('\n'),
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    metaTitle: 'Terms of Service — PakHotels',
    metaDescription: 'The terms for using PakHotels — posting rental listings, packages for dealers, and renting through the site.',
    content: [
      p('These terms apply to everyone who uses PakHotels. By using the site you agree to them.'),
      '<h2>The service</h2>',
      p('PakHotels is a listings platform. We are not a broker or a party to any rental agreement, and we do not guarantee any listing. Always visit the property, meet the owner and see their papers before paying any advance or security.'),
      '<h2>Posting listings</h2>',
      '<ul><li>Only properties for rent may be listed. You must own the property or be authorised to rent it out.</li><li>Listings must be accurate — real photos, monthly rent, size and location — and kept up to date. Mark a property rented when it is.</li><li>No duplicate, misleading or offensive listings, and no contact details inside descriptions or photos.</li><li>We may edit, hold or remove any listing, and suspend accounts that break these rules.</li></ul>',
      '<h2>Packages for dealers</h2>',
      p("Packages are paid in advance for the period shown and start once payment is verified. Limits and benefits are as described on the <a href=\"/packages\">packages page</a> at the time of purchase. Fees are not refundable once a package is active, unless the law requires otherwise. An agency is responsible for the accounts of its agents."),
      '<h2>Content</h2>',
      p('You keep ownership of what you post, and allow us to show it on the site and in our marketing. Do not upload material you do not have the right to use.'),
      '<h2>Liability</h2>',
      p('The site is provided as it is. To the extent the law allows, PakHotels is not liable for losses arising from listings, from dealings between users, or from the site being unavailable.'),
      '<h2>Changes</h2>',
      p('We may update these terms; the version on this page applies. Questions: see our <a href="/contact">contact page</a>.'),
    ].join('\n'),
  },
];
