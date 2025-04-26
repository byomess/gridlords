#!/usr/bin/env node

import readline from 'readline';

function displayHelp(): void {
    console.log(`
GRIDLORDS - Game Manual
=======================

Objective:
----------
Be the first player to conquer and control ${GameConstants.VICTORY_CONDITION_CELLS} cells on the ${GameConstants.GRID_SIZE}x${GameConstants.GRID_SIZE} board to become the Supreme Grid Lord!

Basic Gameplay:
---------------
- The game is turn-based between two players (Player X and Player O).
- On each turn, the current player performs ONE action.
- The board is a grid. Cells are identified by Letter (Row) and Number (Column), like A1, C3, E5.

Available Actions (Enter ACTION COORDINATE):
-------------------------------------------
1. CONQUER [CELL] (Ex: C B3)
   - Target: An EMPTY cell (' ') that is ADJACENT (not diagonally) to a cell you already control.
   - Effect: You take control of the target cell. Your mark (X or O) appears on it.
   - Restrictions: You cannot conquer cells containing special items like ⚡ (Power) or ✶ (Magic). Cells with ⛨ (Shield) also cannot be conquered directly while the shield is active (they can only be attacked if occupied by the enemy).

2. FORTIFY [CELL] (Ex: F A1)
   - Target: A cell that YOU ALREADY CONTROL.
   - Effect: Adds a Shield (⛨) to the cell. If the cell already contained ⚡ or ✶, those items are REMOVED.
   - Benefit: Cells with ⛨ receive a +${GameConstants.SHIELD_DEFENSE_MODIFIER} bonus to their defense roll when attacked.
   - Restrictions: You cannot fortify a cell that already has a ⛨.

3. ATTACK [CELL] (Ex: A D4)
   - Target: A cell controlled by the ENEMY that is ADJACENT to a cell you control.
   - Mechanism:
     - Both players roll a 6-sided die (D6) (${GameConstants.MIN_DICE_ROLL}-${GameConstants.MAX_DICE_ROLL}).
     - The Defender receives +${GameConstants.SHIELD_DEFENSE_MODIFIER} to their roll if the attacked cell has a Shield (⛨).
     - If the Attacker's roll is STRICTLY GREATER than the Defender's (modified) roll, the attack succeeds.
   - Effect (Success): You capture the enemy cell. Your mark replaces the enemy's. If there was a ⛨ on the cell, it is DESTROYED. If there were ⚡ or ✶, they are removed (captured, but effect not yet implemented).
   - Effect (Failure): Nothing happens. The cell remains under the defender's control.

Special Items:
--------------
- ⚡ (Power), ✶ (Magic): Appear initially on the board. When conquering/attacking a cell with them, a message is displayed, but they currently have no mechanical effects other than being removed. Cannot be conquered directly.
- ⛨ (Shield): Added by the FORTIFY action or may appear initially. Grants a defense bonus (+${GameConstants.SHIELD_DEFENSE_MODIFIER}). It is destroyed if the cell is captured by an attack.

Game Modes:
-----------
- PvP (Player vs Player): Two humans play on the same terminal.
- PvE (Player vs AI): You play against the Google Gemini AI (requires configuring the GEMINI_API_KEY environment variable).

Controls (New Format!):
-----------------------
- During your turn, enter the desired ACTION (C for CONQUER, F for FORTIFY, A for ATTACK) followed by the target COORDINATE (LetterNumber), separated by a space. Examples:
  - C B3
  - A E4
  - F A1
- Coordinates use Row Letter (A-${String.fromCharCode(GameConstants.ASCII_A_OFFSET + GameConstants.GRID_SIZE - 1)}) and Column Number (1-${GameConstants.GRID_SIZE}). Case-insensitive (will be converted to uppercase).

Command Line Options:
---------------------
- Use '--help' or '-h' when starting the game to display this manual.
  (Ex: node your_compiled_file.js --help)

Good luck, Grid Lord!
`);
    process.exit(0);
}

namespace GameConstants {
    export const GRID_SIZE: number = 5;
    export const PLAYER_MARKS = ['X', 'O'] as const;
    export const AI_PLAYER_ID: GameTypes.PlayerId = 1;
    export const AI_PLAYER_MARK = PLAYER_MARKS[AI_PLAYER_ID];
    export const SPECIAL_TYPES = ['⚡', '✶', '⛨'] as const;
    export const VICTORY_CONDITION_CELLS: number = 13;
    export const INITIAL_SPECIAL_CELLS: number = 3;
    export const BASE_DEFENSE_MODIFIER: number = 0;
    export const SHIELD_DEFENSE_MODIFIER: number = 1;
    export const MIN_DICE_ROLL: number = 1;
    export const MAX_DICE_ROLL: number = 6;
    export const ASCII_A_OFFSET: number = 65;

    export const GEMINI_API_KEY: string | undefined = process.env.GEMINI_API_KEY;
    export const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent`;
    export const AI_REQUEST_TIMEOUT_MS = 15000;
    export const AI_MAX_RETRIES = 2;
}

namespace GameTypes {
    export type PlayerId = 0 | 1;
    export type PlayerMark = typeof GameConstants.PLAYER_MARKS[number];
    export type SpecialType = typeof GameConstants.SPECIAL_TYPES[number];
    export type EmptyCell = ' ';
    export type CellState = EmptyCell | PlayerMark | SpecialType;
    export type CoordinateString = `${number},${number}`;
    export type GameMode = 'PvP' | 'PvE';

    export interface Coordinate {
        row: number;
        col: number;
    }

    export interface SpecialCell {
        position: Coordinate;
        type: SpecialType;
    }

    export type SpecialCellsMap = Record<CoordinateString, SpecialType>;

    export type AIActionType = 'CONQUER' | 'FORTIFY' | 'ATTACK';

    export interface PlayerMoveInput {
        action: AIActionType;
        coord: Coordinate;
    }

    export interface AIMove {
        action: AIActionType;
        coord: Coordinate;
    }
}

namespace GameInterfaces {
    export interface IGrid {
        setCell(coord: GameTypes.Coordinate, value: GameTypes.CellState): void;
        getCell(coord: GameTypes.Coordinate): GameTypes.CellState;
        isValidCoordinate(coord: GameTypes.Coordinate): boolean;
        getSize(): number;
    }

    export interface IPlayer {
        readonly id: GameTypes.PlayerId;
        readonly mark: GameTypes.PlayerMark;
        addPosition(coordStr: GameTypes.CoordinateString): void;
        removePosition(coordStr: GameTypes.CoordinateString): void;
        ownsPosition(coordStr: GameTypes.CoordinateString): boolean;
        getPositions(): ReadonlySet<GameTypes.CoordinateString>;
        getPositionCount(): number;
    }

    export interface IGameRules {
        isAdjacent(targetCoord: GameTypes.Coordinate, player: IPlayer): boolean;
        checkWinner(players: readonly [IPlayer, IPlayer]): GameTypes.PlayerId | null;
        rollAttackDice(): number;
        rollDefenseDice(isShielded: boolean): number;
        getValidMoves(player: IPlayer, opponent: IPlayer, grid: IGrid, specials: GameTypes.SpecialCellsMap): GameTypes.AIMove[];
    }

    export interface IUserInterface {
        clearScreen(): void;
        renderBoard(grid: IGrid, specials: GameTypes.SpecialCellsMap): void;
        displayMessage(message: string): void;
        askQuestion(prompt: string): Promise<string>;
        promptGameMode(): Promise<GameTypes.GameMode>;
        promptPlayerMove(playerName: GameTypes.PlayerMark): Promise<GameTypes.PlayerMoveInput | null>;
        displayAttackResult(attackerMark: GameTypes.PlayerMark, defenderMark: GameTypes.PlayerMark, attackRoll: number, defenseRoll: number, success: boolean): void;
        displayAIMove(aiMark: GameTypes.PlayerMark, move: GameTypes.AIMove): void;
        displayAIThinking(): void;
        displayAIError(errorMsg: string): void;
        displayVictory(winnerMark: GameTypes.PlayerMark | null): void;
        close(): void;
    }

    export interface IAILogic {
        decideMove(
            aiPlayer: IPlayer,
            humanPlayer: IPlayer,
            grid: IGrid,
            specials: GameTypes.SpecialCellsMap,
            rules: IGameRules
        ): Promise<GameTypes.AIMove | null>;
    }

    export interface IGameController {
        startGame(): Promise<void>;
    }
}

namespace GameUtils {
    export function toCoordinateString(coord: GameTypes.Coordinate): GameTypes.CoordinateString {
        return `${coord.row},${coord.col}`;
    }

    export function fromCoordinateString(coordStr: GameTypes.CoordinateString): GameTypes.Coordinate {
        const [row, col] = coordStr.split(',').map(Number);
        return { row, col };
    }

    export function formatCoordForUser(coord: GameTypes.Coordinate): string {
        const rowLetter = String.fromCharCode(GameConstants.ASCII_A_OFFSET + coord.row);
        const colNumber = coord.col + 1;
        return `${rowLetter}${colNumber}`;
    }

    export function parseCoordinateInput(input: string): GameTypes.Coordinate | null {
        const sanitizedInput = input.trim().toUpperCase();
        const match = sanitizedInput.match(/^([A-Z])\s?([1-9]\d*)$/);

        if (!match) {
            return null;
        }

        const rowChar = match[1];
        const colStr = match[2];

        const row = rowChar.charCodeAt(0) - GameConstants.ASCII_A_OFFSET;
        const col = parseInt(colStr, 10) - 1;

        if (row < 0 || row >= GameConstants.GRID_SIZE || col < 0 || col >= GameConstants.GRID_SIZE) {
             const maxRowChar = String.fromCharCode(GameConstants.ASCII_A_OFFSET + GameConstants.GRID_SIZE - 1);
             const maxCol = GameConstants.GRID_SIZE;
             console.error(`Invalid coordinate: Row must be A-${maxRowChar}, Column must be 1-${maxCol}.`);
            return null;
        }

        return { row, col };
    }

    export function randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    export function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    export function getRandomElement<T>(arr: T[]): T | undefined {
        if (arr.length === 0) return undefined;
        return arr[randomInt(0, arr.length - 1)];
    }
}

namespace Core {
    export class Grid implements GameInterfaces.IGrid {
        private cells: GameTypes.CellState[][];
        private readonly size: number;

        constructor(size: number) {
            if (size <= 0) {
                throw new Error("Grid size must be positive.");
            }
            this.size = size;
            this.cells = Array.from({ length: size }, () =>
                Array(size).fill(' ')
            );
        }

        public setCell(coord: GameTypes.Coordinate, value: GameTypes.CellState): void {
            if (this.isValidCoordinate(coord)) {
                this.cells[coord.row][coord.col] = value;
            } else {
                console.warn(`Attempted to set cell outside grid bounds: ${GameUtils.formatCoordForUser(coord)}`);
            }
        }

        public getCell(coord: GameTypes.Coordinate): GameTypes.CellState {
            if (this.isValidCoordinate(coord)) {
                return this.cells[coord.row][coord.col];
            }
            console.warn(`Attempted to get cell outside grid bounds: ${GameUtils.formatCoordForUser(coord)}`);
            return ' ';
        }

        public isValidCoordinate(coord: GameTypes.Coordinate): boolean {
            return (
                coord.row >= 0 && coord.row < this.size &&
                coord.col >= 0 && coord.col < this.size
            );
        }

        public getSize(): number {
            return this.size;
        }
    }

    export class Player implements GameInterfaces.IPlayer {
        public readonly id: GameTypes.PlayerId;
        public readonly mark: GameTypes.PlayerMark;
        private readonly positions: Set<GameTypes.CoordinateString>;

        constructor(id: GameTypes.PlayerId) {
            this.id = id;
            this.mark = GameConstants.PLAYER_MARKS[id];
            this.positions = new Set();
        }

        public addPosition(coordStr: GameTypes.CoordinateString): void {
            this.positions.add(coordStr);
        }

        public removePosition(coordStr: GameTypes.CoordinateString): void {
            this.positions.delete(coordStr);
        }

        public ownsPosition(coordStr: GameTypes.CoordinateString): boolean {
            return this.positions.has(coordStr);
        }

        public getPositions(): ReadonlySet<GameTypes.CoordinateString> {
            return this.positions;
        }

        public getPositionCount(): number {
            return this.positions.size;
        }
    }
}

namespace Rules {
    export class GameRules implements GameInterfaces.IGameRules {
        public isAdjacent(targetCoord: GameTypes.Coordinate, player: GameInterfaces.IPlayer): boolean {
            for (const posStr of player.getPositions()) {
                const ownedCoord = GameUtils.fromCoordinateString(posStr);
                const distance = Math.abs(ownedCoord.row - targetCoord.row) + Math.abs(ownedCoord.col - targetCoord.col);
                if (distance === 1) {
                    return true;
                }
            }
            return false;
        }

        public checkWinner(players: readonly [GameInterfaces.IPlayer, GameInterfaces.IPlayer]): GameTypes.PlayerId | null {
            for (const player of players) {
                if (player.getPositionCount() >= GameConstants.VICTORY_CONDITION_CELLS) {
                    return player.id;
                }
            }
            return null;
        }

        public rollAttackDice(): number {
            return GameUtils.randomInt(GameConstants.MIN_DICE_ROLL, GameConstants.MAX_DICE_ROLL);
        }

        public rollDefenseDice(isShielded: boolean): number {
            const baseRoll = GameUtils.randomInt(GameConstants.MIN_DICE_ROLL, GameConstants.MAX_DICE_ROLL);
            const shieldBonus = isShielded ? GameConstants.SHIELD_DEFENSE_MODIFIER : GameConstants.BASE_DEFENSE_MODIFIER;
            return baseRoll + shieldBonus;
        }

        private isValid(r: number, c: number, gridSize: number): boolean {
            return r >= 0 && r < gridSize && c >= 0 && c < gridSize;
        }

        public getValidMoves(
            player: GameInterfaces.IPlayer,
            opponent: GameInterfaces.IPlayer,
            grid: GameInterfaces.IGrid,
            specials: GameTypes.SpecialCellsMap): GameTypes.AIMove[]
        {
            const validMoves: GameTypes.AIMove[] = [];
            const gridSize = grid.getSize();
            const playerPositions = player.getPositions();

            for (const posStr of playerPositions) {
                const ownedCoord = GameUtils.fromCoordinateString(posStr);
                const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];

                for (const [dr, dc] of deltas) {
                    const targetRow = ownedCoord.row + dr;
                    const targetCol = ownedCoord.col + dc;
                    const targetCoord: GameTypes.Coordinate = { row: targetRow, col: targetCol };

                    if (this.isValid(targetRow, targetCol, gridSize)) {
                        const targetCoordStr = GameUtils.toCoordinateString(targetCoord);
                        const cellState = grid.getCell(targetCoord);
                        const isSpecial = !!specials[targetCoordStr];

                        if (cellState === ' ' && !isSpecial) {
                           validMoves.push({ action: 'CONQUER', coord: targetCoord });
                        }
                        else if (opponent.ownsPosition(targetCoordStr)) {
                             validMoves.push({ action: 'ATTACK', coord: targetCoord });
                        }
                    }
                }

                const ownedCoordStr = GameUtils.toCoordinateString(ownedCoord);
                if (specials[ownedCoordStr] !== '⛨') {
                    validMoves.push({ action: 'FORTIFY', coord: ownedCoord });
                }
            }

            const uniqueMoves = new Map<string, GameTypes.AIMove>();
            for(const move of validMoves) {
                 const key = `${move.action}:${GameUtils.toCoordinateString(move.coord)}`;
                 if (!uniqueMoves.has(key)) {
                     uniqueMoves.set(key, move);
                 }
            }

            return Array.from(uniqueMoves.values());
        }
    }
}

namespace UI {
    export class TerminalUI implements GameInterfaces.IUserInterface {
        private readonly rl: readline.Interface;

        constructor() {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            this.rl.on('SIGINT', () => {
                this.displayMessage("\nExiting Gridlords. Goodbye!");
                this.close();
                process.exit(0);
            });
        }

        public clearScreen(): void {
            console.clear();
        }

        public renderBoard(grid: GameInterfaces.IGrid, specials: GameTypes.SpecialCellsMap): void {
            const size = grid.getSize();
            let header = '   ';
            for (let c = 0; c < size; c++) {
                header += ` ${c + 1}  `;
            }
            console.log(header);
            console.log('  ' + '+---'.repeat(size) + '+');

            for (let r = 0; r < size; r++) {
                const rowLetter = String.fromCharCode(GameConstants.ASCII_A_OFFSET + r);
                let line = `${rowLetter} |`;
                for (let c = 0; c < size; c++) {
                    const coord: GameTypes.Coordinate = { row: r, col: c };
                    const coordStr = GameUtils.toCoordinateString(coord);
                    const special = specials[coordStr];
                    const cellContent = grid.getCell(coord);
                    const displayChar = special ?? cellContent;
                    line += ` ${displayChar.padEnd(1)} |`;
                }
                console.log(line);
                console.log('  ' + '+---'.repeat(size) + '+');
            }
            console.log('');
        }

        public displayMessage(message: string): void {
            console.log(message);
        }

        public askQuestion(prompt: string): Promise<string> {
            return new Promise((resolve) => {
                this.rl.question(prompt, (answer) => {
                    resolve(answer.trim());
                });
            });
        }

        public async promptGameMode(): Promise<GameTypes.GameMode> {
             this.clearScreen();
             this.displayMessage("Welcome to GRIDLORDS!");
             this.displayMessage("----------------------");
             while (true) {
                this.displayMessage("Choose game mode:");
                this.displayMessage("  1) Player vs Player (PvP)");
                this.displayMessage("  2) Player vs AI (PvE - Gemini)");
                const choice = await this.askQuestion('> ');
                if (choice === '1') return 'PvP';
                if (choice === '2') {
                    if (!GameConstants.GEMINI_API_KEY) {
                        this.displayMessage("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                        this.displayMessage("!! ERROR: Gemini API Key not configured.                 !!");
                        this.displayMessage("!! Set the GEMINI_API_KEY environment variable.          !!");
                        this.displayMessage("!! PvE mode cannot be started.                         !!");
                        this.displayMessage("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
                    } else {
                        return 'PvE';
                    }
                } else {
                    this.displayMessage('Invalid choice. Enter 1 or 2.');
                }
             }
        }

        public async promptPlayerMove(playerName: GameTypes.PlayerMark): Promise<GameTypes.PlayerMoveInput | null> {
            const actionMap: Record<string, GameTypes.AIActionType> = {
                'C': 'CONQUER',
                'F': 'FORTIFY',
                'A': 'ATTACK',
            };

            while (true) {
                const actionHelp = `Actions: C = Conquer, F = Fortify, A = Attack`;
                const promptMsg = `${actionHelp}\nPlayer ${playerName}'s turn. Enter ACTION COORDINATE (e.g., C B3, A A1, F C5):`;
                const input = await this.askQuestion(`${promptMsg}\n> `);
                const parts = input.trim().toUpperCase().split(/\s+/);

                if (parts.length !== 2) {
                    this.displayMessage('Invalid input. Use format: ACTION COORDINATE (e.g., C B3).');
                    continue;
                }

                const actionStr = parts[0];
                const coordStr = parts[1];

                const action = actionMap[actionStr];
                if (!action) {
                    this.displayMessage(`Invalid action "${actionStr}". Use C, F, or A.`);
                    continue;
                }

                const coord = GameUtils.parseCoordinateInput(coordStr);
                if (!coord) {
                    this.displayMessage(`Invalid coordinate "${coordStr}". Use LetterNumber (e.g., A1, C5).`);
                    continue;
                }

                return { action, coord };
            }
        }

        public displayAttackResult(
            attackerMark: GameTypes.PlayerMark,
            defenderMark: GameTypes.PlayerMark,
            attackRoll: number,
            defenseRoll: number,
            success: boolean): void
        {
            this.displayMessage(`--- Attack ${attackerMark} vs ${defenderMark} ---`);
            this.displayMessage(`  > ROLLS: Attacker (${attackerMark}): ${attackRoll} | Defender (${defenderMark}): ${defenseRoll}`);
            if (success) {
                this.displayMessage(`  > RESULT: Attacker Wins! Cell conquered.`);
            } else {
                this.displayMessage(`  > RESULT: Attack Failed! Defense successful.`);
            }
            this.displayMessage('----------------------------------\n');
        }

         public displayAIMove(aiMark: GameTypes.PlayerMark, move: GameTypes.AIMove): void {
            const coordStr = GameUtils.formatCoordForUser(move.coord);
            let actionText = '';
            switch(move.action) {
                case 'CONQUER': actionText = `conquers ${coordStr}`; break;
                case 'FORTIFY': actionText = `fortifies ${coordStr} with ⛨`; break;
                case 'ATTACK': actionText = `attacks ${coordStr}`; break;
            }
             this.displayMessage(`*** AI (${aiMark}) decides: ${actionText} ***`);
         }

         public displayAIThinking(): void {
             this.displayMessage(`--- AI's Turn (${GameConstants.AI_PLAYER_MARK}) ---`);
             this.displayMessage("AI is thinking...");
         }

         public displayAIError(errorMsg: string): void {
            this.displayMessage(`!!! AI Error: ${errorMsg} !!!`);
            this.displayMessage("!!! The AI may have skipped its turn or made a random fallback move. !!!");
         }

        public displayVictory(winnerMark: GameTypes.PlayerMark | null): void {
             this.displayMessage("\n==============================================");
             if (winnerMark) {
                 this.displayMessage(`      GAME OVER!`);
                 this.displayMessage(` PLAYER ${winnerMark} IS THE SUPREME GRID LORD!!! `);
             } else {
                 this.displayMessage(`      GAME OVER!`);
                 this.displayMessage(`       DRAW OR END CONDITION NOT MET! `);
             }
             this.displayMessage("==============================================\n");
        }

        public close(): void {
            this.rl.close();
        }
    }
}

namespace AI {
    export class GeminiAI implements GameInterfaces.IAILogic {
        private readonly apiKey: string;

        constructor(apiKey: string) {
            if (!apiKey) {
                throw new Error("Gemini API Key is required for AI Logic.");
            }
            this.apiKey = apiKey;
        }

        private formatGameStateForPrompt(
            aiPlayer: GameInterfaces.IPlayer,
            humanPlayer: GameInterfaces.IPlayer,
            grid: GameInterfaces.IGrid,
            specials: GameTypes.SpecialCellsMap,
            rules: GameInterfaces.IGameRules
        ): string {
            const gridSize = grid.getSize();
            let boardString = "   ";
            for (let c = 0; c < gridSize; c++) boardString += ` ${c + 1}  `;
            boardString += "\n";
             boardString += '  +' + '---+'.repeat(gridSize) + '\n';

            for (let r = 0; r < gridSize; r++) {
                const rowLetter = String.fromCharCode(GameConstants.ASCII_A_OFFSET + r);
                boardString += `${rowLetter} |`;
                for (let c = 0; c < gridSize; c++) {
                    const coord: GameTypes.Coordinate = { row: r, col: c };
                    const coordStr = GameUtils.toCoordinateString(coord);
                    const special = specials[coordStr];
                    const cell = grid.getCell(coord);
                    const displayChar = special ?? cell;
                    boardString += ` ${displayChar.padEnd(1)} |`;
                }
                boardString += "\n";
                 boardString += '  +' + '---+'.repeat(gridSize) + '\n';
            }

            const aiPositions = Array.from(aiPlayer.getPositions()).map(GameUtils.fromCoordinateString).map(GameUtils.formatCoordForUser).join(', ') || 'None';
            const humanPositions = Array.from(humanPlayer.getPositions()).map(GameUtils.fromCoordinateString).map(GameUtils.formatCoordForUser).join(', ') || 'None';
            let specialLocations = Object.entries(specials)
                .map(([coordStr, type]) => `${GameUtils.formatCoordForUser(GameUtils.fromCoordinateString(coordStr as GameTypes.CoordinateString))}(${type})`)
                .join(', ') || 'None';

            const rulesSummary = `
Main Rules:
- Objective: Control ${GameConstants.VICTORY_CONDITION_CELLS} cells.
- Actions: CONQUER (adjacent empty cell), FORTIFY (your cell with ⛨), ATTACK (adjacent enemy cell).
- Attack: Attack Roll > Defense Roll (+${GameConstants.SHIELD_DEFENSE_MODIFIER} if ⛨). Win captures the cell.
- Specials: ⚡, ✶, ⛨ (⛨ added by FORTIFY or initial). Conquering/Attacking a cell with a special might have effects (currently overwrites, except ⛨).
`;

            const prompt = `
You are an AI player for the board game 'Gridlords'. Your goal is to win by controlling ${GameConstants.VICTORY_CONDITION_CELLS} cells on the ${gridSize}x${gridSize} board.

Your Symbol: ${aiPlayer.mark} (Player ${aiPlayer.id})
Opponent's Symbol: ${humanPlayer.mark} (Player ${humanPlayer.id})

Current Board State:
${boardString}
Legend: [ ]=Empty, [X]=Player 0, [O]=Player 1, [⚡]=Power, [✶]=Magic, [⛨]=Shield

Your Positions (${aiPlayer.getPositionCount()}): ${aiPositions}
Opponent's Positions (${humanPlayer.getPositionCount()}): ${humanPositions}
Special Items on Board: ${specialLocations}

${rulesSummary}

It's your turn (${aiPlayer.mark}). Choose your next action and the target coordinate.
Possible actions are:
1. CONQUER: Choose an EMPTY cell ([ ]) adjacent to one of yours. Cannot conquer cells with ⚡ or ✶.
2. FORTIFY: Choose a cell YOU ALREADY CONTROL (${aiPlayer.mark}) to add or maintain a Shield [⛨]. Cannot fortify if it already has [⛨]. Fortifying removes ⚡ or ✶ if present.
3. ATTACK: Choose a cell controlled by the OPPONENT (${humanPlayer.mark}) adjacent to one of yours.

Analyze the game state, your positions, the opponent's, specials, and choose the BEST strategic move to get closer to victory or defend your territory. Consider adjacency for attacks and conquests.

Respond ONLY with the action and coordinate in the format: ACTION: COORDINATE
Valid response examples:
CONQUER: B3
ATTACK: D4
FORTIFY: A1

Do NOT include any other words, explanations, or greetings in your response. ONLY the action and coordinate.
What is your move?
`;
            return prompt;
        }

        private parseAIResponse(responseText: string): GameTypes.AIMove | null {
             const cleanedResponse = responseText.trim().toUpperCase();
             const match = cleanedResponse.match(/^(CONQUER|FORTIFY|ATTACK):\s?([A-Z][1-9]\d*)$/);

             if (!match) {
                 console.error(`Error parsing AI response: unexpected format "${cleanedResponse}"`);
                 return null;
             }

             const action = match[1] as GameTypes.AIActionType;
             const coordInput = match[2];
             const coord = GameUtils.parseCoordinateInput(coordInput);

             if (!coord) {
                 console.error(`Error parsing AI response: invalid coordinate "${coordInput}"`);
                 return null;
             }

             return { action, coord };
        }

        private async callGeminiAPI(prompt: string): Promise<string | null> {
            const url = `${GameConstants.GEMINI_API_ENDPOINT}?key=${this.apiKey}`;
            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
            };

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(GameConstants.AI_REQUEST_TIMEOUT_MS)
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`Gemini API Error: ${response.status} ${response.statusText}`, errorBody);
                    return null;
                }

                const data = await response.json() as any;
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (typeof text !== 'string') {
                     console.error('Gemini API Error: response does not contain valid text.', JSON.stringify(data, null, 2));
                     return null;
                }

                return text;

            } catch (error: any) {
                 if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                     console.error('Gemini API Error: Request timed out.');
                 } else {
                     console.error('Error calling Gemini API:', error);
                 }
                return null;
            }
        }

        public async decideMove(
            aiPlayer: GameInterfaces.IPlayer,
            humanPlayer: GameInterfaces.IPlayer,
            grid: GameInterfaces.IGrid,
            specials: GameTypes.SpecialCellsMap,
            rules: GameInterfaces.IGameRules
        ): Promise<GameTypes.AIMove | null> {

            const prompt = this.formatGameStateForPrompt(aiPlayer, humanPlayer, grid, specials, rules);
            let attempts = 0;

            while (attempts <= GameConstants.AI_MAX_RETRIES) {
                if (attempts > 0) {
                     console.log(`Attempt ${attempts + 1} to get AI move...`);
                }
                const responseText = await this.callGeminiAPI(prompt);

                if (responseText) {
                    const move = this.parseAIResponse(responseText);
                    if (move) {
                        if (move.action === 'FORTIFY' && !aiPlayer.ownsPosition(GameUtils.toCoordinateString(move.coord))) {
                             console.warn(`AI suggested FORTIFY on unowned cell: ${GameUtils.formatCoordForUser(move.coord)}. Retrying...`);
                        }
                        else if (move.action === 'CONQUER' && grid.getCell(move.coord) !== ' ') {
                             console.warn(`AI suggested CONQUER on non-empty cell: ${GameUtils.formatCoordForUser(move.coord)}. Retrying...`);
                        }
                        else if (move.action === 'ATTACK' && !humanPlayer.ownsPosition(GameUtils.toCoordinateString(move.coord))) {
                             console.warn(`AI suggested ATTACK on non-enemy cell: ${GameUtils.formatCoordForUser(move.coord)}. Retrying...`);
                        }
                        else {
                            return move;
                        }
                    }
                } else {
                    console.error("Communication failure with Gemini API.");
                    break;
                }
                attempts++;
                await GameUtils.sleep(500);
            }

            console.error("AI failed to provide a valid move after multiple attempts.");
            const validMoves = rules.getValidMoves(aiPlayer, humanPlayer, grid, specials);
            const fallbackMove = GameUtils.getRandomElement(validMoves);
             if (fallbackMove) {
                 console.log("Using random valid move as fallback.");
                 return fallbackMove;
             } else {
                 console.error("No valid moves found for AI (fallback failed).");
                 return null;
             }
        }
    }
}

namespace Game {
    export class GameController implements GameInterfaces.IGameController {
        private readonly grid: GameInterfaces.IGrid;
        private readonly players: [GameInterfaces.IPlayer, GameInterfaces.IPlayer];
        private readonly ui: GameInterfaces.IUserInterface;
        private readonly rules: GameInterfaces.IGameRules;
        private aiLogic: GameInterfaces.IAILogic | null = null;

        private currentPlayerId: GameTypes.PlayerId;
        private specials: GameTypes.SpecialCellsMap;
        private isGameOver: boolean;
        private gameMode: GameTypes.GameMode = 'PvP';

        constructor() {
            this.grid = new Core.Grid(GameConstants.GRID_SIZE);
            this.players = [new Core.Player(0), new Core.Player(1)];
            this.ui = new UI.TerminalUI();
            this.rules = new Rules.GameRules();
            this.currentPlayerId = 0;
            this.specials = {};
            this.isGameOver = false;
        }

        private async initializeGame(): Promise<boolean> {
             this.gameMode = await this.ui.promptGameMode();

             if (this.gameMode === 'PvE') {
                 if (!GameConstants.GEMINI_API_KEY) {
                     return false;
                 }
                 try {
                    this.aiLogic = new AI.GeminiAI(GameConstants.GEMINI_API_KEY);
                    this.ui.displayMessage(`Player vs AI (${GameConstants.AI_PLAYER_MARK}) mode selected.`);
                 } catch (error: any) {
                     this.ui.displayMessage(`Error initializing AI: ${error.message}`);
                     return false;
                 }
             } else {
                 this.ui.displayMessage("Player vs Player mode selected.");
             }

             await GameUtils.sleep(1500);
             this.setupInitialState();
             return true;
        }

        private setupInitialState(): void {
            this.claimCell({ row: 0, col: 0 }, 0);
            this.claimCell({ row: GameConstants.GRID_SIZE - 1, col: GameConstants.GRID_SIZE - 1 }, 1);

            let specialsPlaced = 0;
            const maxPlacementAttempts = GameConstants.GRID_SIZE * GameConstants.GRID_SIZE * 2;
            let attempts = 0;

            while (specialsPlaced < GameConstants.INITIAL_SPECIAL_CELLS && attempts < maxPlacementAttempts) {
                const row = GameUtils.randomInt(0, GameConstants.GRID_SIZE - 1);
                const col = GameUtils.randomInt(0, GameConstants.GRID_SIZE - 1);
                const coord: GameTypes.Coordinate = { row, col };
                const coordStr = GameUtils.toCoordinateString(coord);

                if (this.grid.getCell(coord) === ' ' && !this.specials[coordStr]) {
                    const specialType = GameConstants.SPECIAL_TYPES[specialsPlaced % GameConstants.SPECIAL_TYPES.length];
                    this.specials[coordStr] = specialType;
                    specialsPlaced++;
                }
                attempts++;
            }
            if (specialsPlaced < GameConstants.INITIAL_SPECIAL_CELLS) {
                 console.warn("Warning: Could not place all initial specials (not enough space?).");
            }

            this.ui.clearScreen();
            this.ui.displayMessage("GRIDLORDS - Started!");
            this.ui.displayMessage(`Objective: Control ${GameConstants.VICTORY_CONDITION_CELLS} cells.`);
            this.ui.displayMessage("Good luck, Lords!\n");
        }

        private claimCell(coord: GameTypes.Coordinate, playerId: GameTypes.PlayerId): void {
            const player = this.players[playerId];
            this.grid.setCell(coord, player.mark);
            player.addPosition(GameUtils.toCoordinateString(coord));

            const coordStr = GameUtils.toCoordinateString(coord);
            if (this.specials[coordStr]) {
                const specialType = this.specials[coordStr];
                if (specialType !== '⛨') {
                    this.ui.displayMessage(`Player ${player.mark} captured ${specialType} at ${GameUtils.formatCoordForUser(coord)}! (Effect TBD)`);
                    delete this.specials[coordStr];
                } else {
                     this.ui.displayMessage(`Player ${player.mark} captured fortified cell ${GameUtils.formatCoordForUser(coord)}.`);
                }
            }
        }

        public async startGame(): Promise<void> {
            const initialized = await this.initializeGame();
            if (!initialized) {
                this.ui.displayMessage("Failed to initialize the game. Exiting.");
                this.ui.close();
                return;
            }

            while (!this.isGameOver) {
                await this.executePlayerTurn();
                this.checkGameOver();
                if (!this.isGameOver) {
                    this.switchPlayer();
                }
            }

            this.ui.clearScreen();
            this.ui.renderBoard(this.grid, this.specials);
            const winnerId = this.rules.checkWinner(this.players);
            const winnerMark = winnerId !== null ? this.players[winnerId].mark : null;
            this.ui.displayVictory(winnerMark);
            this.ui.close();
        }

        private async executePlayerTurn(): Promise<void> {
            const currentPlayer = this.players[this.currentPlayerId];
            const isAITurn = this.gameMode === 'PvE' && currentPlayer.id === GameConstants.AI_PLAYER_ID && this.aiLogic;

            this.ui.clearScreen();
            this.ui.renderBoard(this.grid, this.specials);

            if (isAITurn) {
                await this.executeAITurn(currentPlayer);
            } else {
                await this.executeHumanTurn(currentPlayer);
            }
             await GameUtils.sleep(1000);
        }

        private async executeHumanTurn(player: GameInterfaces.IPlayer): Promise<void> {
             let actionIsValidAndExecuted = false;
             while (!actionIsValidAndExecuted) {
                 this.ui.clearScreen();
                 this.ui.renderBoard(this.grid, this.specials);

                 const move = await this.ui.promptPlayerMove(player.mark);
                 if (!move) {
                     this.ui.displayMessage("Unexpected error processing move. Try again.");
                     await this.ui.askQuestion("Press Enter to continue...");
                     continue;
                 }

                 switch (move.action) {
                     case 'CONQUER':
                         actionIsValidAndExecuted = this.validateAndExecuteConquer(player, move.coord);
                         break;
                     case 'FORTIFY':
                         actionIsValidAndExecuted = this.validateAndExecuteFortify(player, move.coord);
                         break;
                     case 'ATTACK':
                         actionIsValidAndExecuted = this.validateAndExecuteAttack(player, move.coord);
                         break;
                     default:
                         this.ui.displayMessage("Unknown action received.");
                         actionIsValidAndExecuted = false;
                 }

                 if (!actionIsValidAndExecuted) {
                      this.ui.displayMessage("Action failed or was invalid.");
                      await this.ui.askQuestion("Press Enter to try again...");
                 }
             }
        }

        private async executeAITurn(aiPlayer: GameInterfaces.IPlayer): Promise<void> {
             this.ui.displayAIThinking();
             const humanPlayer = this.players[aiPlayer.id === 0 ? 1 : 0];

             if (!this.aiLogic) {
                 this.ui.displayAIError("AI logic is not available!");
                 return;
             }

             const aiMove = await this.aiLogic.decideMove(aiPlayer, humanPlayer, this.grid, this.specials, this.rules);

             if (!aiMove) {
                 this.ui.displayAIError("Could not determine a move.");
                 await GameUtils.sleep(1500);
                 return;
             }

             this.ui.displayAIMove(aiPlayer.mark, aiMove);
             await GameUtils.sleep(1500);

             let success = false;
             switch (aiMove.action) {
                 case 'CONQUER':
                     success = this.validateAndExecuteConquer(aiPlayer, aiMove.coord);
                     break;
                 case 'FORTIFY':
                     success = this.validateAndExecuteFortify(aiPlayer, aiMove.coord);
                     break;
                 case 'ATTACK':
                     success = this.validateAndExecuteAttack(aiPlayer, aiMove.coord);
                     break;
             }

             if (!success) {
                 this.ui.displayAIError(`Suggested move (${aiMove.action}: ${GameUtils.formatCoordForUser(aiMove.coord)}) is invalid in the current state.`);
                 await GameUtils.sleep(1500);
             }
        }

       private validateAndExecuteConquer(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);

            if (!this.grid.isValidCoordinate(targetCoord)) {
                 this.ui.displayMessage('Error: Coordinate is outside the board.');
                 return false;
            }
           const cellState = this.grid.getCell(targetCoord);
           if (cellState !== ' ') {
               this.ui.displayMessage('Error: Cell is not empty.');
               return false;
           }
           const isSpecial = !!this.specials[targetCoordStr];
           if (isSpecial && this.specials[targetCoordStr] !== '⛨') {
               this.ui.displayMessage(`Error: Cell contains ${this.specials[targetCoordStr]}. Cannot be conquered directly.`);
               return false;
           }
           if (this.specials[targetCoordStr] === '⛨' && cellState === ' ') {
                this.ui.displayMessage(`Error: Cell contains an abandoned shield (⛨). Cannot be conquered directly.`);
                return false;
           }
           if (!this.rules.isAdjacent(targetCoord, player)) {
               this.ui.displayMessage('Error: Cell is not adjacent to your territory.');
               return false;
           }

           this.claimCell(targetCoord, player.id);
           this.ui.displayMessage(`Player ${player.mark} conquered ${GameUtils.formatCoordForUser(targetCoord)}!`);
           return true;
       }

       private validateAndExecuteFortify(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);

            if (!this.grid.isValidCoordinate(targetCoord)) {
                 this.ui.displayMessage('Error: Coordinate is outside the board.');
                 return false;
            }
           if (!player.ownsPosition(targetCoordStr)) {
               this.ui.displayMessage('Error: You do not control this cell.');
               return false;
           }
           if (this.specials[targetCoordStr] === '⛨') {
               this.ui.displayMessage('Error: This cell is already fortified.');
               return false;
           }
           if (this.specials[targetCoordStr]) {
                this.ui.displayMessage(`Warning: Fortifying will remove the existing ${this.specials[targetCoordStr]} at ${GameUtils.formatCoordForUser(targetCoord)}.`);
           }

           this.specials[targetCoordStr] = '⛨';
           this.ui.displayMessage(`Player ${player.mark} fortified ${GameUtils.formatCoordForUser(targetCoord)} with ⛨!`);
           return true;
       }

       private validateAndExecuteAttack(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);
           const opponent = this.players[player.id === 0 ? 1 : 0];

            if (!this.grid.isValidCoordinate(targetCoord)) {
                 this.ui.displayMessage('Error: Coordinate is outside the board.');
                 return false;
            }
           if (!opponent.ownsPosition(targetCoordStr)) {
               const cellState = this.grid.getCell(targetCoord);
               if (player.ownsPosition(targetCoordStr)) {
                    this.ui.displayMessage('Error: Cannot attack your own cell.');
               } else if (cellState === ' ') {
                    this.ui.displayMessage('Error: Cannot attack an empty cell.');
               } else {
                    this.ui.displayMessage('Error: Cell does not belong to the enemy.');
               }
               return false;
           }
           if (!this.rules.isAdjacent(targetCoord, player)) {
               this.ui.displayMessage('Error: Enemy cell is not adjacent.');
               return false;
           }

           const isDefenderShielded = this.specials[targetCoordStr] === '⛨';
           const attackRoll = this.rules.rollAttackDice();
           const defenseRoll = this.rules.rollDefenseDice(isDefenderShielded);
           const attackSuccessful = attackRoll > defenseRoll;

           this.ui.displayAttackResult(player.mark, opponent.mark, attackRoll, defenseRoll, attackSuccessful);

           if (attackSuccessful) {
               opponent.removePosition(targetCoordStr);
               if (isDefenderShielded) {
                   delete this.specials[targetCoordStr];
                   this.ui.displayMessage(`Shield ⛨ at ${GameUtils.formatCoordForUser(targetCoord)} was destroyed!`);
               }
               this.claimCell(targetCoord, player.id);
           }
           return true;
       }

        private switchPlayer(): void {
            this.currentPlayerId = this.currentPlayerId === 0 ? 1 : 0;
        }

        private checkGameOver(): void {
            const winnerId = this.rules.checkWinner(this.players);
            if (winnerId !== null) {
                this.isGameOver = true;
            }
        }
    }
}

(async () => {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        displayHelp();
        return;
    }

    if (!process.env.GEMINI_API_KEY) {
        console.warn("\nWARNING: GEMINI_API_KEY environment variable not set.");
        console.warn("Player vs AI (PvE) mode will not be available.");
        console.warn("To play against the AI, please configure your Gemini API key.\n");
    }

    try {
        const game = new Game.GameController();
        await game.startGame();
    } catch (error) {
        console.error("\n===================================");
        console.error("A fatal error occurred in the game:");
        console.error(error);
        console.error("===================================\n");
        process.exit(1);
    }
})();
