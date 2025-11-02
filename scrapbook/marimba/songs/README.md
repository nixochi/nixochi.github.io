# Songs Folder

Place ABC notation files (`.abc`) in this folder to play them on the permutahedron.

## ABC Notation Format

ABC notation is a simple text format for music. Basic syntax:

```abc
X:1
T:Song Title
M:4/4
L:1/8
K:C
CDEF GABc | [CEG]4 z4 |
```

**Header fields:**
- `X:1` - Reference number
- `T:` - Title
- `M:4/4` - Time signature
- `L:1/8` - Default note length (eighth notes)
- `K:C` - Key signature

**Notes:**
- `C D E F G A B` - Notes in the middle octave (C4-B4)
- `c d e f g a b` - Notes in the upper octave (C5-B5)
- `^C` - C sharp
- `_C` - C flat
- `[CEG]` - Chord (notes together)
- `z` - Rest
- `|` - Bar line

**Note lengths:**
- `C` - Default length (set by L:)
- `C2` - Double length
- `C/2` - Half length
- `C4` - Four times length

## Dynamic Note Mapping

The permutahedron has 14 faces that are **dynamically mapped** to notes based on your song:
- Face 0 = Lowest note used in the song
- Face 1 = Next note up
- Face 2 = Next note up
- ... and so on

**Example 1:** If your song only uses C, D, E, F, G (5 notes):
- Face 0 = C, Face 1 = D, Face 2 = E, Face 3 = F, Face 4 = G
- Faces 5-13 remain unused

**Example 2:** If your song uses G, A, B, C5, D5 (5 notes in a higher range):
- Face 0 = G, Face 1 = A, Face 2 = B, Face 3 = C5, Face 4 = D5
- The visualization will show these 5 faces lighting up

This means you can write songs in any range and use up to 14 unique notes!

## Resources

- [ABC Notation Standard](https://abcnotation.com)
- [The Session](https://thesession.org) - 45,000+ tunes in ABC format
- [ABC Tune Search](https://www.abctunesearch.com)

## Adding Songs

1. Create a new `.abc` file in this folder
2. Edit `permutahedron.js` and change `currentSongName = 'your-song.abc'`
3. Reload the page
