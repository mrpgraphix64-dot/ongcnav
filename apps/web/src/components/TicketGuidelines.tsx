import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function TicketGuidelines({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="ticket-guidelines"
      className={`bg-white rounded-2xl p-5 sm:p-6 border border-gold/40 shadow-sm space-y-3.5 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
        <ShieldCheck className="w-5 h-5 text-maroon shrink-0" />
        <h3 className="font-outfit font-black text-sm sm:text-base uppercase tracking-wider text-ink">
          Ticket Guidelines
        </h3>
      </div>
      <ol className="space-y-2.5 list-decimal list-inside text-xs sm:text-sm text-stone-700 leading-relaxed font-medium">
        <li>Your digital QR pass will be sent to your registered email address.</li>
        <li>A valid email address is mandatory for receiving and recovering your digital passes.</li>
        <li>Tickets are strictly non-refundable and non-transferable under any circumstances.</li>
        <li>Each QR pass is unique to your booking. Do not share your QR pass with unauthorized persons.</li>
        <li>Entry is permitted upon scanning a valid digital QR pass at the entrance gate.</li>
        <li>
          <span>The pass is valid strictly according to your selected pass type, booking date, and applicable timing:</span>
          <ul className="list-disc list-inside pl-5 mt-1 space-y-1 text-stone-600 font-normal">
            <li>Daily / Season / Any Day Passes: 8:00 PM – 4:00 AM</li>
            <li>Mandli Passes: 12:00 AM – 4:00 AM</li>
          </ul>
        </li>
        <li>Please keep your QR pass readily available on your phone at the entry gate.</li>
        <li>Re-entry into the venue may not be permitted once you exit.</li>
        <li>Management reserves the right of admission.</li>
      </ol>
    </div>
  );
}
