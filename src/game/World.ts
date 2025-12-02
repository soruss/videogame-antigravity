import type { Vector2 } from './types';

export const TILE_SIZE = 40;

export enum TileType {
    FLOOR,
    WALL,
    CITY_HOUSE_FLOOR,
    INDESTRUCTIBLE_WALL
}

export class World {
    public width: number;
    public height: number;
    public tiles: TileType[][];
    public wallHealth: number[][]; // Track health for each tile
    public cityHouseRect: { x: number, y: number, w: number, h: number };

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.wallHealth = [];

        // Define City House (Center)
        const houseW = 12;
        const houseH = 8;
        this.cityHouseRect = {
            x: Math.floor(width / 2 - houseW / 2),
            y: Math.floor(height / 2 - houseH / 2),
            w: houseW,
            h: houseH
        };

        this.generateMap();
    }

    private generateMap() {
        // Initialize with Walls
        for (let x = 0; x < this.width; x++) {
            this.tiles[x] = [];
            this.wallHealth[x] = [];
            for (let y = 0; y < this.height; y++) {
                this.tiles[x][y] = TileType.WALL;
                this.wallHealth[x][y] = 5; // Default Wall HP
            }
        }

        // Random Floor Seeds
        for (let x = 1; x < this.width - 1; x++) {
            for (let y = 1; y < this.height - 1; y++) {
                if (Math.random() > 0.6) {
                    this.tiles[x][y] = TileType.FLOOR;
                }
            }
        }

        // Cellular Automata Smoothing (4 passes)
        for (let i = 0; i < 4; i++) {
            const newTiles = JSON.parse(JSON.stringify(this.tiles));
            for (let x = 1; x < this.width - 1; x++) {
                for (let y = 1; y < this.height - 1; y++) {
                    let neighbors = 0;
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            if (this.tiles[x + dx][y + dy] === TileType.WALL) {
                                neighbors++;
                            }
                        }
                    }

                    if (neighbors > 4) {
                        newTiles[x][y] = TileType.WALL;
                    } else if (neighbors < 4) {
                        newTiles[x][y] = TileType.FLOOR;
                    }
                }
            }
            this.tiles = newTiles;
        }

        // Clear Center for City House
        for (let x = this.cityHouseRect.x - 2; x < this.cityHouseRect.x + this.cityHouseRect.w + 2; x++) {
            for (let y = this.cityHouseRect.y - 2; y < this.cityHouseRect.y + this.cityHouseRect.h + 2; y++) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    this.tiles[x][y] = TileType.FLOOR; // Open space around house
                }
            }
        }

        // Build City House (Floor only, no walls to allow phasing)
        for (let x = this.cityHouseRect.x; x < this.cityHouseRect.x + this.cityHouseRect.w; x++) {
            for (let y = this.cityHouseRect.y; y < this.cityHouseRect.y + this.cityHouseRect.h; y++) {
                this.tiles[x][y] = TileType.CITY_HOUSE_FLOOR;
            }
        }

        // Ensure Safe Spawn Zone (Top Left)
        for (let x = 4; x <= 6; x++) {
            for (let y = 4; y <= 6; y++) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    this.tiles[x][y] = TileType.FLOOR;
                }
            }
        }
    }

    public getTile(x: number, y: number): TileType {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TileType.WALL;
        return this.tiles[x][y];
    }

    public isInsideHouse(x: number, y: number): boolean {
        const tx = Math.floor(x / TILE_SIZE);
        const ty = Math.floor(y / TILE_SIZE);
        return tx > this.cityHouseRect.x && tx < this.cityHouseRect.x + this.cityHouseRect.w - 1 &&
            ty > this.cityHouseRect.y && ty < this.cityHouseRect.y + this.cityHouseRect.h - 1;
    }

    public damageWall(x: number, y: number, amount: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        if (this.tiles[x][y] !== TileType.WALL) return; // Indestructible walls are ignored here

        this.wallHealth[x][y] -= amount;
        if (this.wallHealth[x][y] <= 0) {
            this.tiles[x][y] = TileType.FLOOR;
            // Optional: Spawn debris particle?
        }
    }

    public checkCollision(pos: Vector2, radius: number): { push: Vector2, normal: Vector2 } | null {
        let pushX = 0;
        let pushY = 0;
        let normalX = 0;
        let normalY = 0;
        let collided = false;

        const tileX = Math.floor(pos.x / TILE_SIZE);
        const tileY = Math.floor(pos.y / TILE_SIZE);

        // Check 3x3 neighbors
        for (let x = tileX - 1; x <= tileX + 1; x++) {
            for (let y = tileY - 1; y <= tileY + 1; y++) {
                const tile = this.getTile(x, y);
                if (tile === TileType.WALL || tile === TileType.INDESTRUCTIBLE_WALL) {
                    const wallRect = {
                        x: x * TILE_SIZE,
                        y: y * TILE_SIZE,
                        w: TILE_SIZE,
                        h: TILE_SIZE
                    };

                    // Circle vs AABB
                    const closestX = Math.max(wallRect.x, Math.min(pos.x, wallRect.x + wallRect.w));
                    const closestY = Math.max(wallRect.y, Math.min(pos.y, wallRect.y + wallRect.h));

                    const dx = pos.x - closestX;
                    const dy = pos.y - closestY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < radius) {
                        collided = true;
                        const overlap = radius - distance;
                        if (distance > 0) {
                            const nx = dx / distance;
                            const ny = dy / distance;
                            pushX += nx * overlap;
                            pushY += ny * overlap;
                            normalX += nx;
                            normalY += ny;
                        } else {
                            // Center is inside wall
                            pushX += overlap;
                        }
                    }
                }
            }
        }

        if (collided) {
            // Normalize normal vector
            const len = Math.sqrt(normalX * normalX + normalY * normalY);
            if (len > 0) {
                normalX /= len;
                normalY /= len;
            }
            return { push: { x: pushX, y: pushY }, normal: { x: normalX, y: normalY } };
        }
        return null;
    }

    public render(ctx: CanvasRenderingContext2D, camera: Vector2, viewW: number, viewH: number) {
        const startX = Math.floor(camera.x / TILE_SIZE);
        const endX = Math.floor((camera.x + viewW) / TILE_SIZE) + 1;
        const startY = Math.floor(camera.y / TILE_SIZE);
        const endY = Math.floor((camera.y + viewH) / TILE_SIZE) + 1;

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const tile = this.getTile(x, y);
                const drawX = x * TILE_SIZE;
                const drawY = y * TILE_SIZE;

                if (tile === TileType.WALL) {
                    ctx.fillStyle = '#1a1a1a'; // Very Dark Gray Walls
                    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
                    // 3D effect (top highlight)
                    ctx.fillStyle = '#333';
                    ctx.fillRect(drawX, drawY, TILE_SIZE, 4);

                } else if (tile === TileType.INDESTRUCTIBLE_WALL) {
                    ctx.fillStyle = '#000000'; // Pure Black
                    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);

                    // Cross pattern
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(drawX, drawY);
                    ctx.lineTo(drawX + TILE_SIZE, drawY + TILE_SIZE);
                    ctx.moveTo(drawX + TILE_SIZE, drawY);
                    ctx.lineTo(drawX, drawY + TILE_SIZE);
                    ctx.stroke();

                } else if (tile === TileType.CITY_HOUSE_FLOOR) {
                    ctx.fillStyle = '#4a3c31'; // Brown Floor
                    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
                } else {
                    ctx.fillStyle = '#555'; // Lighter Gray Floor
                    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}
