# **GRIDLORDS**

> **The board is small. The war is infinite.**

---

## **About the Game**

**Gridlords** is a brutally minimalistic strategy game, forged for solitary warriors who seek total domination, one cell at a time.  
A battle of minds, a conquest of territories, played purely through sharp strategic thinking — and now, also against a real AI.

Built in **pure TypeScript**, running on **bare Node.js**, with **0 external gameplay dependencies**.  
**Made from scratch. Forged in war.**

---

## **Features**

- **5x5 Battle Grid** — Every move is life or death.
- **Player vs Player (PvP)** — Classic duel between two human minds.
- **Player vs AI (PvE)** — Challenge a real AI powered by **Google Gemini**.
- **Victory Conditions** — Control 13 cells or eliminate your opponent.
- **Combat System** — Dice rolls decide fierce battles, shields grant defensive boosts.
- **Special Cells** — Power ⚡, Magic ✶, and Shield ⛨ — each changing your tactics.
- **Terminal UI (TUI)** — Raw, underground, hacker aesthetic gameplay.
- **Error-proof Experience** — Robust validations and graceful exits (even on Ctrl+C).
- **Code Quality** — Fully modular, scalable, and professional-grade TypeScript structure.

---

## **Requirements**

- [Node.js](https://nodejs.org/) v18+ installed.
- (Optional) To play against the AI, you must configure your **Gemini API Key**.

---

## **How to Play**

### ▶️ The Quickest Way (Recommended)

Play directly using **npx** (no install required):

```bash
npx gridlords
```

> **Note:** To enable AI mode (PvE), you must set your Gemini API key first:
> 
> ```bash
> export GEMINI_API_KEY=your-gemini-api-key-here
> ```

---

### ⚙️ Installing Globally (Optional)

If you prefer to have `gridlords` always available on your terminal:

```bash
npm install -g gridlords
gridlords
```

---

### 🛠️ Manual Dev Mode (for contributors)

Clone the repository and run:

```bash
npm install
npm run dev
```

Or build and run manually:

```bash
npm run build
npm start
```

---

## **Game Modes**

- **Player vs Player (PvP)**: Classic 1v1 battle.
- **Player vs AI (PvE)**: Face the cunning strategies of a Gemini-powered AI.
  - The AI analyzes the board state, your positions, special cells, and chooses optimal moves.
  - If the AI fails to respond properly, it smartly falls back to a valid random move.

---

## **Core Rules**

- **Goal**: Control **13 cells** to win.
- **Each Turn**, choose one action:
  - **Conquer** — Expand into an empty adjacent cell.
  - **Fortify** — Place a ⛨ on one of your controlled cells for defense.
  - **Attack** — Battle for an enemy cell adjacent to your territory.
- **Combat**:
  - Roll a 6-sided die (1d6) for attack and defense.
  - If the cell has a ⛨, the defender gains +1 to defense roll.
  - Higher roll wins the fight.
- **Special Cells**:
  - **⚡ Power Source** — (future expansion).
  - **✶ Magic Well** — (future expansion).
  - **⛨ Shield** — Grants immediate defensive bonus.

---

## **Screenshots**

*(Coming soon: retro cyberpunk terminal art)*

---

## **Philosophy**

> **Gridlords is not a casual game. It's a ritual.**  
> It's you, your mind, and the cold battlefield.  
> No graphics. No lootboxes.  
> Just strategy, cunning, and survival.

Built for true Lords of the Grid —  
those who command not by chance, but by pure mental dominance.

---

## **Credits**

**Created by:**
- **Byomess** (Human Player and Game Designer)
- **ChatGPT** (Code Copilot and Silent Soldier)

Special thanks to:
- **Google Gemini AI** — for enabling the PvE mode.

---

## **License**

> **Open Source.  
Use it, modify it, dominate it — but always respect the spirit of the Lords of the Grid.**

---

# **LONG LIVE THE GRIDLORDS.**  
**DOMINATE OR BE DOMINATED.**