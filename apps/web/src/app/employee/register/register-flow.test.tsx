import React from 'react';
import ReactDOMServer from 'react-dom/server';
import EmployeeRegisterPage from './page';
import fs from 'fs';
import path from 'path';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/employee/register',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock fetch
(global as any).fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  }),
);

describe('Employee Registration Flow (Web)', () => {
  it('renders Step 1 with ONGC Master verification, 5-digit CPF requirement and mobile input', () => {
    const html = ReactDOMServer.renderToString(<EmployeeRegisterPage />);
    expect(html).toContain('Select Employee Category');
    expect(html).toContain('Regular Employee');
    expect(html).toContain('Official ONGC Master-Data Verification');
    expect(html).toContain('CPF No. (Exactly 5 Digits)');
    expect(html).toMatch(/maxlength="5"/i);
    expect(html).toContain('Mobile No. (10 Digits)');
    expect(html).toContain('Verification');
    expect(html).toContain('Guidelines');
  });

  it('contains the 6 concise registration guidelines with the exact required copy in page module', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Guidelines Title & Intro
    expect(pageSrc).toContain('ONGC NAVRATRI 2026 REGISTRATION GUIDELINES');
    expect(pageSrc).toContain('Please read the following guidelines carefully before proceeding with your registration.');

    // 6 Concise Rules
    expect(pageSrc).toContain('ONE PERMANENT E-PASS PER PERSON');
    expect(pageSrc).toContain('STRICTLY PERSONAL & NON-TRANSFERABLE');
    expect(pageSrc).toContain('DATE-SPECIFIC AUTHORIZATION');
    expect(pageSrc).toContain('ONE ENTRY PER DAY');
    expect(pageSrc).toContain('GATE & PHYSICAL ID VERIFICATION');
    expect(pageSrc).toContain('ACCURATE INFORMATION');

    // Final Acknowledgement and Mandatory Checkbox
    expect(pageSrc).toContain('I confirm that the information provided is correct and I agree to the entry and E-Pass rules above.');
    expect(pageSrc).toContain('I AGREE &amp; CONTINUE');
  });

  it('enforces Employee DOB, Employee Date of Joining, while Family DOB is omitted', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Employee DOB and Joining Date
    expect(pageSrc).toContain('id="emp-dob"');
    expect(pageSrc).toContain('Date of Birth');
    expect(pageSrc).toContain('id="emp-doj"');
    expect(pageSrc).toContain('Date of Joining');
    expect(pageSrc).toContain('Employee Date of Joining cannot be in the future');
    expect(pageSrc).toContain('Employee Date of Joining must be after Date of Birth');

    // Family Member DOB should not be present
    expect(pageSrc).not.toContain('id={`fam-dob-${idx}`}');
    expect(pageSrc).not.toContain('Date of Birth is required for Family Member');
  });

  it('includes improved Family Details Guidance and Permanent QR clarification', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Family Guidance
    expect(pageSrc).toContain('Please enter each family member');
    expect(pageSrc).toContain('Enter the full name correctly.');
    expect(pageSrc).toContain('Enter the correct mobile number.');
    expect(pageSrc).toContain('Enter a valid email address because the family member');
    expect(pageSrc).not.toContain('Enter the correct Date of Birth.');
    expect(pageSrc).toContain('Select event dates separately for each family member.');
    expect(pageSrc).toContain('A family member will only be authorized to enter on the dates selected for that individual.');

    // QR Rule Clarification
    expect(pageSrc).toContain('One permanent QR code will be issued for all your selected event dates. Each QR permits one successful entry per selected event day.');
  });

  it('provides a Review screen before submission and submits guidelines acceptance', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    expect(pageSrc).toContain('Review Pass Registration Details');
    expect(pageSrc).toContain('Please verify all information before submitting.');
    expect(pageSrc).toContain('Changes may require admin review.');
    expect(pageSrc).toContain('guidelinesAccepted: true');
    expect(pageSrc).toContain('guidelinesVersion: \'2026-employee-registration-v1\'');
    expect(pageSrc).toContain('Back to Edit');
    expect(pageSrc).toContain('Submit Registration');
  });

  it('renders the 3-Card Scratch & Reveal Section in the post-registration success flow with pass retrieval CTA', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Scratch card component imported and rendered
    expect(pageSrc).toContain('import ScratchCardsSection from \'@/components/scratch-cards/ScratchCardsSection\';');
    expect(pageSrc).toContain('<ScratchCardsSection referenceNumber={referenceNumber || \'ONGC-2026\'} />');

    // Official Pass Reference Number banner and existing lookup link preserved
    expect(pageSrc).toContain('Official Pass Reference Number');
    expect(pageSrc).toContain('/employee/my-tickets');
    expect(pageSrc).toContain('View My Passes / Lookup');
  });
});
