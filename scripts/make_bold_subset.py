# 太字ラベル用の軽量フォント(NotoSansJP-Bold-Labels.ttf)と、その収録文字一覧(pdfBoldChars.ts)を
# 同時に作り直す。収録文字は「今のフォントの文字 + EXTRA」。元のフォントは同じ版(2.004)の
# NotoSansJP-Bold.ttf(OFL)。レイアウト機能(GSUB/GPOS)は入れない(数字の字形差し替えで隙間が出るため)。
import sys
from fontTools.ttLib import TTFont
from fontTools import subset

REPO = 'D:/ドキュメント/奉仕報告アプリ'
SRC = 'C:/Windows/Fonts/NotoSansJP-Bold.ttf'
OLD = f'{REPO}/public/fonts/NotoSansJP-Bold-Labels-v2.ttf'  # いま使っている版
# 中身を変えたら必ず版番号を上げた新しい名前で出す(sw.jsが /fonts/ を一度取ったら更新しないため)。
# 出力後、古いファイルを消し、pdfFonts.ts・pdfBoldChars.ts のファイル名も合わせること
OUT = f'{REPO}/public/fonts/NotoSansJP-Bold-Labels-v3.ttf'
CHARS_TS = f'{REPO}/src/lib/pdfBoldChars.ts'
# 足りない文字が見つかったら、ここに足して実行する(2026-10-03に「度」を追加)
EXTRA = '度'

old = TTFont(OLD)
old_cmap = old.getBestCmap()
codepoints = sorted(set(old_cmap) | {ord(c) for c in EXTRA})

opts = subset.Options()
opts.layout_features = []
opts.name_IDs = ['*']
opts.name_languages = ['*']
opts.notdef_outline = True
opts.hinting = False
opts.glyph_names = False
opts.drop_tables += ['BASE', 'GDEF', 'GPOS', 'GSUB', 'STAT', 'vhea', 'vmtx', 'gasp', 'prep']
font = TTFont(SRC)
sub = subset.Subsetter(opts)
sub.populate(unicodes=codepoints)
sub.subset(font)
font.save(OUT)

# 検証: 既存の文字の字幅は変わらないこと、追加文字が入っていること
new = TTFont(OUT)
new_cmap = new.getBestCmap()
missing = [chr(c) for c in codepoints if c not in new_cmap]
changed = [chr(c) for c in old_cmap
           if old['hmtx'][old_cmap[c]][0] != new['hmtx'][new_cmap[c]][0]]
print('glyphs', new['maxp'].numGlyphs, 'tables', sorted(new.keys()))
print('missing', missing, 'width_changed', changed[:20], len(changed))
for c in EXTRA:
    print(c, 'advance', new['hmtx'][new_cmap[ord(c)]][0])
if missing or changed:
    sys.exit(1)

chars = ''.join(chr(c) for c in sorted(new_cmap))
escaped = chars.replace('\\', '\\\\').replace("'", "\\'")
with open(CHARS_TS, encoding='utf-8') as f:
    ts = f.read()
start = ts.index("new Set('") + len("new Set('")
end = ts.index("')", start)
with open(CHARS_TS, 'w', encoding='utf-8', newline='\n') as f:
    f.write(ts[:start] + escaped + ts[end:])
print('chars', len(chars))
