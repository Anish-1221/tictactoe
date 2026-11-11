# Tic-Tac-Toe for N players: CS 6364 project

Five browser implementations of tic-tac-toe, moving from the two-player
3×3 game with plain minimax up to a 10×10 board played by three machine
players. On every board size the rule is the one set for the project:
the first player to get three of its marks in a row, a column or a
diagonal wins.

Everything is plain HTML, CSS and JavaScript. There is no build step, no
package manager and no server: open any task's `index.html` in a browser
and it runs. Each task folder is self-contained, so it can be zipped and
submitted on its own.

Live: https://anish-1221.github.io/tictactoe/

## Running it

```
index.html            landing page linking all five tasks
Task1/index.html      open in a browser
Task2/index.html
Task3/index.html
Task4/index.html
Task5/index.html
```

Every page has a strip of links to the other four in the top right.

## The tasks

| | Board | Players | Algorithm | What it adds |
|---|---|---|---|---|
| **Task 1** | 3×3 | human vs machine | plain minimax | The supplied sample, run as given |
| **Task 2** | 3×3 | human vs machine | alpha-beta, open paths ordering | Counts nodes three ways, so pruning and ordering are measured rather than claimed |
| **Task 3** | 3×3 | machine vs machine | depth-limited alpha-beta | Runs N games and tallies wins, losses and draws |
| **Task 4** | 4×4 | 3 machines | alpha-beta, paranoid | Three players; max<sup>n</sup> available for comparison |
| **Task 5** | B×B, B=3..10 | 3 machines | alpha-beta, paranoid, with heuristics | Scales up; search heuristics are exposed as controls |

## Algorithms, in short

**Minimax** (Task 1) assumes two players with exactly opposed interests, so
one number describes the position for both. On a 3×3 board the whole game
tree fits in memory, so the machine plays perfectly and cannot be beaten.

**Alpha-beta pruning** (Tasks 2 to 5) returns a move of the same value
while visiting far fewer positions. From an empty 3×3 board, plain minimax
explores 549,946 nodes, alpha-beta with moves in board order needs 20,866,
and alpha-beta with open paths ordering needs 6,347. Task 2 runs all three
on every move and shows the counts side by side.

**Open paths ordering** (Tasks 2 to 5). Alpha-beta cuts more when strong
moves are tried first. Moves are ordered by the number of possible paths
still open through the cell: lines through it that no opponent has a mark
in. On an empty 3×3 board that is 4 for the centre, 3 for a corner and 2
for an edge. On the larger boards, moves that complete or block a line go
ahead of that.

**Alpha-beta with three players** (Tasks 4 and 5). Minimax needs two sides
with one number between them. The *paranoid* assumption (Sturtevant and
Korf, 2000) provides that: the player choosing a move assumes the other two
are working together against it, so the game becomes "me" against
"everyone else", and minimax with alpha-beta applies unchanged. A move that
holds up against two co-operating opponents holds up against two
independent ones.

**max<sup>n</sup>** (Luckhardt and Irani, 1986) is kept in Tasks 4 and 5 as
a comparison. It scores each position as a vector with one value per
player and each player maximises its own. It models the players more
faithfully, but there is no single number, so no alpha and beta and no
deep pruning. On the same positions it visits roughly 2 to 15 times as
many nodes as alpha-beta on 4×4, and up to about 75 times as many on the
larger boards.

## Things worth knowing

**Equal search depths draw.** On 3×3 two full-depth agents draw every
game, which is the correct result for tic-tac-toe. On 4×4 with three
players and three in a row, any line one player starts can be blocked by
either of the other two, and every game at equal depths from 2 to 6 ended
drawn. Tasks 3 and 4 therefore let each player have its own depth;
lowering one is what produces wins and losses to count.

**Deterministic agents would replay the same game N times.** The search
picks at random among moves sharing the best *exact* value, and on larger
boards the opening is drawn at random from the cells with the most paths
through them, which are equivalent by symmetry at that point.

**The root never treats a bound as a tie.** Under alpha-beta a score equal
to `alpha` is only an upper bound, not an exact value. Collecting such
scores as ties and then choosing at random let a supposedly perfect agent
pick a losing move; this was a real bug during development, visible as
full-depth agents failing to draw. Task 3's root searches each candidate
with a full window. Tasks 4 and 5 search each root move with alpha just
below the best value so far, which still returns an exact value for any
move that ties the best.

**Paranoid players can give up.** If player 1 has two open threats, player
2 can block only one and assumes player 3 will not block the other, so
every move scores the same loss. Ties at the root are therefore broken in
favour of leaving the fewest open threats for other players, then by the
evaluation function. That makes player 2 block one end, so that player 3
blocking the other actually saves the game.

## Measured limits

Three players, three in a row, candidate radius 2, ceiling of 400,000
nodes per move:

| Board | Depth 4 | Depth 5 |
|---|---|---|
| 3×3 to 5×5 | completes | completes |
| 6×6 to 10×10 | completes, peak ~71k nodes on 10×10, about 1 s per game | **exceeds ceiling** |

Past the ceiling the search returns its best result so far and the run
reports how many moves were cut short, rather than exhausting the tab's
memory. Task 5 shows that count after every batch.

## Layout

```
index.html                                  landing page
Task1/   index.html  script.js  style.css  LICENSE.txt  README.md
Task2/   index.html  engine.js  app.js  style.css
Task3/   index.html  engine.js  app.js  style.css
Task4/   index.html  engine.js  app.js  style.css
Task5/   index.html  engine.js  app.js  style.css
shared/  style.css  engine-nplayer.js       master copies
```

In Tasks 2 to 5, `engine.js` is the search and game rules with no DOM
access at all, and `app.js` is the interface. Tasks 4 and 5 use the same
`engine.js`; only the settings their interfaces pass in differ.

`shared/` holds the master copies that get copied into the task folders.
Each task folder is complete on its own and does not read from `shared/`
at runtime.

## Credit

The Task 1 sample is from *Artificial Intelligence in Game Development:
Tic Tac Toe AI*, published by Packt and MIT licensed. The original licence
is kept at `Task1/LICENSE.txt`. Its two edits are listed in
`Task1/README.md`.
