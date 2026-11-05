# Task 1 — Supplied sample (3x3, human vs machine, plain minimax)

This is the sample code that came with the project brief, run as given.

**Source:** *Artificial Intelligence in Game Development — Tic Tac Toe AI*,
published by Packt, MIT licensed. The original licence is kept in `LICENSE.txt`.

## How to run

Open `index.html` in a browser. You play X and move first; the machine plays O.

## What it does

`script.js` implements plain minimax with no pruning. The search runs to the
bottom of the tree on every move:

- `miniMax(board, player)` returns `{id, score}` for the best move.
- Terminal positions score +10 for the machine, -10 for the human, 0 for a draw.
- The machine maximises, the human minimises.

Because 3x3 tic-tac-toe is small enough to search exhaustively, the machine
plays perfectly. A human cannot win; best play from both sides is a draw.

## Changes made to the supplied files

Two, both noted here so the original is still recognisable:

1. `index.html` had a stray empty `<!DOCTYPE html><html>…</html>` document
   wrapped around the real one. Browsers recover from this, but it is invalid
   markup, so the empty wrapper was removed.
2. A small navigation strip was added at the top of the page, and the matching
   `#tasknav` rule appended to `style.css`, so the five tasks can be reached
   from one another.

`script.js` is untouched.
