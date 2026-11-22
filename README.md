# Bubble Craps

Multiplayer play-money bubble craps. No cash value.

Live table: https://usawrapco-spec.github.io/bubble-craps/

## Play

1. Open the site and create a table. You get a room code and an invite link.
2. Friends open the link, pick a name, and sit down. Empty seats are filled by computer players.
3. Everyone starts with $100 in play credits. **Insert bill** adds more. It cannot be exchanged for real money.
4. When it is your shot, **hold Shift or Space**. The power meter oscillates. **Release** to throw.
   A release under 20% is **NO ROLL, short throw** — nothing is settled and you throw again.
5. The dice are rolled by the host's browser with cryptographic randomness. Power only changes the animation.
6. The dice pop in the bubble. Power only changes how hard they fly inside the dome. The layout under it is where you bet.
7. Number keys `4 5 6 8 9 0` buy that number (`0` is 10) at the selected chip, and press again to add another unit. `M` mutes. `R` repeats. `C` clears.

The player who creates the table is the host. Their tab has to stay open; if it closes, the table ends. Some strict networks cannot connect without a TURN server, which this free build does not use.

Place, buy, and hardway bets that win stay up until a 7. They are not charged again. **Bets Off** leaves those bets, plus odds, on the layout without winning or losing. Pass and come flats still work. Odds are capped at 2× true odds.

## Develop

```bash
npm install
npm test
npm run dev
```

The dev server is at `http://localhost:5173/bubble-craps/`.
