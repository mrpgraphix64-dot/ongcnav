import React from 'react';
import ReactDOMServer from 'react-dom/server';
import PasswordInput from './PasswordInput';

describe('PasswordInput Component Unit Tests', () => {
  it('renders input with type="password" by default', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <PasswordInput
        name="password"
        value="Secret123"
        onChange={() => {}}
      />,
    );

    expect(html).toContain('type="password"');
    expect(html).toContain('value="Secret123"');
  });

  it('renders accessible visibility toggle button with aria-label and title', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <PasswordInput
        name="password"
        value="Secret123"
        onChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('title="Show password"');
    expect(html).toContain('type="button"');
  });

  it('preserves input value without modification', () => {
    const testVal = 'MySpecialP@ssw0rd!';
    const html = ReactDOMServer.renderToStaticMarkup(
      <PasswordInput
        value={testVal}
        onChange={() => {}}
      />,
    );

    expect(html).toContain(`value="${testVal}"`);
  });

  it('renders left icon if provided', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <PasswordInput
        iconLeft={<span data-testid="lock-icon">LOCK</span>}
        value="test"
        onChange={() => {}}
      />,
    );

    expect(html).toContain('data-testid="lock-icon"');
    expect(html).toContain('pl-10');
  });

  it('respects disabled state on both input and toggle button', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <PasswordInput
        disabled
        value="disabled-pass"
        onChange={() => {}}
      />,
    );

    // Both input and button should be disabled
    const disabledOccurrences = (html.match(/disabled=""/g) || html.match(/disabled/g) || []).length;
    expect(disabledOccurrences).toBeGreaterThanOrEqual(2);
  });

  it('respects required attribute', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <PasswordInput
        required
        value=""
        onChange={() => {}}
      />,
    );

    expect(html).toContain('required');
  });
});
