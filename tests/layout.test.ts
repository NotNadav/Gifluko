import { describe, expect, it } from 'vitest';
import { applyCase, boxCorners, layoutText, resolveDirection, wrapParagraph, type MeasureCtx } from '../src/render/layout';
import { defaultStyle } from '../src/model/defaults';

function fakeCtx(): MeasureCtx {
  const ctx = {
    font: '',
    direction: 'ltr' as CanvasDirection,
    letterSpacing: '0px',
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 10);
      const ls = parseFloat(ctx.letterSpacing) || 0;
      return { width: text.length * (size * 0.5 + ls), fontBoundingBoxAscent: size * 0.8, fontBoundingBoxDescent: size * 0.2 };
    }
  };
  return ctx;
}

const input = (over: Partial<ReturnType<typeof defaultStyle>> & { text: string }) => ({ ...defaultStyle(), ...over });

describe('direction', () => {
  it('detects from the first strong character', () => {
    expect(resolveDirection('שלום world', 'auto')).toBe('rtl');
    expect(resolveDirection('123 hello שלום', 'auto')).toBe('ltr');
    expect(resolveDirection('!!! 42', 'auto')).toBe('rtl');
    expect(resolveDirection('שלום', 'ltr')).toBe('ltr');
  });
});

describe('wrapping', () => {
  const m = (s: string) => s.length;
  it('wraps greedily by words', () => {
    expect(wrapParagraph('aa bb cc dd', 5, m)).toEqual(['aa bb', 'cc dd']);
  });
  it('breaks long words', () => {
    expect(wrapParagraph('abcdefgh', 3, m)).toEqual(['abc', 'def', 'gh']);
  });
  it('keeps empty paragraphs', () => {
    expect(wrapParagraph('', 3, m)).toEqual(['']);
  });
});

describe('layoutText', () => {
  it('lays out fixed-width boxes with alignment', () => {
    const l = layoutText(input({ text: 'aaaa bbbb cccc', fontSize: 10, boxWidth: 50, align: 'right', lineHeight: 1 }), 'x', fakeCtx(), true);
    expect(l.width).toBe(50);
    expect(l.lines.map((x) => x.text)).toEqual(['aaaa bbbb', 'cccc']);
    expect(l.lines[0].x).toBeCloseTo(5);
    expect(l.lines[1].x).toBeCloseTo(30);
    expect(l.height).toBe(20);
  });

  it('honours manual line breaks and content width', () => {
    const l = layoutText(input({ text: 'ab\nabcd', fontSize: 10, boxMode: 'auto', align: 'left' }), 'x', fakeCtx(), true);
    expect(l.lines.map((x) => x.text)).toEqual(['ab', 'abcd']);
    expect(l.width).toBe(20);
    expect(l.lines[0].x).toBe(0);
  });

  it('justifies all lines but the last', () => {
    const l = layoutText(input({ text: 'aa bb cc dd ee', fontSize: 10, boxWidth: 45, align: 'justify', direction: 'rtl' }), 'x', fakeCtx(), true);
    expect(l.lines[0].wordSpacing).toBeGreaterThan(0);
    expect(l.lines[0].width).toBe(45);
    expect(l.lines[l.lines.length - 1].wordSpacing).toBe(0);
  });

  it('auto-fits font size to the box width', () => {
    const l = layoutText(input({ text: 'abcdefghij', fontSize: 10, autoSize: true, boxWidth: 200 }), 'x', fakeCtx(), true);
    expect(l.fontSize).toBe(40);
    expect(l.lines).toHaveLength(1);
  });

  it('applies letter case', () => {
    expect(applyCase('Hello', 'upper')).toBe('HELLO');
    expect(applyCase('Hello', 'lower')).toBe('hello');
    expect(applyCase('שלום', 'upper')).toBe('שלום');
  });
});

describe('boxCorners', () => {
  it('positions around the anchor with rotation', () => {
    const c = boxCorners(100, 100, 40, 20, 'mc', 0);
    expect(c[0]).toEqual([80, 90]);
    const r = boxCorners(0, 0, 10, 10, 'tl', 90);
    expect(r[1][0]).toBeCloseTo(0);
    expect(r[1][1]).toBeCloseTo(10);
  });
});
