# Tic-Tac-Toe for N players — CS 6364 project

Five browser implementations of tic-tac-toe, moving from the two-player
3×3 game with plain minimax up to a 10×10 board played by three machine
players.

Everything is plain HTML, CSS and JavaScript. There is no build step, no
package manager and no server: open any task's `index.html` in a browser
and it runs. Each task folder is self-contained, so it can be zipped and
submitted on its own.

## Running it

```
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
| **Task 2** | 3×3 | human vs machine | alpha-beta | Counts nodes both ways, so pruning is measured rather than claimed |
| **Task 3** | 3×3 | machine vs machine | depth-limited alpha-beta | Runs N games and tallies wins, losses and draws |
| **Task 4** | 4×4 | 3 machines | max<sup>n</sup> | Three players, so minimax no longer applies |
| **Task 5** | B×B, B=3..10 | 3 machines | max<sup>n</sup> + heuristics | Scales up; search heuristics are exposed as controls |

## Algorithms, in short

**Minimax** (Task 1) assumes two players with exactly opposed interests, so
one number describes the position for both. On a 3×3 board the whole game
tree fits in memory, so the machine plays perfectly and cannot be beaten.

**Alpha-beta pruning** (Tasks 2 and 3) returns the identical move while
visiting far fewer positions. From an empty 3×3 board, plain minimax
explores 549,946 nodes and alpha-beta reaches the same conclusion in
20,866, a reduction of about 96%. Task 2 runs both searches on every move
and shows the two counts side by side.

**max<sup>n</sup>** (Tasks 4 and 5) is the generalisation to more than two
players, from Luckhardt and Irani (1986). Each position is scored as a
vector with one component per player, and whoever is to move maximises
their own component. With two players and a zero-sum rule it reduces to
ordinary minimax. Alpha-beta does not carry over, because it depends on
`alpha` and `beta` being two views of a single number and there is no such
pair once scores are vectors.

## Three things worth knowing

**Four in a row on a 4×4 board is a forced draw with three players.**
Sixteen cells split three ways gives each player five or six marks, and any
line one player threatens can be blocked by either opponent. Every batch
run at four in a row ended drawn, at every search depth tested. Task 4
therefore defaults to three in a row; switch the control to four to
reproduce the drawn result.

**Deterministic agents would replay the same game N times.** Two fixes
were needed for a batch of N games to mean anything. On 3×3, the search
picks at random among moves sharing the best *exact* value. On larger
boards the heuristic rarely produces exact ties, so the opening move is
instead drawn at random from the central cells, which are equivalent by
symmetry at that point.

**The root search deliberately does not prune between its own children.**
Under alpha-beta a score equal to `alpha` is only an upper bound, not an
exact value. Collecting such scores as ties and then choosing at random
let a supposedly perfect agent pick a losing move — this was a real bug
during development, visible as full-depth agents failing to draw. The root
now searches each candidate with a full window; pruning still applies in
every subtree below it, which is where nearly all the saving comes from.

## Measured limits

Three players, candidate radius 2, ceiling of 400,000 nodes per move:

| Board | Depth 3 | Depth 4 |
|---|---|---|
| 3×3 to 5×5 | completes | completes |
| 6×6 | completes, ~70k peak nodes | **exceeds ceiling**, ~1.5M nodes |
| 7×7 to 10×10 | completes, under 1 s per game | **exceeds ceiling** |

Past the ceiling the search returns its best result so far and the run
reports how many moves were cut short, rather than exhausting the tab's
memory. Task 5 shows that count after every batch.

## Layout

```
Task1/   index.html  script.js  style.css  LICENSE.txt  README.md
Task2/   index.html  engine.js  app.js  style.css
Task3/   index.html  engine.js  app.js  style.css
Task4/   index.html  engine.js  app.js  style.css
Task5/   index.html  engine.js  app.js  style.css
shared/  style.css  engine-maxn.js      master copies
```

In Tasks 2 to 5, `engine.js` is the search and game rules with no DOM
access at all, and `app.js` is the interface. Tasks 4 and 5 use the same
`engine.js`; only the settings their interfaces pass in differ.

`shared/` holds the master copies that get copied into the task folders.
Each task folder is complete on its own and does not read from `shared/`
at runtime.

## Credit

The Task 1 sample is from *Artificial Intelligence in Game Development —
Tic Tac Toe AI*, published by Packt and MIT licensed. The original licence
is kept at `Task1/LICENSE.txt`. Its two edits are listed in
`Task1/README.md`.
