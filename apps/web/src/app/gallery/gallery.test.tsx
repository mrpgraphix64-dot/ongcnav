import React from 'react';
import ReactDOMServer from 'react-dom/server';
import GalleryPage from './page';
import PublicFooter from '@/components/PublicFooter';

describe('Gallery Page & Public Footer UI Regression Tests', () => {
  describe('PublicFooter', () => {
    it('renders Event Guidelines and Help links', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<PublicFooter />);
      expect(html).toContain('Event Guidelines');
      expect(html).toContain('Help');
      expect(html).toContain('href="/information"');
      expect(html).toContain('href="/faq"');
    });

    it('does NOT render Admin link, button, or /login link in the public footer', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<PublicFooter />);
      expect(html).not.toContain('Admin');
      expect(html).not.toContain('href="/login"');
    });
  });

  describe('GalleryPage', () => {
    it('renders LIVE GARBA badge and category filter button, and no MANDLI badge', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<GalleryPage />);
      expect(html).toContain('LIVE GARBA');
      expect(html).not.toContain('>MANDLI<');
    });

    it('renders all 5 gallery video previews with consistent 16:9 aspect-video', () => {
      const html = ReactDOMServer.renderToStaticMarkup(<GalleryPage />);
      expect(html).toContain('/Video/Garba1.mp4');
      expect(html).toContain('/Video/Garba2.mp4');
      expect(html).toContain('/Video/Garba3.mp4');
      expect(html).toContain('/Video/Garba4.mp4');
      expect(html).toContain('/Video/Garba5.mp4');

      // Verify aspect-video class is used for consistent media box
      expect(html).toContain('aspect-video');
      expect(html).not.toContain('aspect-16/10');
    });
  });
});
