'use client';

import React, { useState, useEffect, useRef } from 'react';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { Play, X, Video, Sparkles } from 'lucide-react';

interface GalleryVideoItem {
  id: string;
  title: string;
  category: string;
  videoSrc: string;
  caption: string;
}

const categories = ['ALL', 'GARBA', 'CULTURE', 'CELEBRATION', 'LIVE GARBA', 'MOMENTS'];

const galleryVideos: GalleryVideoItem[] = [
  {
    id: 'garba-1',
    title: 'Grand Raas Garba Circles',
    category: 'GARBA',
    videoSrc: '/Video/Garba1.mp4',
    caption: 'Vibrant circular Garba steps with devotees dancing enthusiastically to live rhythmic folk beats.',
  },
  {
    id: 'garba-2',
    title: 'Devotional Garba & Folk Symphony',
    category: 'CULTURE',
    videoSrc: '/Video/Garba2.mp4',
    caption: 'Energetic traditional dance and music celebrating the sacred spirit and heritage of Gujarat.',
  },
  {
    id: 'garba-3',
    title: 'Maha Raas Garba Gathering',
    category: 'CELEBRATION',
    videoSrc: '/Video/Garba3.mp4',
    caption: 'Thousands of devotees and dancers moving in unison across the illuminated ONGC festive arena.',
  },
  {
    id: 'garba-4',
    title: 'Mandli Garba Traditional Steps',
    category: 'LIVE GARBA',
    videoSrc: '/Video/Garba4.mp4',
    caption: 'Authentic acoustic Mandli Garba with traditional clapping rhythms under the midnight starlit sky.',
  },
  {
    id: 'garba-5',
    title: 'Festive Night Finale & Energy',
    category: 'MOMENTS',
    videoSrc: '/Video/Garba5.mp4',
    caption: 'High-energy Raas Garba celebration electrifying the grounds with folk devotion and joy.',
  },
];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeVideo, setActiveVideo] = useState<GalleryVideoItem | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  const filteredVideos =
    activeCategory === 'ALL'
      ? galleryVideos
      : galleryVideos.filter((item) => item.category === activeCategory);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeModal = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause();
      modalVideoRef.current.currentTime = 0;
    }
    setActiveVideo(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="VIDEO HIGHLIGHTS"
          title="MOMENTS OF NAVRATRI"
          subtitle="Experience the spirit, rhythm, devotion and vibrant energy through live video highlights."
          breadcrumb="Gallery"
        />

        {/* MAIN GALLERY CONTENT */}
        <div className="py-16 sm:py-24 bg-cream relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

            {/* CATEGORY FILTER BUTTONS */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-maroon text-white shadow-md border-gold/40'
                      : 'bg-white text-ink/70 hover:text-maroon hover:bg-cream-soft border-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* VIDEO GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredVideos.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveVideo(item)}
                  className="bg-white rounded-3xl overflow-hidden border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer flex flex-col"
                >
                  {/* Video Preview Wrap - Consistent 16:9 responsive media area */}
                  <div className="relative overflow-hidden bg-stone-900 aspect-video w-full flex items-center justify-center">
                    <video
                      src={item.videoSrc}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Gradient & Darkening Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-maroon-dark/80 via-black/30 to-transparent group-hover:via-black/40 transition-colors duration-300" />

                    {/* Center Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-maroon/90 text-gold-light border-2 border-gold/80 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-maroon group-hover:shadow-[0_0_24px_rgba(212,175,55,0.6)] transition-all duration-300">
                        <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-gold-light text-gold-light ml-0.5" />
                      </div>
                    </div>

                    {/* Bottom Hover Caption Action */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-bold text-gold-light opacity-90 group-hover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1.5 drop-shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-gold" /> Watch Highlight
                      </span>
                      <span className="text-[10px] text-white/80 font-mono uppercase bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                        HD VIDEO
                      </span>
                    </div>

                    {/* Category Badge */}
                    <span className="absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/95 backdrop-blur-xs text-maroon shadow-xs border border-gold/30">
                      {item.category}
                    </span>
                  </div>

                  {/* Card Caption Info */}
                  <div className="p-5 space-y-1.5 bg-white flex-1 flex flex-col justify-start">
                    <h3 className="font-cinzel font-bold text-base text-ink group-hover:text-maroon transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-ink/70 line-clamp-2 leading-relaxed">
                      {item.caption}
                    </p>
                  </div>
                </div>
              ))}

              {filteredVideos.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-cream-soft text-maroon flex items-center justify-center">
                    <Video className="w-8 h-8" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-ink">NO VIDEOS FOUND</h3>
                  <p className="text-xs text-ink-soft max-w-md mx-auto">
                    No video highlights match the selected category currently.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* VIDEO LIGHTBOX MODAL */}
        {activeVideo && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
            onClick={closeModal}
          >
            <div
              className="bg-stone-950 rounded-3xl overflow-hidden max-w-4xl w-full border border-gold/40 shadow-2xl relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close video player"
                className="absolute top-3.5 right-3.5 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-maroon text-white flex items-center justify-center transition-all duration-200 border border-white/20 shadow-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Video Player Frame */}
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={modalVideoRef}
                  key={activeVideo.videoSrc}
                  src={activeVideo.videoSrc}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Video Details Bar */}
              <div className="p-5 sm:p-6 bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-maroon-soft text-maroon border border-maroon/20">
                    {activeVideo.category}
                  </span>
                  <span className="text-[11px] font-mono text-ink-muted">
                    Official Video Highlight
                  </span>
                </div>
                <h3 className="font-cinzel font-bold text-lg sm:text-xl text-maroon">
                  {activeVideo.title}
                </h3>
                <p className="text-xs sm:text-sm text-ink/80 leading-relaxed">
                  {activeVideo.caption}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
