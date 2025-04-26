#!/usr/bin/env node

// GRIDLORDS - GEMINI EDITION - TERMINAL TUI
// Implementação Modularizada com IA (Google Gemini API)
// Feito com TypeScript puro e API REST do Gemini

import readline from 'readline';
// import { fetch } from 'undici'; // Use 'undici' for fetch in older Node versions if needed, or rely on global fetch in Node 18+

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
             console.error(`Coordenada inválida: Linha deve ser A-${maxRowChar}, Coluna deve ser 1-${maxCol}.`);
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
                console.warn(`Tentativa de definir célula fora dos limites: ${GameUtils.formatCoordForUser(coord)}`);
            }
        }

        public getCell(coord: GameTypes.Coordinate): GameTypes.CellState {
            if (this.isValidCoordinate(coord)) {
                return this.cells[coord.row][coord.col];
            }
            console.warn(`Tentativa de obter célula fora dos limites: ${GameUtils.formatCoordForUser(coord)}`);
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

                        if (cellState === ' ' && (!isSpecial || specials[targetCoordStr] === '⛨')) { // Can conquer empty or shielded empty
                             // Actually, conquering a shield directly isn't allowed, only empty non-special
                             if (!isSpecial) {
                                validMoves.push({ action: 'CONQUER', coord: targetCoord });
                             }
                        }
                        else if (opponent.ownsPosition(targetCoordStr)) {
                             validMoves.push({ action: 'ATTACK', coord: targetCoord });
                        }
                    }
                }

                const ownedCoordStr = GameUtils.toCoordinateString(ownedCoord);
                if (specials[ownedCoordStr] !== '⛨') { // Use the actual shield character constant
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
                this.displayMessage("\nSaindo do Gridlords. Até logo!");
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
             this.displayMessage("Bem-vindo ao GRIDLORDS!");
             this.displayMessage("------------------------");
             while (true) {
                this.displayMessage("Escolha o modo de jogo:");
                this.displayMessage("  1) Jogador vs Jogador (PvP)");
                this.displayMessage("  2) Jogador vs IA (PvE - Gemini)");
                const choice = await this.askQuestion('> ');
                if (choice === '1') return 'PvP';
                if (choice === '2') {
                    if (!GameConstants.GEMINI_API_KEY) {
                        this.displayMessage("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                        this.displayMessage("!! ERRO: Chave da API Gemini não configurada.            !!");
                        this.displayMessage("!! Defina a variável de ambiente GEMINI_API_KEY.       !!");
                        this.displayMessage("!! O modo PvE não pode ser iniciado.                     !!");
                        this.displayMessage("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
                    } else {
                        return 'PvE';
                    }
                } else {
                    this.displayMessage('Escolha inválida. Digite 1 ou 2.');
                }
             }
        }

        public async promptPlayerMove(playerName: GameTypes.PlayerMark): Promise<GameTypes.PlayerMoveInput | null> {
            const actionMap: Record<string, GameTypes.AIActionType> = {
                // 'CONQUISTAR': 'CONQUER',
                // 'FORTIFICAR': 'FORTIFY',
                'A': 'ATTACK',
                'C': 'CONQUER', // Allow English too
                'F': 'FORTIFY',
                // 'ATTACK': 'ATTACK',
            };

            while (true) {
                const promptMsgBase = `C = Conquistar, F = Fortificar, A = Atacar`;
                // const promptMsg = `Vez de ${playerName}. Digite [AÇÃO] [COORDENADA] (ex: C B3, A A1, F C5):`;
                const promptMsg = `${promptMsgBase}\nVez de ${playerName}. Digite [AÇÃO] [COORDENADA] (ex: C B3, A A1, F C5):`;
                const input = await this.askQuestion(`${promptMsg}\n> `);
                const parts = input.trim().toUpperCase().split(/\s+/); // Split by one or more spaces

                if (parts.length !== 2) {
                    this.displayMessage('Entrada inválida. Use o formato AÇÃO COORDENADA (ex: CONQUISTAR B3).');
                    continue;
                }

                const actionStr = parts[0];
                const coordStr = parts[1];

                const action = actionMap[actionStr];
                if (!action) {
                    this.displayMessage(`Ação inválida "${actionStr}". Use CONQUISTAR, FORTIFICAR ou ATACAR.`);
                    continue;
                }

                const coord = GameUtils.parseCoordinateInput(coordStr);
                if (!coord) {
                    // parseCoordinateInput already logs specific error
                    this.displayMessage(`Coordenada inválida "${coordStr}". Use LetraNúmero (ex: A1, C5).`);
                    continue;
                }

                return { action, coord }; // Valid input parsed
            }
        }

        public displayAttackResult(
            attackerMark: GameTypes.PlayerMark,
            defenderMark: GameTypes.PlayerMark,
            attackRoll: number,
            defenseRoll: number,
            success: boolean): void
        {
            this.displayMessage(`--- Ataque ${attackerMark} vs ${defenderMark} ---`);
            this.displayMessage(`  > ROLAGENS: Atacante (${attackerMark}): ${attackRoll} | Defensor (${defenderMark}): ${defenseRoll}`);
            if (success) {
                this.displayMessage(`  > RESULTADO: Vitória do Atacante! Célula conquistada.`);
            } else {
                this.displayMessage(`  > RESULTADO: Falha no Ataque! Defesa bem-sucedida.`);
            }
            this.displayMessage('----------------------------------\n');
        }

         public displayAIMove(aiMark: GameTypes.PlayerMark, move: GameTypes.AIMove): void {
            const coordStr = GameUtils.formatCoordForUser(move.coord);
            let actionText = '';
            switch(move.action) {
                case 'CONQUER': actionText = `conquista ${coordStr}`; break;
                case 'FORTIFY': actionText = `fortifica ${coordStr} com ⛨`; break; // Use actual shield character
                case 'ATTACK': actionText = `ataca ${coordStr}`; break;
            }
             this.displayMessage(`*** IA (${aiMark}) decide: ${actionText} ***`);
         }

         public displayAIThinking(): void {
             this.displayMessage(`--- Vez da IA (${GameConstants.AI_PLAYER_MARK}) ---`);
             this.displayMessage("IA está pensando...");
         }

         public displayAIError(errorMsg: string): void {
            this.displayMessage(`!!! Erro da IA: ${errorMsg} !!!`);
            this.displayMessage("!!! A IA pode ter pulado o turno ou feito uma jogada aleatória. !!!");
         }

        public displayVictory(winnerMark: GameTypes.PlayerMark | null): void {
             this.displayMessage("\n==============================================");
             if (winnerMark) {
                 this.displayMessage(`      FIM DE JOGO!`);
                 this.displayMessage(` JOGADOR ${winnerMark} É O LORD SUPREMO DO GRID!!! `);
             } else {
                 this.displayMessage(`      FIM DE JOGO!`);
                 this.displayMessage(`       EMPATE OU CONDIÇÃO DE FIM NÃO ATINGIDA! `);
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
            for (let c = 0; c < gridSize; c++) boardString += ` ${c + 1}  `; // Adjusted spacing
            boardString += "\n";
             boardString += '  +' + '---+'.repeat(gridSize) + '\n'; // Top border

            for (let r = 0; r < gridSize; r++) {
                const rowLetter = String.fromCharCode(GameConstants.ASCII_A_OFFSET + r);
                boardString += `${rowLetter} |`;
                for (let c = 0; c < gridSize; c++) {
                    const coord: GameTypes.Coordinate = { row: r, col: c };
                    const coordStr = GameUtils.toCoordinateString(coord);
                    const special = specials[coordStr];
                    const cell = grid.getCell(coord);
                    const displayChar = special ?? cell;
                    boardString += ` ${displayChar.padEnd(1)} |`; // Padded content
                }
                boardString += "\n";
                 boardString += '  +' + '---+'.repeat(gridSize) + '\n'; // Separator line
            }

            const aiPositions = Array.from(aiPlayer.getPositions()).map(GameUtils.fromCoordinateString).map(GameUtils.formatCoordForUser).join(', ') || 'Nenhuma';
            const humanPositions = Array.from(humanPlayer.getPositions()).map(GameUtils.fromCoordinateString).map(GameUtils.formatCoordForUser).join(', ') || 'Nenhuma';
            let specialLocations = Object.entries(specials)
                .map(([coordStr, type]) => `${GameUtils.formatCoordForUser(GameUtils.fromCoordinateString(coordStr as GameTypes.CoordinateString))}(${type})`)
                .join(', ') || 'Nenhum';

            const rulesSummary = `
Regras Principais:
- Objetivo: Controlar ${GameConstants.VICTORY_CONDITION_CELLS} células.
- Ações: CONQUER (célula vazia adjacente), FORTIFY (sua célula com ⛨), ATTACK (célula inimiga adjacente).
- Ataque: Dado de Ataque > Dado de Defesa (+1 se ⛨). Vitória captura a célula.
- Especiais: ⚡, ✶, ⛨ (⛨ adicionado por FORTIFY ou inicial). Conquistar/Atacar célula com especial pode ter efeitos (atualmente sobrescreve, exceto ⛨).
`;

            const prompt = `
Você é um jogador de IA para o jogo de tabuleiro 'Gridlords'. Seu objetivo é vencer controlando ${GameConstants.VICTORY_CONDITION_CELLS} células no tabuleiro ${gridSize}x${gridSize}.

Seu Símbolo: ${aiPlayer.mark} (Jogador ${aiPlayer.id})
Símbolo do Oponente: ${humanPlayer.mark} (Jogador ${humanPlayer.id})

Estado Atual do Tabuleiro:
${boardString}
Legenda: [ ]=Vazio, [X]=Jogador 0, [O]=Jogador 1, [⚡]=Poder, [✶]=Magia, [⛨]=Escudo

Suas Posições (${aiPlayer.getPositionCount()}): ${aiPositions}
Posições do Oponente (${humanPlayer.getPositionCount()}): ${humanPositions}
Itens Especiais no Tabuleiro: ${specialLocations}

${rulesSummary}

É a sua vez (${aiPlayer.mark}). Escolha sua próxima ação e a coordenada alvo.
As ações possíveis são:
1. CONQUER: Escolha uma célula VAZIA ([ ]) adjacente a uma das suas. Não pode conquistar células com ⚡ ou ✶.
2. FORTIFY: Escolha uma célula que VOCÊ JÁ CONTROLA (${aiPlayer.mark}) para adicionar ou manter um Escudo [⛨]. Não pode fortificar se já tiver [⛨]. Fortificar remove ⚡ ou ✶ se presentes.
3. ATTACK: Escolha uma célula controlada pelo OPONENTE (${humanPlayer.mark}) adjacente a uma das suas.

Analise o estado do jogo, suas posições, as do oponente, os especiais e escolha a MELHOR jogada estratégica para se aproximar da vitória ou defender seu território. Considere adjacência para ataques e conquistas.

Responda APENAS com a ação e a coordenada no formato: ACTION: COORDINATE
Exemplos de resposta VÁLIDA:
CONQUER: B3
ATTACK: D4
FORTIFY: A1

NÃO inclua nenhuma outra palavra, explicação ou saudação na sua resposta. APENAS a ação e coordenada.
Qual a sua jogada?
`;
            return prompt;
        }

        private parseAIResponse(responseText: string): GameTypes.AIMove | null {
             const cleanedResponse = responseText.trim().toUpperCase();
             const match = cleanedResponse.match(/^(CONQUER|FORTIFY|ATTACK):\s?([A-Z][1-9]\d*)$/);

             if (!match) {
                 console.error(`Erro ao parsear resposta da IA: formato inesperado "${cleanedResponse}"`);
                 return null;
             }

             const action = match[1] as GameTypes.AIActionType;
             const coordInput = match[2];
             const coord = GameUtils.parseCoordinateInput(coordInput);

             if (!coord) {
                 console.error(`Erro ao parsear resposta da IA: coordenada inválida "${coordInput}"`);
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
                    console.error(`Erro na API Gemini: ${response.status} ${response.statusText}`, errorBody);
                    return null;
                }

                const data = await response.json() as any;
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (typeof text !== 'string') {
                     console.error('Erro na API Gemini: resposta não contém texto válido.', JSON.stringify(data, null, 2));
                     return null;
                }

                return text;

            } catch (error: any) {
                 if (error.name === 'TimeoutError' || error.name === 'AbortError') { // AbortError for timeout signal
                     console.error('Erro na API Gemini: Timeout da requisição.');
                 } else {
                     console.error('Erro ao chamar a API Gemini:', error);
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
                     console.log(`Tentativa ${attempts + 1} para obter jogada da IA...`);
                }
                const responseText = await this.callGeminiAPI(prompt);

                if (responseText) {
                    const move = this.parseAIResponse(responseText);
                    if (move) {
                        if (move.action === 'FORTIFY' && !aiPlayer.ownsPosition(GameUtils.toCoordinateString(move.coord))) {
                             console.warn(`IA sugeriu FORTIFY em célula não controlada: ${GameUtils.formatCoordForUser(move.coord)}. Tentando novamente...`);
                        }
                        else if (move.action === 'CONQUER' && grid.getCell(move.coord) !== ' ') {
                             console.warn(`IA sugeriu CONQUER em célula não vazia: ${GameUtils.formatCoordForUser(move.coord)}. Tentando novamente...`);
                        }
                        else if (move.action === 'ATTACK' && !humanPlayer.ownsPosition(GameUtils.toCoordinateString(move.coord))) {
                             console.warn(`IA sugeriu ATTACK em célula não inimiga: ${GameUtils.formatCoordForUser(move.coord)}. Tentando novamente...`);
                        }
                        else {
                            return move;
                        }
                    }
                } else {
                    console.error("Falha na comunicação com a API Gemini.");
                    break;
                }
                attempts++;
                await GameUtils.sleep(500);
            }

            console.error("IA falhou em fornecer uma jogada válida após múltiplas tentativas.");
            const validMoves = rules.getValidMoves(aiPlayer, humanPlayer, grid, specials);
            const fallbackMove = GameUtils.getRandomElement(validMoves);
             if (fallbackMove) {
                 console.log("Usando jogada aleatória válida como fallback.");
                 return fallbackMove;
             } else {
                 console.error("Nenhuma jogada válida encontrada para a IA (fallback falhou).");
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
                    this.ui.displayMessage(`Modo Jogador vs IA (${GameConstants.AI_PLAYER_MARK}) selecionado.`);
                 } catch (error: any) {
                     this.ui.displayMessage(`Erro ao inicializar IA: ${error.message}`);
                     return false;
                 }
             } else {
                 this.ui.displayMessage("Modo Jogador vs Jogador selecionado.");
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
                 console.warn("Aviso: Não foi possível colocar todos os especiais iniciais (pouco espaço?).");
            }

            this.ui.clearScreen();
            this.ui.displayMessage("GRIDLORDS - Iniciado!");
            this.ui.displayMessage(`Objetivo: Controle ${GameConstants.VICTORY_CONDITION_CELLS} células.`);
            this.ui.displayMessage("Boa sorte, Lords!\n");
        }

        private claimCell(coord: GameTypes.Coordinate, playerId: GameTypes.PlayerId): void {
            const player = this.players[playerId];
            this.grid.setCell(coord, player.mark);
            player.addPosition(GameUtils.toCoordinateString(coord));

            const coordStr = GameUtils.toCoordinateString(coord);
            if (this.specials[coordStr]) {
                const specialType = this.specials[coordStr];
                if (specialType !== '⛨') {
                    this.ui.displayMessage(`Jogador ${player.mark} capturou ${specialType} em ${GameUtils.formatCoordForUser(coord)}! (Efeito a ser implementado)`);
                    delete this.specials[coordStr];
                } else {
                     this.ui.displayMessage(`Jogador ${player.mark} capturou célula fortificada ${GameUtils.formatCoordForUser(coord)}.`);
                }
            }
        }

        public async startGame(): Promise<void> {
            const initialized = await this.initializeGame();
            if (!initialized) {
                this.ui.displayMessage("Falha ao inicializar o jogo. Encerrando.");
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
                 // Re-render board before each prompt attempt in case of previous error message
                 this.ui.clearScreen();
                 this.ui.renderBoard(this.grid, this.specials);
                 //this.ui.displayMessage(`--- Vez do Jogador ${player.mark} ---`); // Included in promptPlayerMove

                 const move = await this.ui.promptPlayerMove(player.mark);
                 if (!move) {
                     this.ui.displayMessage("Erro inesperado ao processar a jogada. Tente novamente.");
                     await this.ui.askQuestion("Pressione Enter para continuar...");
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
                         // Should not be reached due to prompt validation
                         this.ui.displayMessage("Ação desconhecida recebida.");
                         actionIsValidAndExecuted = false;
                 }

                 if (!actionIsValidAndExecuted) {
                      // Specific error message is already displayed by validateAndExecute methods
                      this.ui.displayMessage("Ação falhou ou inválida.");
                      await this.ui.askQuestion("Pressione Enter para tentar novamente...");
                 }
             }
        }

        private async executeAITurn(aiPlayer: GameInterfaces.IPlayer): Promise<void> {
             this.ui.displayAIThinking();
             const humanPlayer = this.players[aiPlayer.id === 0 ? 1 : 0];

             if (!this.aiLogic) {
                 this.ui.displayAIError("Lógica da IA não está disponível!");
                 return;
             }

             const aiMove = await this.aiLogic.decideMove(aiPlayer, humanPlayer, this.grid, this.specials, this.rules);

             if (!aiMove) {
                 this.ui.displayAIError("Não foi possível determinar a jogada.");
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
                 this.ui.displayAIError(`Jogada sugerida (${aiMove.action}: ${GameUtils.formatCoordForUser(aiMove.coord)}) é inválida no estado atual.`);
                 await GameUtils.sleep(1500);
             }
        }

       private validateAndExecuteConquer(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);

            if (!this.grid.isValidCoordinate(targetCoord)) {
                 this.ui.displayMessage('Erro: Coordenada fora do tabuleiro.');
                 return false;
            }
           const cellState = this.grid.getCell(targetCoord);
           if (cellState !== ' ') {
               this.ui.displayMessage('Erro: Célula não está vazia.');
               return false;
           }
           const isSpecial = !!this.specials[targetCoordStr];
            // Allow conquering empty cells even if they previously held a shield (that was destroyed maybe?)
            // But strictly prevent conquering cells currently holding non-shield specials
           if (isSpecial && this.specials[targetCoordStr] !== '⛨') {
               this.ui.displayMessage(`Erro: Célula contém ${this.specials[targetCoordStr]}. Não pode ser conquistada diretamente.`);
               return false;
           }
            // Also check if a SHIELD icon itself is present (even if cell is ' ') - should not happen often
           if (this.specials[targetCoordStr] === '⛨' && cellState === ' ') {
                this.ui.displayMessage(`Erro: Célula contém um escudo abandonado (⛨). Não pode ser conquistada diretamente.`);
                return false;
           }
           if (!this.rules.isAdjacent(targetCoord, player)) {
               this.ui.displayMessage('Erro: Célula não é adjacente ao seu território.');
               return false;
           }

           this.claimCell(targetCoord, player.id);
           this.ui.displayMessage(`Jogador ${player.mark} conquistou ${GameUtils.formatCoordForUser(targetCoord)}!`);
           return true;
       }

       private validateAndExecuteFortify(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);

            if (!this.grid.isValidCoordinate(targetCoord)) {
                 this.ui.displayMessage('Erro: Coordenada fora do tabuleiro.');
                 return false;
            }
           if (!player.ownsPosition(targetCoordStr)) {
               this.ui.displayMessage('Erro: Você não controla esta célula.');
               return false;
           }
           if (this.specials[targetCoordStr] === '⛨') {
               this.ui.displayMessage('Erro: Esta célula já está fortificada.');
               return false;
           }
           if (this.specials[targetCoordStr]) {
                this.ui.displayMessage(`Aviso: Fortificar removerá o item ${this.specials[targetCoordStr]} existente em ${GameUtils.formatCoordForUser(targetCoord)}.`);
           }

           this.specials[targetCoordStr] = '⛨';
           this.ui.displayMessage(`Jogador ${player.mark} fortificou ${GameUtils.formatCoordForUser(targetCoord)} com ⛨!`);
           return true;
       }

       private validateAndExecuteAttack(player: GameInterfaces.IPlayer, targetCoord: GameTypes.Coordinate): boolean {
           const targetCoordStr = GameUtils.toCoordinateString(targetCoord);
           const opponent = this.players[player.id === 0 ? 1 : 0];

            if (!this.grid.isValidCoordinate(targetCoord)) {
                 this.ui.displayMessage('Erro: Coordenada fora do tabuleiro.');
                 return false;
            }
           if (!opponent.ownsPosition(targetCoordStr)) {
               // Could be empty, could be own cell, could be special icon on empty cell
               const cellState = this.grid.getCell(targetCoord);
               if (player.ownsPosition(targetCoordStr)) {
                    this.ui.displayMessage('Erro: Não pode atacar sua própria célula.');
               } else if (cellState === ' ') {
                    this.ui.displayMessage('Erro: Não pode atacar uma célula vazia.');
               } else {
                    this.ui.displayMessage('Erro: Célula não pertence ao inimigo.'); // Generic fallback
               }
               return false;
           }
           if (!this.rules.isAdjacent(targetCoord, player)) {
               this.ui.displayMessage('Erro: Célula inimiga não é adjacente.');
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
                   this.ui.displayMessage(`Escudo ⛨ em ${GameUtils.formatCoordForUser(targetCoord)} foi destruído!`);
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
     if (!process.env.GEMINI_API_KEY) {
          console.warn("\nAVISO: Variável de ambiente GEMINI_API_KEY não definida.");
          console.warn("O modo de jogo contra IA (PvE) não estará disponível.");
          console.warn("Para jogar contra a IA, configure a chave da API Gemini.\n");
     }

    try {
        const game = new Game.GameController();
        await game.startGame();
    } catch (error) {
        console.error("\n===================================");
        console.error("Ocorreu um erro fatal no jogo:");
        console.error(error);
        console.error("===================================\n");
        process.exit(1);
    }
})();