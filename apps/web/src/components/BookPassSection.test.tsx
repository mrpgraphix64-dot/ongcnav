import React from 'react';
import ReactDOMServer from 'react-dom/server';
import BookPassSection, { PASS_OPTIONS } from './BookPassSection';

describe('BookPassSection Component Tests', () => {
  it('renders payment disabled banner and disabled button when paymentEnabled=false', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <BookPassSection paymentEnabled={false} isPreview={false} />
    );

    expect(html).toContain('Online Payments Paused');
    expect(html).toContain('Online payments are currently unavailable. Please try again later.');
    expect(html).toContain('PAYMENTS OFF');
    expect(html).toContain('ONLINE PAYMENT UNAVAILABLE');
    expect(html).toContain('data-testid="payment-disabled-banner"');
    expect(html).toContain('data-testid="payment-disabled-control"');
  });

  it('renders preview submit button when isPreview=true and paymentEnabled=true', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <BookPassSection paymentEnabled={true} isPreview={true} />
    );

    expect(html).not.toContain('payment-disabled-banner');
    expect(html).toContain('BUY YOUR PASS');
    expect(html).toContain('(PREVIEW ONLY)');
    expect(html).toContain('Real payments cannot be initiated in Preview');
  });

  it('renders accurate pass pricing and options', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <BookPassSection paymentEnabled={false} />
    );

    expect(html).toContain('Daily Pass');
    expect(html).toContain('Season Pass');
    expect(html).toContain('Mandli Pass');
    expect(html).toContain('Any Day Pass');
    expect(html).toContain('₹279');
    expect(html).toContain('₹249');
    expect(html).toContain('₹1,750');
    expect(html).toContain('₹149');
  });

  it('renders customer fields and terms acceptance checkbox', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <BookPassSection paymentEnabled={false} />
    );

    expect(html).toContain('Full Name');
    expect(html).toContain('Mobile Number');
    expect(html).toContain('Email Address');
    expect(html).toContain('terms-checkbox');
    expect(html).toContain('I have read and agree to the ticket terms &amp; conditions.');
  });
});
