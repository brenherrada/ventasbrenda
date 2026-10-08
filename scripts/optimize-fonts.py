"""Optional asset preparation; requires fonttools[woff], not needed for npm run build.
Keep the original WOFF2 inputs for reproducibility. Preserve all glyphs and layout
features, removing only weights below the original default (400). Keeping the original
default preserves advance widths and sub-unit outline accuracy in the CSS range (600–800).
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

for source, target in [
    ('latin-4.woff2', 'playpen-latin-ext-400-800.woff2'),
    ('latin-5.woff2', 'playpen-latin-400-800.woff2'),
]:
    original = TTFont(Path('fonts') / source)
    reduced = instantiateVariableFont(original, {'wght': (400, 800)}, inplace=False)
    assert original.getBestCmap() == reduced.getBestCmap()
    assert original.getGlyphOrder() == reduced.getGlyphOrder()
    # Test outlines and advance widths at all CSS weights, including intermediates.
    max_delta = 0
    for weight in [600, 650, 700, 750, 800]:
        before = instantiateVariableFont(original, {'wght': weight}, inplace=False)
        after = instantiateVariableFont(reduced, {'wght': weight}, inplace=False)
        assert before['hmtx'].metrics == after['hmtx'].metrics
        for name in before.getGlyphOrder():
            a = before['glyf'][name].getCoordinates(before['glyf'])[0]
            b = after['glyf'][name].getCoordinates(after['glyf'])[0]
            assert len(a) == len(b)
            for p, q in zip(a, b):
                max_delta = max(max_delta, abs(p[0] - q[0]), abs(p[1] - q[1]))
    assert max_delta <= 1, max_delta
    reduced.save(Path('fonts') / target)
    print(f'{source} -> {target}: {(Path("fonts") / target).stat().st_size} bytes; max outline delta {max_delta} font units')
