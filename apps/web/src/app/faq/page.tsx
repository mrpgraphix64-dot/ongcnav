'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { Search, ChevronDown, MessageCircleQuestion, ArrowRight } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const categorizedFaqs: Record<string, FaqItem[]> = {
  'REGISTRATION & PASSES': [
    {
      question: 'How do I register for the ONGC Navratri 2026 event?',
      answer: 'ONGC employees and family members can register directly on the dedicated EWC Ahmedabad registration portal by clicking "GET YOUR QR PASS" in the navigation bar. Provide employee details, CPF number, and optionally add family members.',
    },
    {
      question: 'Who is eligible to register for passes?',
      answer: 'Registration is organized for ONGC employees, staff members, and their immediate family members under the EWC Ahmedabad event charter. General attendees may obtain passes through authorized committee desks.',
    },
    {
      question: 'How do I receive my digital pass after registering?',
      answer: 'Upon successful submission of the registration form, you will immediately be redirected to your digital pass page containing individual QR codes for each registered person. You can bookmark this link, take screenshots, or save your passes.',
    },
  ],
  'QR PASS & ENTRY': [
    {
      question: 'What must I show at the entry gate?',
      answer: 'Present your digital QR pass on your smartphone screen (or a clear printed copy) at any entry gate. Security scanners will verify and grant instant entry.',
    },
    {
      question: 'Can one QR pass be used by multiple people?',
      answer: 'No. Every individual pass generates a unique QR code. Primary employees and each registered family member receive their own distinct pass to ensure accurate gate counting and security.',
    },
    {
      question: 'Is re-entry allowed with the same QR pass on the same night?',
      answer: 'For crowd safety and security compliance, each pass permits one check-in per session. Re-entry guidelines will be administered by the gate volunteers.',
    },
    {
      question: 'What if my phone screen does not scan properly?',
      answer: 'Please increase your screen brightness to maximum. If scanning persists to fail, our gate volunteers can instantly verify your entry using your human-readable Ticket ID (e.g., EWC-100001).',
    },
  ],
  'TIMINGS & SCHEDULE': [
    {
      question: 'What are the daily event timings?',
      answer: 'The afternoon Garba Mandli takes place daily from 12:00 PM to 4:00 PM. Evening festivities begin at 7:00 PM with the Durga Aarti ceremony, followed by non-stop Raas Garba circles until 11:30 PM.',
    },
    {
      question: 'Which dates does the event run?',
      answer: 'ONGC Navratri 2026 runs across 9 auspicious nights from 11 October 2026 to 19 October 2026.',
    },
  ],
  'VENUE & FACILITIES': [
    {
      question: 'Where is the event venue located?',
      answer: 'The celebration is held at the ONGC Ground, Chandkheda, Ahmedabad, Gujarat. Clear directional signboards and designated parking areas will guide vehicles upon arrival.',
    },
    {
      question: 'Are parking facilities available?',
      answer: 'Yes, ample dedicated parking spaces for both two-wheelers and four-wheelers are provided near the venue perimeter with security attendants.',
    },
    {
      question: 'What facilities are available on the ground?',
      answer: 'The venue features purified drinking water stations, sanitized washroom blocks, first-aid & medical assistance booths, lost-and-found desks, and hygienic food and refreshment stalls.',
    },
  ],
  'SUPPORT & ASSISTANCE': [
    {
      question: 'I lost my pass. How can I look it up?',
      answer: 'Click "Check Ticket" in the header navigation or footer. Enter your Ticket ID to immediately retrieve and display your digital pass.',
    },
    {
      question: 'How can I contact the organizing committee?',
      answer: 'Visit our Contact page or reach out to the event support desk at support@ongcnavratri.com or visit the on-ground help desks at the main entrance.',
    },
  ],
};

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);

  const toggleAccordion = (idx: number) => {
    setActiveAccordion(activeAccordion === idx ? null : idx);
  };

  const matchesQuery = (q: string, a: string) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return q.toLowerCase().includes(term) || a.toLowerCase().includes(term);
  };

  let globalIdx = 0;

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="FAQ"
          title="FREQUENTLY ASKED QUESTIONS"
          subtitle="Everything you need to know about passes, entry, timings, and venue guidelines."
          breadcrumb="FAQ"
        />

        {/* MAIN FAQ CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

            {/* SEARCH BOX */}
            <div className="relative max-w-xl mx-auto">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions (e.g. QR pass, family, timing, parking)..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon shadow-xs transition-colors"
              />
            </div>

            {/* CATEGORIZED ACCORDION GROUPS */}
            <div className="space-y-10">
              {Object.entries(categorizedFaqs).map(([category, items]) => {
                const visibleItems = items.filter((faq) =>
                  matchesQuery(faq.question, faq.answer)
                );

                if (visibleItems.length === 0) return null;

                return (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gold/30">
                      <span className="w-2.5 h-2.5 rounded-full bg-gold" />
                      <h3 className="font-cinzel font-bold text-lg sm:text-xl text-maroon uppercase tracking-wider">
                        {category}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {visibleItems.map((faq) => {
                        const currentId = globalIdx++;
                        const isOpen = activeAccordion === currentId;

                        return (
                          <div
                            key={currentId}
                            className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden transition-all duration-200"
                          >
                            <button
                              type="button"
                              onClick={() => toggleAccordion(currentId)}
                              className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-outfit font-semibold text-sm sm:text-base text-ink hover:text-maroon transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-maroon-soft text-maroon text-xs flex items-center justify-center shrink-0 font-bold font-mono">
                                  Q
                                </span>
                                <span>{faq.question}</span>
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                                  isOpen ? 'rotate-180 text-maroon' : 'text-stone-400'
                                }`}
                              />
                            </button>

                            {isOpen && (
                              <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-ink/75 leading-relaxed border-t border-stone-100 bg-cream-soft/30">
                                <div className="pl-9">{faq.answer}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* STILL HAVE QUESTIONS CTA */}
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-gold/40 shadow-sm text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-gold/20 text-maroon flex items-center justify-center">
                <MessageCircleQuestion className="w-6 h-6" />
              </div>
              <h4 className="font-cinzel font-bold text-xl text-maroon">Still have questions?</h4>
              <p className="text-xs sm:text-sm text-ink-soft max-w-md mx-auto leading-relaxed">
                Our event coordination and help desk teams are on standby to answer your queries regarding passes, guidelines, and venue assistance.
              </p>
              <div className="pt-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-maroon text-white hover:bg-maroon-dark transition-all shadow-md border border-gold/40"
                >
                  <span>Contact Organizing Team</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
