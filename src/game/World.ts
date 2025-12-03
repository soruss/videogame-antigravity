import type { Vector2 } from './types';

export const TILE_SIZE = 40;

export const TileType = {
    FLOOR: 0,
    WALL: 1,
    CITY_HOUSE_FLOOR: 2,
    INDESTRUCTIBLE_WALL: 3
} as const;

export type TileType = typeof TileType[keyof typeof TileType];

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

        this.generateKowloonMap();
    }

    private generateKowloonMap() {
        // 1. Fill with noise
        for (let x = 0; x < this.width; x++) {
            this.tiles[x] = [];
            this.wallHealth[x] = [];
            for (let y = 0; y < this.height; y++) {
                // 40% chance of wall (Kowloon Density), keep edges as walls
                if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                    this.tiles[x][y] = TileType.INDESTRUCTIBLE_WALL;
                } else {
                    // Density tuned: 0.40 -> 0.43 (Slight increase)
                    this.tiles[x][y] = Math.random() < 0.43 ? TileType.WALL : TileType.FLOOR;
                }
                this.wallHealth[x][y] = 100;
            }
        }

        // 2. Cellular Automata (Smooth out)
        for (let i = 0; i < 5; i++) {
            this.smoothMap();
        }

        // 2.5 Convert some walls to Indestructible (Sprinkle them in)
        for (let x = 1; x < this.width - 1; x++) {
            for (let y = 1; y < this.height - 1; y++) {
                if (this.tiles[x][y] === TileType.WALL) {
                    // 15% chance to become indestructible
                    if (Math.random() < 0.15) {
                        this.tiles[x][y] = TileType.INDESTRUCTIBLE_WALL;
                    }
                }
            }
        }

        // 3. Widen Alleyways (Ensure 2-block wide paths where possible)
        // Simple pass: if a floor tile has < 2 floor neighbors (horizontal/vertical), clear a neighbor
        for (let x = 2; x < this.width - 2; x++) {
            for (let y = 2; y < this.height - 2; y++) {
                if (this.tiles[x][y] === TileType.FLOOR) {
                    // Check orthogonal neighbors
                    let floorNeighbors = 0;
                    if (this.tiles[x + 1][y] === TileType.FLOOR) floorNeighbors++;
                    if (this.tiles[x - 1][y] === TileType.FLOOR) floorNeighbors++;
                    if (this.tiles[x][y + 1] === TileType.FLOOR) floorNeighbors++;
                    if (this.tiles[x][y - 1] === TileType.FLOOR) floorNeighbors++;

                    if (floorNeighbors < 2) {
                        // Too narrow, open up a random neighbor
                        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
                        const dir = dirs[Math.floor(Math.random() * dirs.length)];
                        const nx = x + dir.x;
                        const ny = y + dir.y;
                        if (this.tiles[nx][ny] === TileType.WALL) {
                            this.tiles[nx][ny] = TileType.FLOOR;
                        }
                    }
                }
            }
        }

        // 3. City Center (Open Area)
        const centerX = Math.floor(this.width / 2);
        const centerY = Math.floor(this.height / 2);
        const centerRadius = 5;
        for (let x = centerX - centerRadius; x <= centerX + centerRadius; x++) {
            for (let y = centerY - centerRadius; y <= centerY + centerRadius; y++) {
                if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
                    this.tiles[x][y] = TileType.CITY_HOUSE_FLOOR;
                }
            }
        }

        // Ensure connectivity
        this.ensureConnectivity();
    }

    private smoothMap() {
        const newTiles = JSON.parse(JSON.stringify(this.tiles));
        for (let x = 1; x < this.width - 1; x++) {
            for (let y = 1; y < this.height - 1; y++) {
                let neighbors = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        if (this.tiles[x + dx][y + dy] === TileType.WALL ||
                            this.tiles[x + dx][y + dy] === TileType.INDESTRUCTIBLE_WALL) {
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

    private ensureConnectivity() {
        // Start from center
        const startX = Math.floor(this.width / 2);
        const startY = Math.floor(this.height / 2);
        const queue: { x: number, y: number }[] = [{ x: startX, y: startY }];
        const visited = new Set<string>();
        visited.add(`${startX},${startY}`);

        while (queue.length > 0) {
            const p = queue.shift()!;
            const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
            for (const d of dirs) {
                const nx = p.x + d.x;
                const ny = p.y + d.y;
                if (nx > 0 && nx < this.width - 1 && ny > 0 && ny < this.height - 1) {
                    if (!visited.has(`${nx},${ny}`) && this.tiles[nx][ny] !== TileType.WALL && this.tiles[nx][ny] !== TileType.INDESTRUCTIBLE_WALL) {
                        visited.add(`${nx},${ny}`);
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }

        // Fill isolated pockets
        for (let x = 1; x < this.width - 1; x++) {
            for (let y = 1; y < this.height - 1; y++) {
                if (this.tiles[x][y] === TileType.FLOOR && !visited.has(`${x},${y}`)) {
                    this.tiles[x][y] = TileType.WALL;
                }
            }
        }

        // Ensure Safe Spawn Zone (Top Left) connected to center
        let cx = 5;
        let cy = 5;
        // Simple path carving to center
        while (cx < startX) {
            if (this.tiles[cx][cy] === TileType.WALL) this.tiles[cx][cy] = TileType.FLOOR;
            cx++;
        }
        while (cy < startY) {
            if (this.tiles[cx][cy] === TileType.WALL) this.tiles[cx][cy] = TileType.FLOOR;
            cy++;
        }

        // Clear spawn area
        for (let x = 4; x <= 6; x++) {
            for (let y = 4; y <= 6; y++) {
                this.tiles[x][y] = TileType.FLOOR;
            }
        }
    }

    // BFS Pathfinding
    public findPath(start: { x: number, y: number }, end: { x: number, y: number }): { x: number, y: number }[] | null {
        const startTile = { x: Math.floor(start.x / TILE_SIZE), y: Math.floor(start.y / TILE_SIZE) };
        const endTile = { x: Math.floor(end.x / TILE_SIZE), y: Math.floor(end.y / TILE_SIZE) };

        if (startTile.x === endTile.x && startTile.y === endTile.y) return [];

        const queue: { x: number, y: number }[] = [startTile];
        const cameFrom: Record<string, { x: number, y: number } | null> = {};
        const startKey = `${startTile.x},${startTile.y}`;
        cameFrom[startKey] = null;

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (current.x === endTile.x && current.y === endTile.y) {
                // Reconstruct path
                const path: { x: number, y: number }[] = [];
                let curr: { x: number, y: number } | null | undefined = current;
                while (curr) {
                    const c = curr as { x: number, y: number };
                    path.push({ x: c.x * TILE_SIZE + TILE_SIZE / 2, y: c.y * TILE_SIZE + TILE_SIZE / 2 });
                    const key = `${c.x},${c.y}`;
                    curr = cameFrom[key];
                }
                return path.reverse();
            }

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const next of neighbors) {
                if (next.x >= 0 && next.x < this.width && next.y >= 0 && next.y < this.height) {
                    const tile = this.tiles[next.x][next.y];
                    if (tile !== TileType.WALL && tile !== TileType.INDESTRUCTIBLE_WALL) {
                        const key = `${next.x},${next.y}`;
                        if (!(key in cameFrom)) {
                            cameFrom[key] = current;
                            queue.push(next);
                        }
                    }
                }
            }
        }
        return null; // No path found
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
