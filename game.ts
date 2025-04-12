// ô ăn quan 4 người chơi
const NUM_PLAYERS = 2;
const PER_PLAYER_TILES = 6; // 6 tiles for each player

// this info will be used for human player only
type Info = {
    index: number;
    clockwise: boolean;
}

// abstract class Agent
abstract class Agent {
    public capturedO: number = 0;
    public capturedQuan: number = 0;
    constructor(public id: number, public startTile: number, public endTile: number) {}
    prepare(board: Board): void {
        // check if all tiles from startTile to endTile are empty
        if (!board.tiles.slice(this.startTile, this.endTile).every((tile) => tile.getNumO() === 0)) {
            return;
        }
        for (let i = this.startTile; i < this.endTile; i++) {
            if (this.capturedO > 0) {
                board.tiles[i].setNumO(() => 1);
                this.capturedO -= 1;
            }
        }
    }
    score(): number {
        return this.capturedO + this.capturedQuan * 10;
    }
    abstract play(game: Game, info?: Info): void;
}

class Human extends Agent {
    play(game: Game, info: Info): void {
        // Implementation for human player
        super.prepare(game.board);
        // Human logic to play the game
        if (!(this.startTile <= info.index && info.index <= this.endTile) || game.board.tiles[info.index].getNumO() === 0) {
            // TODO: might raise error here
            return;
        }
        const {index, clockwise} = info;
        const captureResult = game.board.move(index, clockwise);
        this.capturedO += captureResult.O;
        this.capturedQuan += captureResult.Quan;
    }
}

class AI extends Agent {
    play(game: Game): void {
        // Implementation for AI player
        super.prepare(game.board);
        // AI logic to play the game
        // random number from startTile to endTile
        const index = Math.floor(Math.random() * (this.endTile - this.startTile + 1)) + this.startTile;
        // random boolean
        const clockwise = Math.random() < 0.5;
        const captureResult = game.board.move(index, clockwise);
        this.capturedO += captureResult.O;
        this.capturedQuan += captureResult.Quan;
    }
}

class Tile {
    constructor(public numO: number, public numQuan: number) {}
    getNumO(): number {
        return this.numO;
    }
    getNumQuan(): number {
        return this.numQuan;
    }
    setNumO(callback: (numO: number) => number): void {
        this.numO = callback(this.numO);
    }
    setNumQuan(callback: (numQuan: number) => number): void {
        this.numQuan = callback(this.numQuan);
    }
    getPoint(): number {
        return this.numO + this.numQuan * 10;
    }
}

class Board {
    public tiles: Tile[];
    constructor() {
        const numTiles = NUM_PLAYERS * PER_PLAYER_TILES;
        this.tiles = Array.from({ length: numTiles }, () => new Tile(0, 0));
        // divisible by 6 => 1 Quan
        for (let i = 0; i < numTiles; i++) {
            if (i % PER_PLAYER_TILES === 0) {
                this.tiles[i].setNumQuan(() => 1);
            } else {
                this.tiles[i].setNumO(() => 5);
            }
        }
    }
    getSections(): number[] {
        const sections: number[] = [];
        for (let i = 0; i < NUM_PLAYERS; i++) {
            sections.push(i * PER_PLAYER_TILES + 1);
            sections.push((i + 1) * PER_PLAYER_TILES - 1);
        }
        return sections;
    }
    move(index: number, clockwise: boolean): {O: number, Quan: number} {
        let moving = true;
        while (moving) {
            let numO = this.tiles[index].getNumO();
            this.tiles[index].setNumO(() => 0); // set current tile to 0
            const offset = clockwise ? 1 : -1;

            // moving
            while (numO > 0) {
                index = (index + offset + this.tiles.length) % this.tiles.length;
                this.tiles[index].setNumO((num) => num + 1);
                numO -= 1;
            }

            if (index % PER_PLAYER_TILES === 0 || index % PER_PLAYER_TILES === 5) {
                // end move because we reach the end
                moving = false;
            } else if (this.tiles[(index + offset + this.tiles.length) % this.tiles.length].getPoint() === 0) {
                // the next tile is empty => capture the next next tile
                const nextIndex = (index + offset + this.tiles.length) % this.tiles.length;
                const nextNextIndex = (nextIndex + offset + this.tiles.length) % this.tiles.length;
                const nextNextTile = this.tiles[nextNextIndex];
                const captureResult = {O: nextNextTile.getNumO(), Quan: nextNextTile.getNumQuan()};
                this.tiles[nextIndex].setNumO(() => 0);
                this.tiles[nextIndex].setNumQuan(() => 0);
                return captureResult;
            } else {
                // move the next tile
                index = (index + offset + this.tiles.length) % this.tiles.length;
            }
        }
        return {O: 0, Quan: 0};
    }
}

export class Game {
    public static idCounter: number = 0;
    public id: number;
    public playerNum: number = NUM_PLAYERS;
    public players: Agent[] = [];
    public currPlayer: number = 0;
    public updateCallbacks: (() => void)[] = [];
    public endCallbacks: (() => void)[] = [];
    public board: Board;
    constructor(public isAgainstAI: boolean = false) {
        this.id = Game.idCounter++;
        this.board = new Board();
        for (let i = 0; i < NUM_PLAYERS - 1 && isAgainstAI; i++) {
            const playerId = this.players.length;
            this.players.push(new AI(playerId, playerId * PER_PLAYER_TILES + 1, playerId * PER_PLAYER_TILES + PER_PLAYER_TILES - 1));
        }
    }
    addHumanPlayer(): number {
        const playerId = this.players.length;
        this.players.push(new Human(playerId, playerId * PER_PLAYER_TILES + 1, playerId * PER_PLAYER_TILES + PER_PLAYER_TILES - 1));
        return playerId;
    }
    onUpdate(callback: () => void) {
        this.updateCallbacks.push(callback);
    }
    onEnd(callback: () => void) {
        this.endCallbacks.push(callback);
    }
    move(playerId: number, info: Info): void {
        if (this.isEnded()) {
            return;
        }
        if (playerId !== this.currPlayer) {
            return;
        }
        const player = this.players[playerId];
        player.play(this, info);
        this.currPlayer = (this.currPlayer + 1) % this.players.length;

        // check if the game is ended
        if (this.isEnded()) {
            this.cleanup();
            for (const callback of this.endCallbacks) {
                callback();
            }
        } else {
            for (const callback of this.updateCallbacks) {
                callback();
            }
        }
    }
    isFull(): boolean {
        return this.players.length >= NUM_PLAYERS;
    }
    isEnded(): boolean {
        // check if all players have no O left
        return this.board.tiles.every((tile) => tile.getNumQuan() === 0);
    }
    // run after game ended, meaning no Quan left on the board
    // player will get all O left on the board
    cleanup(): void {
        for (const player of this.players) {
            const startTile = player.startTile;
            const endTile = player.endTile;
            for (let i = startTile; i <= endTile; i++) {
                const tile = this.board.tiles[i];
                player.capturedO += tile.getNumO();
                tile.setNumO(() => 0);
            }

        }
    }
}
const g = new Game()
const p1 = new Human(0, 1, 5)
p1.play(g, {index: 3, clockwise: true})
console.log(g.board.tiles)
console.log(p1.capturedO, p1.capturedQuan)