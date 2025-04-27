#!/usr/bin/env node

import readline from 'readline';

function displayHelp(): void {
    console.log(`
   ██████╗ ██████╗ ██╗██████╗ ██╗      ██████╗ ██████╗ ██████╗ ███████╗
  ██╔════╝ ██╔══██╗██║██╔══██╗██║     ██╔═══██╗██╔══██╗██╔══██╗██╔════╝
  ██║  ███╗██████╔╝██║██║  ██║██║     ██║   ██║██████╔╝██║  ██║███████╗
  ██║   ██║██╔══██╗██║██║  ██║██║     ██║   ██║██╔══██╗██║  ██║╚════██║
  ╚██████╔╝██║  ██║██║██████╔╝███████╗╚██████╔╝██║  ██║██████╔╝███████║
   ╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝


  GRIDLORDS - GAME MANUAL
  ===========================================

  Objective:
  -----------
  Conquer and control ${GameConstants.VICTORY_CONDITION_CELLS} cells on a ${GameConstants.GRID_SIZE}x${GameConstants.GRID_SIZE} grid.
  Become the one and only Supreme Grid Lord.

  Gameplay Basics:
  ----------------
  - Turn-based battle: Player X vs Player O.
  - On each turn, you perform ONE action: Conquer, Fortify, or Attack.
  - The board uses Row Letters (A-E) and Column Numbers (1-5), ex: A1, C3, E5.

  Actions:
  --------
  1. **Conquer [CELL]** (Ex: C B3)
     - Target an EMPTY cell (' ') adjacent (horizontally or vertically) to your territory.
     - If the empty cell contains a Shield (⛨), you conquer the cell AND keep the shield.
     - You cannot conquer cells with initial Power Sources (∆) or Magic Wells (✶) directly (these must be captured via attack if owned by enemy, or maybe special actions later).

  2. **Fortify [CELL]** (Ex: F A1)
     - Fortify a cell you already control.
     - Adds a Shield (⛨), granting +${GameConstants.SHIELD_DEFENSE_MODIFIER} defense bonus.
     - Removes ∆ and ✶ if present on the fortified cell.
     - Cannot fortify if the cell already has a Shield.

  3. **Attack [CELL]** (Ex: A D4)
     - Attack an enemy-controlled adjacent cell.
     - Roll a six-sided die (1-${GameConstants.MAX_DICE_ROLL}) for both attacker and defender.
     - Defender adds +${GameConstants.SHIELD_DEFENSE_MODIFIER} if the cell has a Shield (⛨).
     - If attacker's roll > defender's roll, the attack succeeds:
       - You capture the cell.
       - Any Shield (⛨) is destroyed.
       - Any ∆ or ✶ is captured (no special effect yet).
     - If the attack fails, the cell remains enemy-controlled.

  Special Items:
  --------------
  - **∆ Power Source**: Unimplemented future effects.
  - **✶ Magic Well**: Unimplemented future effects.
  - **⛨ Shield**: Fortifies a cell with +${GameConstants.SHIELD_DEFENSE_MODIFIER} defense bonus.

  Game Modes:
  -----------
  - **PvP (Player vs Player)**: Human vs Human.
  - **PvE (Player vs AI)**: Battle against a Gemini-powered AI (set your GEMINI_API_KEY to enable).

  Controls:
  ---------
  - During your turn, input the action and target coordinate, separated by a space:
    - C B3 — Conquer B3
    - F A1 — Fortify A1
    - A E4 — Attack E4
  - Input is case-insensitive and automatically capitalized.

  Command Line Options:
  ---------------------
  - Run with '--help' or '-h' to display this manual.
    (Ex: npx gridlords -h)

  ---

  Good luck, Grid Lord.
  Command. Conquer. Survive.

  `);
    process.exit(0);
}

namespace GameConstants {
    export const GRID_SIZE: number = 5;
    export const PLAYER_MARKS = ['X', 'O'] as const;
    export const AI_PLAYER_ID: GameTypes.PlayerId = 1;
    export const AI_PLAYER_MARK = PLAYER_MARKS[AI_PLAYER_ID];
    export const SPECIAL_TYPES = ['∆', '✶', '⛨'] as const;
    export const VICTORY_CONDITION_CELLS: number = 13;
    export const INITIAL_SPECIAL_CELLS: number = 3;
    export const POWER_SOURCE_ATTACK_BONUS: number = 1;
    export const MAGIC_WELL_DEFENSE_BONUS: number = 1;
    export const SHIELD_DEFENSE_MODIFIER: number = 1;
    export const MIN_DICE_ROLL: number = 1;
    export const MAX_DICE_ROLL: number = 6;
    export const ASCII_A_OFFSET: number = 65;

    export const GEMINI_API_KEY: string | undefined = process.env.GEMINI_API_KEY;
    export const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
    export const AI_REQUEST_TIMEOUT_MS = 20000;
    export const AI_MAX_RETRIES = 2;
}

namespace GameTypes {
    export type PlayerId = 0 | 1;
    export type PlayerMark = typeof GameConstants.PLAYER_MARKS[number];
    export type SpecialType = typeof GameConstants.SPECIAL_TYPES[number];
    export type EmptyCell = ' ';
    export type CellState = EmptyCell | PlayerMark;
    export type CoordinateString = `${number},${number}`;
    export type GameMode = 'PvP' | 'PvE';

    export interface Coordinate {
        row: number;
        col: number;
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
        magicWellTargetCoord?: Coordinate;
    }

    export interface AIParsedResponse {
        action: AIActionType;
        coord: Coordinate;
        magicWellTargetCoord?: Coordinate;
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

        ownsAnyPowerSource(): boolean;
        addPowerSource(coordStr: GameTypes.CoordinateString): void;
        removePowerSource(coordStr: GameTypes.CoordinateString): void;

        ownsAnyMagicWell(): boolean;
        addMagicWell(coordStr: GameTypes.CoordinateString): void;
        removeMagicWell(coordStr: GameTypes.CoordinateString): void;
        getMagicWells(): ReadonlySet<GameTypes.CoordinateString>;
    }

    export interface IGameRules {
        isAdjacent(targetCoord: GameTypes.Coordinate, player: IPlayer): boolean;
        checkWinner(players: readonly [IPlayer, IPlayer]): GameTypes.PlayerId | null;
        rollAttackDice(attackerPlayer: IPlayer): number;
        rollDefenseDice(
            defendingPlayer: IPlayer,
            defendedCoord: GameTypes.Coordinate,
            isShielded: boolean,
            activeMagicWellBonusTarget: GameTypes.CoordinateString | null
        ): number;
        getValidMoves(player: IPlayer, opponent: IPlayer, grid: IGrid, specials: GameTypes.SpecialCellsMap): GameTypes.AIMove[];
        getValidMagicWellTargets(player: IPlayer): GameTypes.Coordinate[];
    }

    export interface IUserInterface {
        clearScreen(): void;
        renderBoard(grid: IGrid, specials: GameTypes.SpecialCellsMap, magicWellBonusTarget: GameTypes.CoordinateString | null): void;
        displayMessage(message: string): void;
        askQuestion(prompt: string): Promise<string>;
        promptGameMode(): Promise<GameTypes.GameMode>;
        promptPlayerMove(playerName: GameTypes.PlayerMark): Promise<GameTypes.PlayerMoveInput | null>;
        promptMagicWellTarget(player: GameInterfaces.IPlayer, validTargets: GameTypes.Coordinate[]): Promise<GameTypes.Coordinate | null>;
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
        private readonly ownedPowerSources: Set<GameTypes.CoordinateString>;
        private readonly ownedMagicWells: Set<GameTypes.CoordinateString>;

        constructor(id: GameTypes.PlayerId) {
            this.id = id;
            this.mark = GameConstants.PLAYER_MARKS[id];
            this.positions = new Set();
            this.ownedPowerSources = new Set();
            this.ownedMagicWells = new Set();
        }

        public addPosition(coordStr: GameTypes.CoordinateString): void {
            this.positions.add(coordStr);
        }

        public removePosition(coordStr: GameTypes.CoordinateString): void {
            this.positions.delete(coordStr);
            this.removePowerSource(coordStr);
            this.removeMagicWell(coordStr);
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

        public ownsAnyPowerSource(): boolean {
            return this.ownedPowerSources.size > 0;
        }

        public addPowerSource(coordStr: GameTypes.CoordinateString): void {
            this.ownedPowerSources.add(coordStr);
        }

        public removePowerSource(coordStr: GameTypes.CoordinateString): void {
            this.ownedPowerSources.delete(coordStr);
        }

        public ownsAnyMagicWell(): boolean {
            return this.ownedMagicWells.size > 0;
        }

        public addMagicWell(coordStr: GameTypes.CoordinateString): void {
            this.ownedMagicWells.add(coordStr);
        }

        public removeMagicWell(coordStr: GameTypes.CoordinateString): void {
            this.ownedMagicWells.delete(coordStr);
        }

        public getMagicWells(): ReadonlySet<GameTypes.CoordinateString> {
            return this.ownedMagicWells;
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

        public rollAttackDice(attackerPlayer: GameInterfaces.IPlayer): number {
            const baseRoll = GameUtils.randomInt(GameConstants.MIN_DICE_ROLL, GameConstants.MAX_DICE_ROLL);
            const powerBonus = attackerPlayer.ownsAnyPowerSource() ? GameConstants.POWER_SOURCE_ATTACK_BONUS : 0;
            return baseRoll + powerBonus;
        }

        public rollDefenseDice(
            defendingPlayer: GameInterfaces.IPlayer,
            defendedCoord: GameTypes.Coordinate,
            isShielded: boolean,
            activeMagicWellBonusTarget: GameTypes.CoordinateString | null
        ): number {
            const baseRoll = GameUtils.randomInt(GameConstants.MIN_DICE_ROLL, GameConstants.MAX_DICE_ROLL);
            const shieldBonus = isShielded ? GameConstants.SHIELD_DEFENSE_MODIFIER : 0;
            const defendedCoordStr = GameUtils.toCoordinateString(defendedCoord);
            const magicBonus = (activeMagicWellBonusTarget === defendedCoordStr) ? GameConstants.MAGIC_WELL_DEFENSE_BONUS : 0;

            return baseRoll + shieldBonus + magicBonus;
        }

        private isValid(r: number, c: number, gridSize: number): boolean {
            return r >= 0 && r < gridSize && c >= 0 && c < gridSize;
        }

        public getValidMoves(
            player: GameInterfaces.IPlayer,
            opponent: GameInterfaces.IPlayer,
            grid: GameInterfaces.IGrid,
            specials: GameTypes.SpecialCellsMap
        ): GameTypes.AIMove[] {
            const validMoves: GameTypes.AIMove[] = [];
            const gridSize = grid.getSize();
            const playerPositions = player.getPositions();

            for (const posStr of playerPositions) {
                const ownedCoord = GameUtils.fromCoordinateString(posStr);
                const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];

                if (specials[posStr] !== '⛨') {
                    validMoves.push({ action: 'FORTIFY', coord: ownedCoord });
                }

                for (const [dr, dc] of deltas) {
                    const targetRow = ownedCoord.row + dr;
                    const targetCol = ownedCoord.col + dc;
                    const targetCoord: GameTypes.Coordinate = { row: targetRow, col: targetCol };

                    if (this.isValid(targetRow, targetCol, gridSize)) {
                        const targetCoordStr = GameUtils.toCoordinateString(targetCoord);
                        const cellState = grid.getCell(targetCoord);

                        if (cellState === ' ') {
                            validMoves.push({ action: 'CONQUER', coord: targetCoord });
                        }
                        else if (opponent.ownsPosition(targetCoordStr)) {
                            validMoves.push({ action: 'ATTACK', coord: targetCoord });
                        }
                    }
                }
            }

            const uniqueMoves = new Map<string, GameTypes.AIMove>();
            for (const move of validMoves) {
                const key = `${move.action}:${GameUtils.toCoordinateString(move.coord)}`;
                if (!uniqueMoves.has(key)) {
                    uniqueMoves.set(key, move);
                }
            }

            return Array.from(uniqueMoves.values());
        }

        public getValidMagicWellTargets(player: GameInterfaces.IPlayer): GameTypes.Coordinate[] {
            const targets: GameTypes.Coordinate[] = [];
            for (const posStr of player.getPositions()) {
                targets.push(GameUtils.fromCoordinateString(posStr));
            }
            return targets;
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
            console.log('\n');
        }

        public renderBoard(grid: GameInterfaces.IGrid, specials: GameTypes.SpecialCellsMap, magicWellBonusTarget: GameTypes.CoordinateString | null): void {
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

                    let displayChar: string = cellContent;

                    if (special) {
                        displayChar = special;
                    }

                    let bonusIndicator = '';
                    if (magicWellBonusTarget === coordStr) {
                        bonusIndicator = '+';
                    }

                    const cellDisplay = `${displayChar}${bonusIndicator}`;
                    line += ` ${cellDisplay.padEnd(1)} `.slice(0, 3) + '|';

                }
                console.log(line);
                console.log('  ' + '+---'.repeat(size) + '+');
            }

            console.log(`Legend: X, O = Players | ∆ = Power | ✶ = Magic Well | ⛨ = Shield | [+] = Active ✶ Bonus`);
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
                        this.displayMessage("\nERROR: Gemini API Key not configured. Set GEMINI_API_KEY env variable. PvE unavailable.\n");
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
                'C': 'CONQUER', 'F': 'FORTIFY', 'A': 'ATTACK',
            };

            while (true) {
                const actionHelp = `Actions: C=Conquer, F=Fortify, A=Attack`;
                const promptMsg = `${actionHelp}\nPlayer ${playerName}'s turn. Enter ACTION COORDINATE (e.g., C B3, A A1, F C5):`;
                const input = await this.askQuestion(`${promptMsg}\n> `);
                const parts = input.trim().toUpperCase().split(/\s+/);

                if (parts.length !== 2) {
                    this.displayMessage('Invalid input format. Use: ACTION COORD (e.g., C B3).');
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
                    if (coordStr.match(/^[A-Z][1-9]\d*$/i)) {
                         const maxRowChar = String.fromCharCode(GameConstants.ASCII_A_OFFSET + GameConstants.GRID_SIZE - 1);
                         const maxCol = GameConstants.GRID_SIZE;
                         this.displayMessage(`Invalid coordinate "${coordStr}". Row must be A-${maxRowChar}, Column must be 1-${maxCol}.`);
                    } else {
                        this.displayMessage(`Invalid coordinate format "${coordStr}". Use LetterNumber (e.g., A1, C5).`);
                    }
                    continue;
                }

                return { action, coord };
            }
        }

        public async promptMagicWellTarget(player: GameInterfaces.IPlayer, validTargets: GameTypes.Coordinate[]): Promise<GameTypes.Coordinate | null> {
            if (validTargets.length === 0) {
                this.displayMessage("You own a Magic Well (✶) but have no cells to target for the bonus.");
                return null;
            }

            this.displayMessage(`\n--- Magic Well Activation (Player ${player.mark}) ---`);
            this.displayMessage("You own a Magic Well (✶)! Choose one of your cells to receive a +1 defense bonus during the opponent's next turn.");
            const targetOptions = validTargets.map(GameUtils.formatCoordForUser).join(', ');
            this.displayMessage(`Valid targets: ${targetOptions}`);

            while(true) {
                const input = await this.askQuestion('Enter coordinate to boost (e.g., B2): ');
                const coord = GameUtils.parseCoordinateInput(input);

                if (!coord) {
                    this.displayMessage(`Invalid coordinate format "${input}". Use LetterNumber (e.g., B2).`);
                    continue;
                }

                const coordStr = GameUtils.toCoordinateString(coord);
                if (!player.ownsPosition(coordStr)) {
                    this.displayMessage(`Invalid choice. You do not own ${GameUtils.formatCoordForUser(coord)}. Choose from: ${targetOptions}`);
                    continue;
                }

                this.displayMessage(`Cell ${GameUtils.formatCoordForUser(coord)} will receive the defense bonus.`);
                this.displayMessage('-------------------------------------\n');
                return coord;
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
            this.displayMessage(`  Rolls: Attacker (${attackerMark}) = ${attackRoll} | Defender (${defenderMark}) = ${defenseRoll}`);
            if (success) {
                this.displayMessage(`  Result: ATTACK SUCCESSFUL!`);
            } else {
                this.displayMessage(`  Result: Attack Failed. Defense holds!`);
            }
            this.displayMessage('----------------------------------');
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
             if (move.magicWellTargetCoord) {
                this.displayMessage(`*** AI (${aiMark}) activates Magic Well (✶) on ${GameUtils.formatCoordForUser(move.magicWellTargetCoord)} ***`);
             }
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
                 this.displayMessage(`      GAME OVER! Player ${winnerMark} is the SUPREME GRID LORD!!!`);
             } else {
                 this.displayMessage(`      GAME OVER! Draw or Stalemate!`);
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
                let rowLine = `${rowLetter} |`;
                for (let c = 0; c < gridSize; c++) {
                    const coord: GameTypes.Coordinate = { row: r, col: c };
                    const coordStr = GameUtils.toCoordinateString(coord);
                    const special = specials[coordStr];
                    const cell = grid.getCell(coord);
                    const displayChar: string = special ?? cell;
                    rowLine += ` ${displayChar.padEnd(1)} |`;
                }

                boardString += rowLine + "\n";
                boardString += '  +' + '---+'.repeat(gridSize) + '\n';
            }

            const aiPositions = Array.from(aiPlayer.getPositions()).map(cs => GameUtils.formatCoordForUser(GameUtils.fromCoordinateString(cs))).join(', ') || 'None';
            const humanPositions = Array.from(humanPlayer.getPositions()).map(cs => GameUtils.formatCoordForUser(GameUtils.fromCoordinateString(cs))).join(', ') || 'None';
            const aiMagicWells = Array.from(aiPlayer.getMagicWells()).map(cs => GameUtils.formatCoordForUser(GameUtils.fromCoordinateString(cs))).join(', ') || 'None';
            const validMagicWellTargets = rules.getValidMagicWellTargets(aiPlayer).map(GameUtils.formatCoordForUser).join(', ') || 'None available';
            const specialLocations = Object.entries(specials)
                    .map(([coordStr, type]) => `${GameUtils.formatCoordForUser(GameUtils.fromCoordinateString(coordStr as GameTypes.CoordinateString))}(${type})`)
                    .join(', ') || 'None';


            const prompt = `
        You are Gridlords AI Player ${aiPlayer.mark}. Goal: ${GameConstants.VICTORY_CONDITION_CELLS} cells. Grid ${gridSize}x${gridSize}.

        Current Board State:
        ${boardString}
        Legend: [ ]=Empty, X, O = Players, ∆=Power, ✶=MagicWell, ⛨=Shield

        Your Cells (${aiPlayer.getPositionCount()}): ${aiPositions}
        Opponent (${humanPlayer.mark}) Cells (${humanPlayer.getPositionCount()}): ${humanPositions}
        Board Specials: ${specialLocations}
        You own Magic Wells (✶) at: ${aiMagicWells}

        Rules Summary:
        - Actions: CONQUER, FORTIFY, ATTACK. Choose ONE per turn.
        - Adjacency: CONQUER/ATTACK target MUST be adjacent (up/down/left/right) to one of YOUR cells (${aiPlayer.mark}).
        - CONQUER: Target an EMPTY cell (' ') adjacent to YOUR territory. Empty means the cell shows ' ' on the board.
            - If the empty cell has a ⛨, you capture the cell AND the ⛨ remains.
            - If the empty cell has ∆ or ✶, you capture it.
        - FORTIFY: Target YOUR OWN cell (${aiPlayer.mark}) without a ⛨. Adds ⛨. Removes existing ∆ or ✶ from the cell and your control.
        - ATTACK: Target an OPPONENT'S cell (${humanPlayer.mark}) adjacent to YOUR territory.
            - Roll dice: Attacker (+${GameConstants.POWER_SOURCE_ATTACK_BONUS} if owns any ∆) vs Defender (+${GameConstants.SHIELD_DEFENSE_MODIFIER} if cell has ⛨, +${GameConstants.MAGIC_WELL_DEFENSE_BONUS} if targeted by active ✶ effect).
            - Win: Capture cell, DESTROY ⛨ if present, CAPTURE ∆ or ✶ if present.
        - Magic Well Bonus (✶): If you own any ✶, after your main action, choose ONE of YOUR cells (${validMagicWellTargets}) to get +${GameConstants.MAGIC_WELL_DEFENSE_BONUS} defense on opponent's next turn.

        IMPORTANT: Choose a VALID move based ONLY on the board state and rules above.
        - Do NOT CONQUER occupied cells (X or O).
        - Do NOT CONQUER non-adjacent cells.
        - Do NOT ATTACK empty or own cells.
        - Do NOT ATTACK non-adjacent cells.
        - Do NOT FORTIFY non-owned cells or cells already with ⛨.

        Your turn (${aiPlayer.mark}). Choose your main action (ACTION: COORD).
        If you own any Magic Wells (✶), ALSO specify your bonus target on a NEW LINE (WELL_TARGET: COORD). Choose from your owned cells (${validMagicWellTargets}).

        Respond ONLY with the action and coordinate, and optionally the well target on a new line.
        Valid examples:
        CONQUER: B3
        ATTACK: D4
        WELL_TARGET: C5
        FORTIFY: A1
        WELL_TARGET: A1

        Invalid Examples (Do NOT output these):
        CONQUER: C3 (If C3 contains X or O)
        ATTACK: B3 (If B3 is empty or owned by you)
        FORTIFY: D4 (If you don't own D4)
        CONQUER: E1 (If E1 is not adjacent to any of your cells)

        What is your move?
        `;
            return prompt.trim();
        }

        private parseAIResponse(responseText: string): GameTypes.AIParsedResponse | null {
            const lines = responseText.trim().toUpperCase().split('\n');
            const mainActionLine = lines[0];
            const wellTargetLine = lines.length > 1 ? lines[1] : null;

            const mainMatch = mainActionLine.match(/^(CONQUER|FORTIFY|ATTACK):\s?([A-Z][1-9]\d*)$/);
            if (!mainMatch) {
                console.error(`Error parsing AI response: unexpected main action format "${mainActionLine}"`);
                return null;
            }

            const action = mainMatch[1] as GameTypes.AIActionType;
            const coordInput = mainMatch[2];
            const coord = GameUtils.parseCoordinateInput(coordInput);

            if (!coord) {
                console.error(`Error parsing AI response: invalid main coordinate "${coordInput}"`);
                return null;
            }

            let magicWellTargetCoord: GameTypes.Coordinate | undefined = undefined;
            if (wellTargetLine) {
                const wellMatch = wellTargetLine.match(/^WELL_TARGET:\s?([A-Z][1-9]\d*)$/);
                if (wellMatch) {
                    const wellCoordInput = wellMatch[1];
                    const parsedWellCoord = GameUtils.parseCoordinateInput(wellCoordInput);
                    if (parsedWellCoord) {
                        magicWellTargetCoord = parsedWellCoord;
                    } else {
                        console.warn(`AI provided invalid WELL_TARGET format: "${wellCoordInput}". Ignoring.`);
                    }
                } else {
                     console.warn(`AI provided malformed WELL_TARGET line: "${wellTargetLine}". Ignoring.`);
                }
            }

            return { action, coord, magicWellTargetCoord };
        }


        private async callGeminiAPI(prompt: string): Promise<string | null> {
            const url = `${GameConstants.GEMINI_API_ENDPOINT}?key=${this.apiKey}`;
            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                 generationConfig: {
                     temperature: 0.7,
                 }
            };

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            let parsedResponse: GameTypes.AIParsedResponse | null = null;

            while (attempts <= GameConstants.AI_MAX_RETRIES && !parsedResponse) {
                if (attempts > 0) {
                     console.log(`Attempt ${attempts + 1} to get AI move...`);
                     await GameUtils.sleep(500);
                }
                const responseText = await this.callGeminiAPI(prompt);

                if (responseText) {
                    parsedResponse = this.parseAIResponse(responseText);
                    if (parsedResponse) {
                         const targetCoordStr = GameUtils.toCoordinateString(parsedResponse.coord);
                         const targetCellState = grid.getCell(parsedResponse.coord);
                         const targetSpecial = specials[targetCoordStr];

                         let isValid = true;
                         let errorMsg = "";

                         switch (parsedResponse.action) {
                             case 'CONQUER':
                                 if (targetCellState !== ' ') { isValid = false; errorMsg = "CONQUER target not empty"; }
                                 if (!rules.isAdjacent(parsedResponse.coord, aiPlayer)) { isValid = false; errorMsg = "CONQUER target not adjacent"; }
                                 break;
                             case 'FORTIFY':
                                 if (!aiPlayer.ownsPosition(targetCoordStr)) { isValid = false; errorMsg = "FORTIFY target not owned"; }
                                 if (targetSpecial === '⛨') { isValid = false; errorMsg = "FORTIFY target already shielded"; }
                                 break;
                             case 'ATTACK':
                                 if (!humanPlayer.ownsPosition(targetCoordStr)) { isValid = false; errorMsg = "ATTACK target not enemy"; }
                                 if (!rules.isAdjacent(parsedResponse.coord, aiPlayer)) { isValid = false; errorMsg = "ATTACK target not adjacent"; }
                                 break;
                         }

                         if (parsedResponse.magicWellTargetCoord) {
                             if (!aiPlayer.ownsAnyMagicWell()) {
                                 console.warn("AI provided WELL_TARGET but owns no Magic Wells. Ignoring target.");
                                 parsedResponse.magicWellTargetCoord = undefined;
                             } else {
                                 const wellTargetStr = GameUtils.toCoordinateString(parsedResponse.magicWellTargetCoord);
                                 if (!aiPlayer.ownsPosition(wellTargetStr)) {
                                     console.warn(`AI provided invalid WELL_TARGET ${GameUtils.formatCoordForUser(parsedResponse.magicWellTargetCoord)} (not owned). Ignoring target.`);
                                     parsedResponse.magicWellTargetCoord = undefined;
                                 }
                             }
                         }


                         if (!isValid) {
                             console.warn(`AI suggested invalid move: ${parsedResponse.action} ${GameUtils.formatCoordForUser(parsedResponse.coord)} (${errorMsg}). Retrying...`);
                             parsedResponse = null;
                         }

                    }
                } else {
                    console.error("Communication failure with Gemini API.");
                }
                attempts++;
            }

            if (!parsedResponse) {
                console.error("AI failed to provide a valid move after multiple attempts.");
                const validMoves = rules.getValidMoves(aiPlayer, humanPlayer, grid, specials);
                const fallbackMove = GameUtils.getRandomElement(validMoves);
                 if (fallbackMove) {
                     console.log("Using random valid move as fallback.");
                     parsedResponse = fallbackMove;
                 } else {
                     console.error("No valid moves found for AI (fallback failed).");
                     return null;
                 }
            }

            if (aiPlayer.ownsAnyMagicWell() && !parsedResponse.magicWellTargetCoord) {
                const validTargets = rules.getValidMagicWellTargets(aiPlayer);
                const randomTarget = GameUtils.getRandomElement(validTargets);
                if (randomTarget) {
                     console.log("AI owns Magic Well but didn't specify target. Assigning random valid target.");
                     parsedResponse.magicWellTargetCoord = randomTarget;
                }
            }

            return parsedResponse;
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

        private magicWellBonusTarget: GameTypes.CoordinateString | null = null;
        private magicWellBonusActiveForPlayerId: GameTypes.PlayerId | null = null;

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

             await GameUtils.sleep(1000);
             this.setupInitialState();
             return true;
        }

        private setupInitialState(): void {
            this.claimCell({ row: 0, col: 0 }, 0);
            this.claimCell({ row: GameConstants.GRID_SIZE - 1, col: GameConstants.GRID_SIZE - 1 }, 1);

            let specialsPlaced = 0;
            const maxPlacementAttempts = GameConstants.GRID_SIZE * GameConstants.GRID_SIZE * 2;
            let attempts = 0;
            const potentialCoords: GameTypes.Coordinate[] = [];
            for (let r = 0; r < GameConstants.GRID_SIZE; r++) {
                 for (let c = 0; c < GameConstants.GRID_SIZE; c++) {
                      potentialCoords.push({row: r, col: c});
                 }
            }

            while (specialsPlaced < GameConstants.INITIAL_SPECIAL_CELLS && attempts < maxPlacementAttempts && potentialCoords.length > 0) {
                 const randIndex = GameUtils.randomInt(0, potentialCoords.length - 1);
                 const coord = potentialCoords.splice(randIndex, 1)[0];
                 const coordStr = GameUtils.toCoordinateString(coord);

                 if (this.grid.getCell(coord) === ' ' && !this.specials[coordStr]) {
                    const specialType = GameConstants.SPECIAL_TYPES[specialsPlaced % GameConstants.SPECIAL_TYPES.length];
                    this.specials[coordStr] = specialType;
                    specialsPlaced++;
                 }
                 attempts++;
            }

            if (specialsPlaced < GameConstants.INITIAL_SPECIAL_CELLS) {
                 console.warn("Warning: Could not place all initial specials (board too small or unlucky?).");
            }

            this.ui.clearScreen();
            this.ui.displayMessage("GRIDLORDS - Started!");
            this.ui.displayMessage(`Objective: Control ${GameConstants.VICTORY_CONDITION_CELLS} cells.`);
            this.ui.displayMessage("Good luck, Lords!\n");
        }

        private claimCell(coord: GameTypes.Coordinate, playerId: GameTypes.PlayerId): void {
            const player = this.players[playerId];
            const coordStr = GameUtils.toCoordinateString(coord);
            this.grid.setCell(coord, player.mark);
            player.addPosition(coordStr);
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
                } else {
                     this.ui.clearScreen();
                     this.ui.renderBoard(this.grid, this.specials, this.magicWellBonusTarget);
                }
            }

            const winnerId = this.rules.checkWinner(this.players);
            const winnerMark = winnerId !== null ? this.players[winnerId].mark : null;
            this.ui.displayVictory(winnerMark);
            this.ui.close();
        }

        private async executePlayerTurn(): Promise<void> {
            const currentPlayer = this.players[this.currentPlayerId];
            const opponentPlayer = this.players[this.currentPlayerId === 0 ? 1 : 0];
            const isAITurn = this.gameMode === 'PvE' && currentPlayer.id === GameConstants.AI_PLAYER_ID && this.aiLogic;

            this.magicWellBonusTarget = null;
            this.magicWellBonusActiveForPlayerId = null;

            this.ui.clearScreen();
            this.ui.renderBoard(this.grid, this.specials, this.magicWellBonusTarget);

            let moveSuccessful = false;
            if (isAITurn) {
                moveSuccessful = await this.executeAITurn(currentPlayer);
            } else {
                moveSuccessful = await this.executeHumanTurn(currentPlayer);
            }

            if (moveSuccessful && currentPlayer.ownsAnyMagicWell()) {
                const validTargets = this.rules.getValidMagicWellTargets(currentPlayer);
                let chosenTargetCoord: GameTypes.Coordinate | null = null;

                if (isAITurn) {
                    const aiMove = (this.lastAIMoveResult);
                    if (aiMove?.magicWellTargetCoord) {
                        chosenTargetCoord = aiMove.magicWellTargetCoord;
                    } else if (validTargets.length > 0) {
                         console.warn("AI owns Magic Well but no target decided/fallback failed. Skipping bonus.");
                    }
                } else {
                     chosenTargetCoord = await this.ui.promptMagicWellTarget(currentPlayer, validTargets);
                }

                if (chosenTargetCoord) {
                    this.magicWellBonusTarget = GameUtils.toCoordinateString(chosenTargetCoord);
                    this.magicWellBonusActiveForPlayerId = opponentPlayer.id;
                }
            }
             await GameUtils.sleep(1500);
        }

        private lastAIMoveResult: GameTypes.AIMove | null = null;

        private async executeHumanTurn(player: GameInterfaces.IPlayer): Promise<boolean> {
             let actionIsValidAndExecuted = false;
             while (!actionIsValidAndExecuted) {
                 this.ui.clearScreen();
                 this.ui.renderBoard(this.grid, this.specials, this.magicWellBonusTarget);

                 const moveInput = await this.ui.promptPlayerMove(player.mark);
                 if (!moveInput) {
                     this.ui.displayMessage("Unexpected error processing move. Try again.");
                     await GameUtils.sleep(1500);
                     continue;
                 }

                 actionIsValidAndExecuted = this.processPlayerAction(player, moveInput.action, moveInput.coord);

                 if (!actionIsValidAndExecuted) {
                      await this.ui.askQuestion("Action failed or was invalid. Press Enter to try again...");
                 }
             }
             return actionIsValidAndExecuted;
        }

        private async executeAITurn(aiPlayer: GameInterfaces.IPlayer): Promise<boolean> {
             this.ui.displayAIThinking();
             const humanPlayer = this.players[aiPlayer.id === 0 ? 1 : 0];
             this.lastAIMoveResult = null;

             if (!this.aiLogic) {
                 this.ui.displayAIError("AI logic is not available!");
                 return false;
             }

             const aiMove = await this.aiLogic.decideMove(aiPlayer, humanPlayer, this.grid, this.specials, this.rules);

             if (!aiMove) {
                 this.ui.displayAIError("Could not determine a move.");
                 await GameUtils.sleep(1500);
                 return false;
             }

             this.lastAIMoveResult = aiMove;
             this.ui.displayAIMove(aiPlayer.mark, aiMove);
             await GameUtils.sleep(1500);

             const success = this.processPlayerAction(aiPlayer, aiMove.action, aiMove.coord);

             if (!success) {
                 this.ui.displayAIError(`AI's chosen action (${aiMove.action}: ${GameUtils.formatCoordForUser(aiMove.coord)}) failed validation.`);
                 await GameUtils.sleep(1500);
             }
             return success;
        }

        private processPlayerAction(player: GameInterfaces.IPlayer, action: GameTypes.AIActionType, coord: GameTypes.Coordinate): boolean {
             switch (action) {
                 case 'CONQUER':
                     return this.validateAndExecuteConquer(player, coord);
                 case 'FORTIFY':
                     return this.validateAndExecuteFortify(player, coord);
                 case 'ATTACK':
                     return this.validateAndExecuteAttack(player, coord);
                 default:
                     this.ui.displayMessage("Unknown action received.");
                     return false;
             }
        }


       private validateAndExecuteConquer(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);
           const opponent = this.players[player.id === 0 ? 1 : 0];

           if (!this.grid.isValidCoordinate(targetCoord)) {
                this.ui.displayMessage('Error: Coordinate is outside the board.'); return false;
           }
           if (this.grid.getCell(targetCoord) !== ' ') {
               this.ui.displayMessage('Error: Target cell is not empty.'); return false;
           }
           if (!this.rules.isAdjacent(targetCoord, player)) {
               this.ui.displayMessage('Error: Target cell is not adjacent to your territory.'); return false;
           }

           const existingSpecial = this.specials[targetCoordStr];

           if (existingSpecial) {
               if (existingSpecial === '⛨') {
                   this.ui.displayMessage(`Player ${player.mark} conquered shielded cell ${GameUtils.formatCoordForUser(targetCoord)}! Shield remains.`);
               } else if (existingSpecial === '∆') {
                   this.ui.displayMessage(`Player ${player.mark} conquered and captured Power Source ∆ at ${GameUtils.formatCoordForUser(targetCoord)}! (+1 Attack Bonus)`);
                   delete this.specials[targetCoordStr];
                   player.addPowerSource(targetCoordStr);
               } else if (existingSpecial === '✶') {
                   this.ui.displayMessage(`Player ${player.mark} conquered and captured Magic Well ✶ at ${GameUtils.formatCoordForUser(targetCoord)}! (Defense Bonus ability)`);
                   delete this.specials[targetCoordStr];
                   player.addMagicWell(targetCoordStr);
               }
           } else {
               this.ui.displayMessage(`Player ${player.mark} conquered ${GameUtils.formatCoordForUser(targetCoord)}!`);
           }

           this.claimCell(targetCoord, player.id);
           return true;
       }


       private validateAndExecuteFortify(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);

           if (!this.grid.isValidCoordinate(targetCoord)) {
                this.ui.displayMessage('Error: Coordinate is outside the board.'); return false;
           }
           if (!player.ownsPosition(targetCoordStr)) {
               this.ui.displayMessage('Error: You do not control this cell.'); return false;
           }
           if (this.specials[targetCoordStr] === '⛨') {
               this.ui.displayMessage('Error: This cell is already fortified with ⛨.'); return false;
           }

           const existingSpecial = this.specials[targetCoordStr];
           if (existingSpecial) {
                this.ui.displayMessage(`Warning: Fortifying removes the existing ${existingSpecial} at ${GameUtils.formatCoordForUser(targetCoord)}.`);
                if (existingSpecial === '∆') player.removePowerSource(targetCoordStr);
                if (existingSpecial === '✶') player.removeMagicWell(targetCoordStr);
                delete this.specials[targetCoordStr];
           }

           this.specials[targetCoordStr] = '⛨';
           this.ui.displayMessage(`Player ${player.mark} fortified ${GameUtils.formatCoordForUser(targetCoord)} with ⛨!`);
           return true;
       }


       private validateAndExecuteAttack(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);
           const opponent = this.players[player.id === 0 ? 1 : 0];

           if (!this.grid.isValidCoordinate(targetCoord)) {
                this.ui.displayMessage('Error: Coordinate is outside the board.'); return false;
           }
           if (!opponent.ownsPosition(targetCoordStr)) {
                this.ui.displayMessage('Error: Target cell is not controlled by the enemy.'); return false;
           }
           if (!this.rules.isAdjacent(targetCoord, player)) {
               this.ui.displayMessage('Error: Target cell is not adjacent to your territory.'); return false;
           }

           const defenderSpecial = this.specials[targetCoordStr];
           const isDefenderShielded = defenderSpecial === '⛨';

           const isMagicWellBoosted = this.magicWellBonusActiveForPlayerId === opponent.id &&
                                     this.magicWellBonusTarget === targetCoordStr;

           const attackRoll = this.rules.rollAttackDice(player);
           const defenseRoll = this.rules.rollDefenseDice(opponent, targetCoord, isDefenderShielded, isMagicWellBoosted ? targetCoordStr : null);
           const attackSuccessful = attackRoll > defenseRoll;

           this.ui.displayAttackResult(player.mark, opponent.mark, attackRoll, defenseRoll, attackSuccessful);

           if (attackSuccessful) {
               opponent.removePosition(targetCoordStr);

               if (defenderSpecial) {
                   if (defenderSpecial === '⛨') {
                       this.ui.displayMessage(`Defender's Shield ⛨ at ${GameUtils.formatCoordForUser(targetCoord)} was destroyed!`);
                       delete this.specials[targetCoordStr];
                   } else if (defenderSpecial === '∆') {
                       this.ui.displayMessage(`Player ${player.mark} captured opponent's Power Source ∆ at ${GameUtils.formatCoordForUser(targetCoord)}!`);
                       opponent.removePowerSource(targetCoordStr);
                       delete this.specials[targetCoordStr];
                       player.addPowerSource(targetCoordStr);
                   } else if (defenderSpecial === '✶') {
                        this.ui.displayMessage(`Player ${player.mark} captured opponent's Magic Well ✶ at ${GameUtils.formatCoordForUser(targetCoord)}!`);
                        opponent.removeMagicWell(targetCoordStr);
                        delete this.specials[targetCoordStr];
                        player.addMagicWell(targetCoordStr);
                   }
               }

               this.claimCell(targetCoord, player.id);
               this.ui.displayMessage(`Player ${player.mark} successfully captured ${GameUtils.formatCoordForUser(targetCoord)}!`);

           } else {
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

    if (!GameConstants.GEMINI_API_KEY) {
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
        console.error(error instanceof Error ? error.stack : error);
        console.error("===================================\n");
        process.exit(1);
    }
})();
