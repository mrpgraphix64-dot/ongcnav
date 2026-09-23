import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  QrCode,
  ShieldCheck,
  Users,
  Ticket,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  const schedule = [
    { night: 'Night 1', date: '2026-09-23', day: 'Wednesday', tithi: 'Pratipada', color: 'border-amber-400' },
    { night: 'Night 2', date: '2026-09-24', day: 'Thursday', tithi: 'Dwitiya', color: 'border-orange-400' },
    { night: 'Night 3', date: '2026-09-25', day: 'Friday', tithi: 'Tritiya', color: 'border-red-400' },
    { night: 'Night 4', date: '2026-09-26', day: 'Saturday', tithi: 'Chaturthi', color: 'border-pink-400' },
    { night: 'Night 5', date: '2026-09-27', day: 'Sunday', tithi: 'Panchami', color: 'border-purple-400' },
    { night: 'Night 6', date: '2026-09-28', day: 'Monday', tithi: 'Sasthi', color: 'border-indigo-400' },
    { night: 'Night 7', date: '2026-09-29', day: 'Tuesday', tithi: 'Saptami', color: 'border-blue-400' },
    { night: 'Night 8', date: '2026-09-30', day: 'Wednesday', tithi: 'Ashtami (Maha Aarti)', color: 'border-emerald-400' },
    { night: 'Night 9', date: '2026-10-01', day: 'Thursday', tithi: 'Navami & Dussehra', color: 'border-yellow-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-red-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-900/40 font-black text-2xl tracking-tighter text-white">
              ओ
            </div>
            <div>
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-red-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
                ONGC NAVRATRI 2026
              </span>
              <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                Digital Pass & Entry Control Portal
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 text-sm font-semibold">
            <Link
              href="/my-tickets"
              className="px-3.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              My Passes
            </Link>
            <Link
              href="/scanner"
              className="px-3.5 py-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-500/30 transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              Scanner App
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-900/30 transition-all font-medium"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/40 via-slate-900/0 to-transparent"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/80 border border-red-500/30 text-red-300 text-xs sm:text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              Official ONGC Officers & Employees Cultural Event
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
              Grand Dandiya & Garba <br />
              <span className="bg-gradient-to-r from-red-500 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
                Digital QR Entry Passes
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Register yourself and immediate family members. Receive instant encrypted QR passes for seamless turnstile access across all 9 auspicious nights.
            </p>

            {/* Quick Actions */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-lg shadow-xl shadow-red-900/50 flex items-center justify-center gap-3 transition-transform hover:-translate-y-0.5"
              >
                <Ticket className="w-6 h-6" />
                Register for Passes
                <ChevronRight className="w-5 h-5" />
              </Link>

              <Link
                href="/my-tickets"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-lg flex items-center justify-center gap-3 transition-all"
              >
                <QrCode className="w-6 h-6 text-amber-400" />
                Find My Pass by CPF
              </Link>
            </div>

            {/* Meta Info Pill */}
            <div className="mt-12 inline-flex flex-wrap items-center justify-center gap-6 px-6 py-3 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-400" />
                <span>Gates Open: 06:30 PM – 11:30 PM IST</span>
              </div>
              <span className="hidden sm:inline text-slate-600">•</span>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>ONGC Officers Club Ground, Complex-A</span>
              </div>
              <span className="hidden sm:inline text-slate-600">•</span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Encrypted 32-Byte QR Verification</span>
              </div>
            </div>
          </div>
        </section>

        {/* 9 Auspicious Nights Schedule */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                <Calendar className="w-7 h-7 text-amber-400" />
                9-Night Festival Schedule
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Passes are valid specifically for selected registered dates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule.map((item, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl bg-slate-800/40 border-l-4 ${item.color} border-slate-800 hover:bg-slate-800/80 transition-all`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    {item.night}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {item.tithi}
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {item.day}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  {item.date}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Luxury Sponsors Showcase */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
              Official Event Partners
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Our Esteemed Sponsors
            </h2>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 max-w-5xl mx-auto">
            {/* Title Sponsor Card */}
            <div className="w-full md:w-3/5 rounded-3xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-8 shadow-2xl border-2 border-amber-400/40 relative flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-red-900 to-amber-900 text-amber-200 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
                Title Sponsors
              </div>

              <div className="w-full flex flex-col items-center gap-6">
                {/* ZAIRA DIAMOND */}
                <div className="w-full flex items-center justify-center p-2">
                  <img
                    src="/images/sponsors/Zaira_Logo_With_Tagline_v17.jpg"
                    alt="Zaira Diamond"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>

                {/* Elegant Gold Divider */}
                <div className="w-3/5 flex items-center justify-center gap-3">
                  <span className="h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent flex-1" />
                  <span className="text-amber-500 text-xs">◆</span>
                  <span className="h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent flex-1" />
                </div>

                {/* OM SANCTUARY PALACE */}
                <div className="w-full flex items-center justify-center p-2">
                  <img
                    src="/images/sponsors/Om_Resort_Palace_Logowhitebg.jpg"
                    alt="Om Sanctuary Palace"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Media Sponsor Card */}
            <div className="w-full md:w-2/5 rounded-3xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-8 shadow-2xl border border-slate-200 relative flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-slate-800 text-slate-200 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
                Media Partner
              </div>

              <div className="w-full flex items-center justify-center py-6">
                <img
                  src="/images/sponsors/Lalkaar_News.png"
                  alt="Lalkaar News"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Access Guidelines */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-red-500" />
            Entry & Verification Guidelines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-300">
            <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 text-red-400 flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h3 className="font-bold text-white text-base mb-2">One Scan Per Pass / Day</h3>
              <p className="text-slate-400 leading-relaxed">
                Each digital pass allows exactly 1 successful entry per registered event day. Duplicate scans at turnstiles trigger immediate warning alerts.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h3 className="font-bold text-white text-base mb-2">Keep Pass Ready on Mobile</h3>
              <p className="text-slate-400 leading-relaxed">
                Save your pass to your phone or take a high-resolution screenshot. High-speed laser & camera scanners operate at all gate turnstiles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center font-bold text-lg mb-4">
                3
              </div>
              <h3 className="font-bold text-white text-base mb-2">Help Desk Assistance</h3>
              <p className="text-slate-400 leading-relaxed">
                In case of phone battery discharge or damaged screens, Help Desk counters at Gate 1 and Gate 3 provide verification via your ONGC CPF number.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Oil and Natural Gas Corporation Limited (ONGC). All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <span>Powered by Next.js & NestJS High-Performance Core</span>
            <Link href="/login" className="hover:text-slate-300">Staff Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
