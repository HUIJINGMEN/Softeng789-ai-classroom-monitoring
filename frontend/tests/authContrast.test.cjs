const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const css = readFileSync(path.join(__dirname, '../src/styles/auth.css'), 'utf8');

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

// Test the shipped declarations rather than duplicating an assumed palette in fixtures.
for (const selector of [
  '.auth-card ::selection',
  '.registration-step--active .registration-step__number',
  '.course-selector__add',
  '.course-selector__add:hover:not(:disabled)',
  '.course-selector__add:disabled',
  '.auth-course-modal .modal__close:hover',
  '.auth-card--face-step .face-step__back:hover:not(:disabled)',
  '.face-registration__submit-row .auth-form__submit:disabled',
  '.role-toggle__btn:hover',
  '.auth-form__submit:disabled',
]) {
  test(`${selector} has an opaque surface and at least 4.5:1 text contrast`, () => {
    const start = css.indexOf(selector + ' {');
    assert.notEqual(start, -1, 'selector must exist');
    const declarations = css.slice(start, css.indexOf('}', start));
    const foreground = declarations.match(/(?:^|[;\n])\s*color:\s*(#[a-f\d]{6})\s*;/i)?.[1];
    const background = declarations.match(/(?:^|[;\n])\s*background:\s*(#[a-f\d]{6})\s*;/i)?.[1];
    assert.ok(foreground && background, 'do not depend on an unknown video pixel or translucent ancestor');
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    const contrast = (levels[1] + 0.05) / (levels[0] + 0.05);
    assert.ok(contrast >= 4.5, `contrast was ${contrast.toFixed(2)}:1`);
  });
}
