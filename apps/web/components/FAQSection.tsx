'use client'
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * Questions tenants and landlords actually ask. They also go out as FAQPage
 * structured data, so every answer must stay true to what the site does.
 */
const FAQS = [
  {
    question: 'Is PakHotels only for rentals?',
    answer:
      'Yes. PakHotels lists properties for rent only — houses, upper and lower portions, flats, rooms, hostels, shops, offices and warehouses. There are no listings for sale, so every result is something you can rent.',
  },
  {
    question: 'How much does it cost to find a place on PakHotels?',
    answer:
      'Nothing. Searching, browsing and calling or WhatsApping owners and dealers is free, and you do not need an account to contact them.',
  },
  {
    question: 'How do I stay safe from rental scams?',
    answer:
      'Every listing is checked before it goes live, and anything suspicious waits for our team. Still, always visit the property and meet the owner before paying any advance, security or “token” money — and never pay someone who says they are abroad and will send the keys. If a listing looks wrong, use “Report this listing” on its page.',
  },
  {
    question: 'What should I check before renting a house or portion?',
    answer:
      'Check the owner’s CNIC and proof of ownership, agree the monthly rent, advance and security in writing, note who pays the electricity, gas and water bills, and sign a rent agreement on stamp paper. Many cities also require the tenant to be registered with the local police — your landlord or dealer can help with that.',
  },
  {
    question: 'Can I list my house or portion for rent for free?',
    answer:
      'Yes. Every account can list one rental for free, with photos and a video. Dealers with more properties can choose a monthly package for more listings and featured placement.',
  },
  {
    question: 'Which cities do you cover?',
    answer:
      'Rentals are listed in Lahore, Islamabad, Rawalpindi, Karachi, Multan, Faisalabad, Gujranwala, Sahiwal, Bahawalpur and other cities across Pakistan, searchable by area, type, size and monthly rent.',
  },
];

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(0);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <section className="py-5 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="container mx-auto grid gap-6 px-4 lg:grid-cols-[320px_1fr] lg:gap-12">
        <SectionHeading
          title="Frequently asked questions"
          description="Renting a home or listing one in Pakistan."
          className="mb-0 items-start"
        />

        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5"
                >
                  <span className="text-[15px] font-semibold text-slate-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {/* Always in the HTML, only hidden: FAQPage structured data
                    should match content that is on the page, collapsed or not. */}
                <p
                  hidden={!isOpen}
                  className="px-4 pb-4 text-[14px] leading-relaxed text-slate-600 sm:px-5"
                >
                  {faq.answer}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
