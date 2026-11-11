# Tic-tac-toe for N players (CS 6364 project)

Tic-tac-toe in plain HTML/CSS/JavaScript, from the basic 3x3 game up to a
10x10 board with three machine players. On every board, 3 in a row (row,
column or diagonal) wins.

No build step or server. Open `index.html` (or any `TaskN/index.html`) in a
browser. Each task folder works on its own.

Live: https://anish-1221.github.io/tictactoe/

## Tasks

| Task | Board | Players | Search |
|---|---|---|---|
| 1 | 3x3 | human vs machine | minimax (the sample we were given, unchanged apart from the nav bar) |
| 2 | 3x3 | human vs machine | alpha-beta with move ordering; shows node counts vs plain minimax |
| 3 | 3x3 | machine vs machine | depth-limited alpha-beta, N games, scoreboard |
| 4 | 4x4 | 3 machines | alpha-beta (paranoid), N games, scoreboard |
| 5 | 3x3 to 10x10 | 3 machines | same as Task 4, with board size and search settings as controls |

## Notes

- **Move ordering.** Alpha-beta tries cells with the most open paths first
  (lines through the cell the opponent hasn't blocked): centre, corners,
  then edges on 3x3. From an empty board, plain minimax visits 549,946
  nodes, alpha-beta 20,866, and alpha-beta with ordering 6,347.
- **Three players.** Alpha-beta needs two sides, so in Tasks 4 and 5 each
  player assumes the other two are against it (the "paranoid" approach,
  Sturtevant & Korf 2000). max^n is available as an option to compare
  against; it can't prune, and searches a lot more nodes.
- **Draws.** Perfect play on 3x3 is always a draw, and so is 4x4 with three
  players at equal depth. Tasks 3 and 4 let you set each player's depth so
  the scoreboard isn't all draws.
- **Memory.** Task 5 caps the nodes searched per move (400,000 by default).
  Depth 4 finishes on every board up to 10x10; depth 5 hits the cap from
  6x6 up, and the page reports how many moves were cut short.

## Files

```
index.html     landing page
Task1/         the given sample (MIT licence, see Task1/README.md)
Task2-Task5/   index.html, engine.js (search, no DOM), app.js (page), style.css
shared/        master copies of style.css and the Task 4/5 engine
```

Task 1 is from *Artificial Intelligence in Game Development: Tic Tac Toe AI*
(Packt, MIT licence).
