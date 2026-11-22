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
8. **Restart** asks first. It clears your bets and puts your credits back to $100. The point and the roll history stay. The host can instead reset the whole table: every bet, the point, and the puck, with every bankroll back to $100. History still stays.
9. **Top scores** are kept in this browser (best peak bankroll and best cash-out, with the date). A win line (default +$50) and a stop (default −$50) flash a banner. Beating your saved peak shows **NEW HIGH SCORE!**

The player who creates the table is the host. Share the invite link or the room code. Their tab has to stay open; if it closes, the table ends. Dice are generated only in the host's browser. Some strict networks cannot connect without a TURN server, which this free build does not use. Play money has no cash value.

Place, buy, and hardway bets that win stay up until a 7. They are not charged again. **Bets Off** leaves those bets, plus odds, on the layout without winning or losing. Pass and come flats still work. Odds are capped at 2× true odds.

## Develop

```bash
npm install
npm test
npm run dev
```

The dev server is at `http://localhost:5173/bubble-craps/`.
