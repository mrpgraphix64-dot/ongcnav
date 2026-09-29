import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ContactPage, { metadata } from './page';
import PublicFooter from '@/components/PublicFooter';

describe('Contact Page & Venue Location Tests', () => {
  describe('ContactPage Component', () => {
    it('renders the correct venue location: Malaviya Cricket Ground ONGC, Ahmedabad', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<ContactPage />);
      expect(html).toContain('Malaviya Cricket Ground ONGC');
      expect(html).toContain('4H3Q+7F8, Mahavirnagar, ONGC Colony,');
      expect(html).toContain('Chandkheda, Ahmedabad, Gujarat 382424');
      expect(html).toContain('Reaching Malaviya Cricket Ground ONGC');
    });

    it('embeds Google Maps pointing to 4H3Q+7F8 Chandkheda, Ahmedabad', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<ContactPage />);
      expect(html).toContain(
        'src="https://maps.google.com/maps?q=4H3Q%2B7F8,+Mahavirnagar,+ONGC+Colony,+Chandkheda,+Ahmedabad,+Gujarat+382424&amp;t=&amp;z=16&amp;ie=UTF8&amp;iwloc=&amp;output=embed"'
      );
      expect(html).toContain('title="Malaviya Cricket Ground ONGC Map"');
    });

    it('provides a View on Google Maps link opening the destination', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<ContactPage />);
      expect(html).toContain(
        'href="https://www.google.com/maps/search/?api=1&amp;query=4H3Q%2B7F8+Mahavirnagar+ONGC+Colony+Chandkheda+Ahmedabad+Gujarat+382424"'
      );
      expect(html).toContain('View on Google Maps');
    });

    it('displays all three contact numbers with working tel: links in responsive format', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<ContactPage />);
      expect(html).toContain('href="tel:9898085701"');
      expect(html).toContain('>9898085701<');
      expect(html).toContain('href="tel:8000088813"');
      expect(html).toContain('>8000088813<');
      expect(html).toContain('href="tel:8980004518"');
      expect(html).toContain('>8980004518<');
      // Responsive wrap class
      expect(html).toContain('inline-flex flex-wrap items-center');
    });
  });

  describe('Contact Page Metadata', () => {
    it('has title and description referencing Malaviya Cricket Ground ONGC, Ahmedabad', () => {
      expect(metadata.title).toBe('Get in Touch & Venue | ONGC Navratri 2026');
      expect(metadata.description).toContain('Malaviya Cricket Ground ONGC, Ahmedabad');
    });
  });

  describe('PublicFooter Venue & Helpline', () => {
    it('displays Malaviya Cricket Ground ONGC, Ahmedabad, and all three contact helpline links', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<PublicFooter />);
      expect(html).toContain('Malaviya Cricket Ground ONGC');
      expect(html).toContain('Chandkheda');
      expect(html).toContain('Ahmedabad, Gujarat');
      expect(html).toContain('href="tel:9898085701"');
      expect(html).toContain('href="tel:8000088813"');
      expect(html).toContain('href="tel:8980004518"');
    });
  });
});
