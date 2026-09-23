'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import PublicHeader from '@/components/PublicHeader';
import PublicFooter from '@/components/PublicFooter';
import PageHero from '@/components/PageHero';
import { Maximize2, X, Camera } from 'lucide-react';

interface GalleryItem {
  title: string;
  category: string;
  image: string;
  caption: string;
}

const categories = ['ALL', 'GARBA', 'CULTURE', 'CELEBRATION', 'VENUE', 'MOMENTS'];

const galleryItems: GalleryItem[] = [
  {
    title: 'Sponsor Pavilion & Festive Stage',
    category: 'CELEBRATION',
    image: '/images/bg.png',
    caption: 'The illuminated main stage and grand pavilion at ONGC Ground Ahmedabad.',
  },
  {
    title: 'Garba Dance & Folk Heritage',
    category: 'GARBA',
    image: '/images/left.png',
    caption: 'Traditional festive attire and expressive Garba steps honoring heritage.',
  },
  {
    title: 'Devotion & Festive Rhythm',
    category: 'CULTURE',
    image: '/images/right.png',
    caption: 'Vibrant colours and celebration of cultural unity during Navratri.',
  },
  {
    title: 'Stage Arch & Auspicious Kalash',
    category: 'VENUE',
    image: '/images/2ndsecleft.png',
    caption: 'Traditional ceremonial decor with marigold arches, brass diyas, and kalash.',
  },
  {
    title: 'Golden Hanging Lamps & Ambiance',
    category: 'MOMENTS',
    image: '/images/2ndsecright.png',
    caption: 'Warm festive lighting illuminating the grounds and creating a royal atmosphere.',
  },
];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  const filteredItems =
    activeCategory === 'ALL'
      ? galleryItems
      : galleryItems.filter((item) => item.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* PAGE HERO */}
        <PageHero
          badge="GALLERY"
          title="MOMENTS OF NAVRATRI"
          subtitle="Experience the spirit, colors, devotion and joy through our visual gallery."
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

            {/* MASONRY GALLERY GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxItem(item)}
                  className="bg-white rounded-3xl overflow-hidden border border-stone-200/90 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                >
                  {/* Image Wrap */}
                  <div className="relative overflow-hidden bg-stone-100 aspect-4/3 flex items-center justify-center">
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={600}
                      height={450}
                      className="w-full h-full object-contain sm:object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-maroon-dark/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-light">
                        <Maximize2 className="w-4 h-4" /> View Full Image
                      </span>
                    </div>

                    {/* Category Badge */}
                    <span className="absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/90 backdrop-blur-xs text-maroon shadow-xs border border-gold/30">
                      {item.category}
                    </span>
                  </div>

                  {/* Card Caption Info */}
                  <div className="p-5 space-y-1 bg-white">
                    <h3 className="font-cinzel font-bold text-base text-ink group-hover:text-maroon transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-ink/70 line-clamp-2 leading-relaxed">
                      {item.caption}
                    </p>
                  </div>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-cream-soft text-maroon flex items-center justify-center">
                    <Camera className="w-8 h-8" />
                  </div>
                  <h3 className="font-cinzel font-bold text-xl text-ink">NO MOMENTS FOUND</h3>
                  <p className="text-xs text-ink-soft max-w-md mx-auto">
                    No images match the selected category currently.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* LIGHTBOX MODAL */}
        {lightboxItem && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxItem(null)}
          >
            <div
              className="bg-white rounded-3xl overflow-hidden max-w-3xl w-full border border-gold/40 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative aspect-16/10 bg-stone-900 flex items-center justify-center">
                <Image
                  src={lightboxItem.image}
                  alt={lightboxItem.title}
                  width={1200}
                  height={800}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-6 bg-white space-y-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-maroon-soft text-maroon border border-maroon/20">
                  {lightboxItem.category}
                </span>
                <h3 className="font-cinzel font-bold text-xl text-maroon">
                  {lightboxItem.title}
                </h3>
                <p className="text-sm text-ink/80 leading-relaxed">
                  {lightboxItem.caption}
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
