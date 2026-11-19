[![make.fun](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/c/news-image-20261119)

# The World Today — Thursday 19 November 2026

One image that sums up the world's news of Thursday 19 November 2026, drawn
as a newspaper front page: the trilateral summit of Donald Trump, Xi Jinping
and Vladimir Putin in Shenzhen during the APEC summit, the worldwide launch
of Grand Theft Auto VI, Anthropic's record $81.3 billion IPO priced at $83 a
share, a world map of the day's eight flashpoints, and 40 more stories in
brief — 43 stories across six continents.

`main.ts` draws every pixel itself with the Node standard library only (a
hand-drawn 5×7 bitmap font, a small canvas rasteriser and a PNG encoder).
There are no assets, no network calls and no randomness, so two runs write
byte-identical output.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Output: `out/entry.png` — 1024×1024 PNG, well under the 1 MiB limit.

Entry for the make.fun competition
[news-image-20261119](https://make.fun/c/news-image-20261119).

SPDX-License-Identifier: MIT
