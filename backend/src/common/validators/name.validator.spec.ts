import { PERSON_NAME_PATTERN } from './name.validator';

describe('PERSON_NAME_PATTERN', () => {
  it('should accept plain latin names', () => {
    const names = ['John', 'Doe', 'Ana Victoria', "O'Brien", 'Dalmazzo-Fernandez'];

    names.forEach((name) => {
      expect(PERSON_NAME_PATTERN.test(name)).toBe(true);
    });
  });

  it('should accept accented latin names', () => {
    const names = ['José', 'García', 'Müller', 'François', 'Núñez'];

    names.forEach((name) => {
      expect(PERSON_NAME_PATTERN.test(name)).toBe(true);
    });
  });

  it('should reject decorative unicode mathematical alphanumeric characters', () => {
    const names = ['𝔇𝔯𝔢𝔯', '𝕱𝖗𝖆𝖓𝖈𝖎𝖘𝖈𝖔', '𝓐𝓷𝓪'];

    names.forEach((name) => {
      expect(PERSON_NAME_PATTERN.test(name)).toBe(false);
    });
  });

  it('should reject digits and symbols', () => {
    const names = ['John123', '<script>', 'Ana@', '日本語'];

    names.forEach((name) => {
      expect(PERSON_NAME_PATTERN.test(name)).toBe(false);
    });
  });

  it('should reject a name that starts with a non-letter', () => {
    const names = [' John', '-Doe', "'Ana"];

    names.forEach((name) => {
      expect(PERSON_NAME_PATTERN.test(name)).toBe(false);
    });
  });

  it('should reject an empty string', () => {
    expect(PERSON_NAME_PATTERN.test('')).toBe(false);
  });
});
