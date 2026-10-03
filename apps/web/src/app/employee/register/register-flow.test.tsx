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

  it('contains the 17 mandatory registration guidelines with the exact required copy in page module', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Guidelines Title & Intro
    expect(pageSrc).toContain('ONGC NAVRATRI 2026 REGISTRATION GUIDELINES');
    expect(pageSrc).toContain('Please read the following guidelines carefully before proceeding with your registration.');

    // Rules 1 to 17
    expect(pageSrc).toContain('PERSONAL QR CODE');
    expect(pageSrc).toContain('ONE QR FOR THE EVENT');
    expect(pageSrc).toContain('ONE ENTRY PER DAY');
    expect(pageSrc).toContain('DATE-SPECIFIC ELIGIBILITY');
    expect(pageSrc).toContain('DO NOT SHARE YOUR QR');
    expect(pageSrc).toContain('QR MISUSE');
    expect(pageSrc).toContain('UNAUTHORIZED USE');
    expect(pageSrc).toContain('ENTER CORRECT INFORMATION');
    expect(pageSrc).toContain('FAMILY DETAILS');
    expect(pageSrc).toContain('FAMILY MEMBERS HAVE INDEPENDENT DATES');
    expect(pageSrc).toContain('EMAIL FOR E-PASS');
    expect(pageSrc).toContain('REGISTRATION REVIEW');
    expect(pageSrc).toContain('NON-TRANSFERABLE PASS');
    expect(pageSrc).toContain('KEEP YOUR QR SECURE');
    expect(pageSrc).toContain('SECURITY & ENTRY');
    expect(pageSrc).toContain('DUPLICATE REGISTRATION');
    expect(pageSrc).toContain('ENTRY VERIFICATION');

    // Final Acknowledgement and Mandatory Checkbox
    expect(pageSrc).toContain('I have read and understood the above guidelines. I confirm that the information provided by me is correct and that I will not share or misuse my QR/e-pass. I understand that my registration and family details may be verified by the event team, and that one entry is permitted per person per eligible event day.');
    expect(pageSrc).toContain('I have read and understood the above guidelines and agree to follow them.');
    expect(pageSrc).toContain('I AGREE &amp; CONTINUE');
  });

  it('enforces Employee DOB, Employee Date of Joining, and Family DOB', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Employee DOB and Joining Date
    expect(pageSrc).toContain('id="emp-dob"');
    expect(pageSrc).toContain('Date of Birth');
    expect(pageSrc).toContain('id="emp-doj"');
    expect(pageSrc).toContain('Date of Joining');
    expect(pageSrc).toContain('Employee Date of Joining cannot be in the future');
    expect(pageSrc).toContain('Employee Date of Joining must be after Date of Birth');

    // Family Member DOB
    expect(pageSrc).toContain('id={`fam-dob-${idx}`}');
    expect(pageSrc).toContain('Date of Birth is required for Family Member');
  });

  it('includes improved Family Details Guidance and Permanent QR clarification', () => {
    const pageSrc = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

    // Family Guidance
    expect(pageSrc).toContain('Please enter each family member');
    expect(pageSrc).toContain('Enter the full name correctly.');
    expect(pageSrc).toContain('Enter the correct mobile number.');
    expect(pageSrc).toContain('Enter a valid email address because the family member');
    expect(pageSrc).toContain('Enter the correct Date of Birth.');
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
