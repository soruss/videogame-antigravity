import { World, TILE_SIZE, TileType } from './World';
import { Player, Bullet, Loot, WEAPONS, WeaponType, Explosion, Particle, Potion } from './Entities';
import { Input } from './Input';

export const GameState = {
    COUNTDOWN: 0,
    PLAYING: 1,
    GAME_OVER: 2
} as const;

export type GameState = typeof GameState[keyof typeof GameState];

export interface UIState {
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
    ammo: number;
    maxAmmo: number;
    weapon: string | null;
    isReloading: boolean;
    dashCooldown: number;
    dashReady: boolean;
    dashTimeRemaining: number;
    aliveCount: number;
    elapsedTime: number;
}



export class Engine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private world: World;
    public player: Player; // Public for App.tsx access if needed, but getUIState is better
    private npcs: Player[] = [];
    private bullets: Bullet[] = [];
    private loot: Loot[] = [];
    private potions: Potion[] = [];
    private explosions: Explosion[] = [];
    private particles: Particle[] = [];
    private input: Input;
    private lastTime: number = 0;
    private camera: { x: number, y: number } = { x: 0, y: 0 };
    private viewW: number;
    private viewH: number;
    private zoom: number = 1; // Default Zoom
    public isMobile: boolean = false; // Mobile Detection
    private touchShootTarget: { x: number, y: number } | null = null; // For Mobile Auto-Fire
    private animationId: number | null = null;

    // Stopwatch
    private gameStartTime: number = 0;
    private gameEndTime: number | null = null;

    public onGameStateChange?: (state: GameState) => void;
    public onWinner?: (winner: string) => void;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.input = new Input(); // Fixed: No arguments
        this.world = new World(50, 50); // 50x50 tiles
        this.viewW = this.canvas.width;
        this.viewH = this.canvas.height;
        this.resize(); // Will overwrite with zoomed values

        // Spawn Player in Safe Zone
        this.player = new Player(5 * TILE_SIZE + TILE_SIZE / 2, 5 * TILE_SIZE + TILE_SIZE / 2);

        // Give Starting Weapon (None - Unarmed)
        this.player.weapon = null;
        this.player.currentAmmo = 0;
        this.player.maxAmmo = 0;

        // Initial Loot
        this.spawnLoot();
        this.spawnPotions();

        // Initial NPCs
        this.spawnNPCs(15);
    }

    public start() {
        if (!this.animationId) {
            this.lastTime = performance.now();
            this.gameStartTime = this.lastTime;
            this.gameEndTime = null;
            this.loop(this.lastTime);
            if (this.onGameStateChange) this.onGameStateChange(GameState.PLAYING);
        }
    }

    public cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public getUIState(): UIState {
        const now = performance.now() / 1000;
        const dashReady = now - this.player.lastDashTime >= this.player.dashCooldown;
        const dashTimeRemaining = Math.max(0, this.player.dashCooldown - (now - this.player.lastDashTime));

        return {
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            shield: this.player.shield,
            maxShield: this.player.maxShield,
            ammo: this.player.currentAmmo,
            maxAmmo: this.player.maxAmmo,
            weapon: this.player.weapon,
            isReloading: this.player.isReloading,
            dashCooldown: this.player.dashCooldown,
            dashReady: dashReady,
            dashTimeRemaining: dashTimeRemaining,
            aliveCount: this.npcs.length + (this.player.isDead ? 0 : 1),
            elapsedTime: this.gameEndTime ? (this.gameEndTime - this.gameStartTime) : (performance.now() - this.gameStartTime)
        };
    }

    public setJoystick(x: number, y: number) {
        if (x === 0 && y === 0) {
            this.input.joystick = null;
        } else {
            this.input.joystick = { x, y };
        }
    }

    public setTouchShootTarget(x: number | null, y: number | null) {
        if (x === null || y === null) {
            this.touchShootTarget = null;
        } else {
            this.touchShootTarget = { x, y };
        }
    }

    public triggerDash() {
        if (this.player.dash()) {
            this.spawnDashParticles(this.player);
        }
    }

    public handleTouchShoot(clientX: number, clientY: number) {
        // Calculate world position from screen tap (Account for Zoom and Canvas Offset)
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Apply Zoom and Camera
        const worldX = (canvasX / this.zoom) + this.camera.x;
        const worldY = (canvasY / this.zoom) + this.camera.y;

        // Aim at tap
        const dx = worldX - this.player.position.x;
        const dy = worldY - this.player.position.y;
        this.player.rotation = Math.atan2(dy, dx);

        // Shoot
        const newBullets = this.player.shoot();
        if (newBullets) {
            this.bullets.push(...newBullets);
        }
    }

    public triggerRestart() {
        if (this.player.isDead || this.npcs.length === 0) {
            this.reset();
        }
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Mobile Zoom Logic (Zoom out 20% on small screens)
        if (window.innerWidth < 768) {
            this.zoom = 0.8;
            this.isMobile = true;
        } else {
            this.zoom = 1;
            this.isMobile = false;
        }

        this.viewW = this.canvas.width / this.zoom;
        this.viewH = this.canvas.height / this.zoom;
    }

    private spawnLoot() {
        for (let i = 0; i < 18; i++) {
            const pos = this.findValidSpawnPosition([], 0);
            if (pos) {
                const weapons = Object.values(WeaponType);
                const weapon = weapons[Math.floor(Math.random() * weapons.length)];
                this.loot.push(new Loot(pos.x, pos.y, weapon));
            }
        }
    }

    private spawnPotions() {
        for (let i = 0; i < 4; i++) {
            const pos = this.findValidSpawnPosition([], 0);
            if (pos) {
                this.potions.push(new Potion(pos.x, pos.y));
            }
        }
    }

    private spawnNPCs(count: number) {
        for (let i = 0; i < count; i++) {
            // Avoid existing NPCs and Player
            const avoid = [this.player, ...this.npcs];
            const pos = this.findValidSpawnPosition(avoid, 5 * TILE_SIZE); // 5 tiles distance
            if (pos) {
                const npc = new Player(pos.x, pos.y, true);
                // NPCs start unarmed
                npc.weapon = null;
                npc.currentAmmo = 0;
                npc.maxAmmo = 0;
                this.npcs.push(npc);
            }
        }
    }

    private findValidSpawnPosition(avoidEntities: { position: { x: number, y: number } }[] = [], minDist: number = 0): { x: number, y: number } | null {
        for (let i = 0; i < 100; i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(Math.random() * this.world.height);

            // Check Wall
            if (this.world.getTile(x, y) !== TileType.FLOOR) continue;

            const worldX = x * TILE_SIZE + TILE_SIZE / 2;
            const worldY = y * TILE_SIZE + TILE_SIZE / 2;

            // Check Distance
            let valid = true;
            for (const entity of avoidEntities) {
                const dist = Math.sqrt((worldX - entity.position.x) ** 2 + (worldY - entity.position.y) ** 2);
                if (dist < minDist) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                return { x: worldX, y: worldY };
            }
        }
        return null;
    }

    private reset() {
        this.world = new World(50, 50);
        this.player = new Player(5 * TILE_SIZE + TILE_SIZE / 2, 5 * TILE_SIZE + TILE_SIZE / 2);

        // Reset with No Weapon
        this.player.weapon = null;
        this.player.currentAmmo = 0;
        this.player.maxAmmo = 0;

        this.npcs = [];
        this.bullets = [];
        this.loot = [];
        this.potions = [];
        this.explosions = [];
        this.particles = [];
        this.spawnLoot();
        this.spawnLoot();
        this.spawnPotions();
        this.spawnNPCs(15);
        this.gameStartTime = performance.now();
        this.gameEndTime = null;
        if (this.onGameStateChange) this.onGameStateChange(GameState.PLAYING);
    }

    private loop(time: number) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.update(dt);
        this.render();

        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    private update(dt: number) {
        // Global Restart (R) - Works in Game Over or Victory
        if (this.input.keys['KeyR']) {
            if (this.player.isDead || this.npcs.length === 0) {
                this.reset();
                return;
            }
        }

        if (this.player.isDead) {
            return;
        }

        // Player Input
        // Reload
        if (this.input.keys['KeyR']) {
            this.player.reload();
        }
        // Dash
        if (this.input.keys['Space']) {
            if (this.player.dash()) {
                this.spawnDashParticles(this.player);
            }
        }

        // Drop Weapon (Q)
        if (this.input.keys['KeyQ'] && !this.player.dropRequested) {
            this.player.dropRequested = true;
            if (this.player.weapon) {
                // Throw forward
                const throwDist = 50;
                const dropX = this.player.position.x + Math.cos(this.player.rotation) * throwDist;
                const dropY = this.player.position.y + Math.sin(this.player.rotation) * throwDist;

                // Ensure drop is within bounds
                const safeX = Math.max(TILE_SIZE, Math.min(dropX, this.world.width * TILE_SIZE - TILE_SIZE));
                const safeY = Math.max(TILE_SIZE, Math.min(dropY, this.world.height * TILE_SIZE - TILE_SIZE));

                this.loot.push(new Loot(safeX, safeY, this.player.weapon));
                this.player.weapon = null;
            }
        } else if (!this.input.keys['KeyQ']) {
            this.player.dropRequested = false;
        }

        this.player.update(dt, this.world, this.input, this.camera);

        // Camera Follow
        this.camera.x = this.player.position.x - this.viewW / 2;
        this.camera.y = this.player.position.y - this.viewH / 2;

        // Player Shooting
        // Player Shooting
        if (this.input.mouseDown) {
            const newBullets = this.player.shoot();
            if (newBullets) {
                this.bullets.push(...newBullets);
            }
        }

        // Mobile Auto-Fire
        if (this.touchShootTarget) {
            // Calculate world position from screen tap (Account for Zoom and Canvas Offset)
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = this.touchShootTarget.x - rect.left;
            const canvasY = this.touchShootTarget.y - rect.top;

            // Apply Zoom and Camera
            const worldX = (canvasX / this.zoom) + this.camera.x;
            const worldY = (canvasY / this.zoom) + this.camera.y;

            // Aim at tap
            const dx = worldX - this.player.position.x;
            const dy = worldY - this.player.position.y;
            this.player.rotation = Math.atan2(dy, dx);

            // Shoot
            const newBullets = this.player.shoot();
            if (newBullets) {
                this.bullets.push(...newBullets);
            }
        }

        // NPCs
        const allPlayers = [this.player, ...this.npcs];
        this.npcs.forEach(npc => {
            // AI Logic
            const newBullets = npc.updateAI(dt, this.world, this.loot, allPlayers, this.isMobile);
            if (newBullets) {
                this.bullets.push(...newBullets);
            }

            npc.update(dt, this.world);
        });

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(dt);

            // Wall Collision
            const tileX = Math.floor(b.position.x / TILE_SIZE);
            const tileY = Math.floor(b.position.y / TILE_SIZE);
            const tile = this.world.getTile(tileX, tileY);

            if (tile === TileType.WALL || tile === TileType.INDESTRUCTIBLE_WALL) {
                b.active = false;
                // Wall Damage
                if (tile === TileType.WALL) {
                    this.world.damageWall(tileX, tileY, b.damage);
                }

                if (b.isRocket) {
                    this.explosions.push(new Explosion(b.position.x, b.position.y, b.owner));
                }
            }

            // Entity Collision
            // Check Player
            if (b.owner !== this.player) {
                const dist = Math.sqrt((b.position.x - this.player.position.x) ** 2 + (b.position.y - this.player.position.y) ** 2);
                if (dist < this.player.radius + b.radius) {
                    b.active = false;
                    this.damageEntity(this.player, b.damage, b.owner);
                    if (b.isRocket) this.explosions.push(new Explosion(b.position.x, b.position.y, b.owner));
                }
            }

            // Check NPCs
            this.npcs.forEach(npc => {
                if (b.owner !== npc) {
                    const dist = Math.sqrt((b.position.x - npc.position.x) ** 2 + (b.position.y - npc.position.y) ** 2);
                    if (dist < npc.radius + b.radius) {
                        b.active = false;
                        this.damageEntity(npc, b.damage, b.owner);
                        if (b.isRocket) this.explosions.push(new Explosion(b.position.x, b.position.y, b.owner));
                    }
                }
            });
        }
        this.bullets = this.bullets.filter(b => b.active);

        // Explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.update(dt);

            // Damage Logic (Apply once)
            if (exp.timeElapsed < dt * 1.5) {
                // Check Player
                const pDist = Math.sqrt((exp.position.x - this.player.position.x) ** 2 + (exp.position.y - this.player.position.y) ** 2);
                if (pDist < exp.maxRadius) {
                    this.damageEntity(this.player, 100 * (1 - pDist / exp.maxRadius), exp.owner);
                }

                // Check NPCs
                this.npcs.forEach(npc => {
                    const nDist = Math.sqrt((exp.position.x - npc.position.x) ** 2 + (exp.position.y - npc.position.y) ** 2);
                    if (nDist < exp.maxRadius) {
                        this.damageEntity(npc, 100 * (1 - nDist / exp.maxRadius), exp.owner);
                    }
                });

                // Wall Damage
                const ex = Math.floor(exp.position.x / TILE_SIZE);
                const ey = Math.floor(exp.position.y / TILE_SIZE);
                const range = Math.ceil(exp.maxRadius / TILE_SIZE);
                for (let dx = -range; dx <= range; dx++) {
                    for (let dy = -range; dy <= range; dy++) {
                        this.world.damageWall(ex + dx, ey + dy, 50);
                    }
                }
            }
        }
        this.explosions = this.explosions.filter(e => e.active);

        // Loot
        this.loot.forEach(l => {
            if (l.active) {
                const dist = Math.sqrt((l.position.x - this.player.position.x) ** 2 + (l.position.y - this.player.position.y) ** 2);
                if (dist < this.player.radius + l.radius) {
                    // Pick up ONLY if unarmed
                    if (!this.player.weapon) {
                        this.player.weapon = l.weapon;
                        this.player.currentAmmo = WEAPONS[l.weapon].magSize;
                        this.player.maxAmmo = WEAPONS[l.weapon].magSize;
                        l.active = false;
                    }
                }

                // NPCs pick up loot too!
                this.npcs.forEach(npc => {
                    const dist = Math.sqrt((l.position.x - npc.position.x) ** 2 + (l.position.y - npc.position.y) ** 2);
                    if (dist < npc.radius + l.radius) {
                        if (!npc.weapon) {
                            npc.weapon = l.weapon;
                            npc.currentAmmo = WEAPONS[l.weapon].magSize;
                            npc.maxAmmo = WEAPONS[l.weapon].magSize;
                            npc.weaponPickupTime = performance.now() / 1000; // Record pickup time
                            l.active = false;
                        }
                    }
                });
            }
        });
        this.loot = this.loot.filter(l => l.active);

        // Potions
        this.potions.forEach(p => {
            if (p.active) {
                const dist = Math.sqrt((p.position.x - this.player.position.x) ** 2 + (p.position.y - this.player.position.y) ** 2);
                if (dist < this.player.radius + p.radius) {
                    // Consume Potion
                    p.active = false;
                    const healAmount = 50;
                    const missingHealth = this.player.maxHealth - this.player.health;

                    if (healAmount > missingHealth) {
                        this.player.health = this.player.maxHealth;
                        const overflow = healAmount - missingHealth;
                        this.player.shield = Math.min(this.player.maxShield, this.player.shield + overflow);
                    } else {
                        this.player.health += healAmount;
                    }
                }
            }
        });
        this.potions = this.potions.filter(p => p.active);

        // Particles
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        // Cleanup Dead NPCs
        this.npcs = this.npcs.filter(n => !n.isDead);

        // Check Victory
        if (this.npcs.length === 0 && !this.player.isDead) {
            if (!this.gameEndTime) this.gameEndTime = performance.now();
            if (this.onWinner) this.onWinner('Player');
            if (this.onGameStateChange) this.onGameStateChange(GameState.GAME_OVER);
        }

        // Regen
        if (performance.now() / 1000 - this.player.lastDamageTime > 5) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 2);
        }
    }

    private damageEntity(entity: Player, amount: number, dealer: Player | null) {
        entity.lastDamageTime = performance.now() / 1000;

        // Shield Absorb
        if (entity.shield > 0) {
            if (entity.shield >= amount) {
                entity.shield -= amount;
                return;
            } else {
                amount -= entity.shield;
                entity.shield = 0;
            }
        }

        entity.health -= amount;
        if (entity.health <= 0) {
            if (entity.isDead) return;
            entity.isDead = true;
            this.spawnBlood(entity.position.x, entity.position.y);

            // Siphon (if player killed npc)
            // CHECK: dealer === this.player
            if (entity.isNPC && !this.player.isDead && !entity.siphoned && dealer === this.player) {
                entity.siphoned = true;
                const healAmount = 30;
                const missingHealth = this.player.maxHealth - this.player.health;

                if (healAmount > missingHealth) {
                    this.player.health = this.player.maxHealth;
                    const overflow = healAmount - missingHealth;
                    this.player.shield = Math.min(50, this.player.shield + overflow);
                } else {
                    this.player.health += healAmount;
                }
            } else if (!entity.isNPC) {
                // Player Died
                if (!this.gameEndTime) this.gameEndTime = performance.now();
                if (this.onGameStateChange) this.onGameStateChange(GameState.GAME_OVER);
                if (this.onWinner) this.onWinner('GAME OVER');
            }
        }
    }

    private spawnBlood(x: number, y: number) {
        for (let i = 0; i < 40; i++) {
            this.particles.push(new Particle(x, y, '#FF0000'));
        }
    }

    private spawnDashParticles(player: Player) {
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(player.position.x, player.position.y, '#FFFFFF'));
        }
    }

    private render() {
        // Clear
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        // Apply Zoom
        this.ctx.scale(this.zoom, this.zoom);
        // Camera Transform
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // World
        this.world.render(this.ctx, this.camera, this.viewW, this.viewH);

        // Loot
        this.loot.forEach(l => l.render(this.ctx, this.camera));

        // Potions
        this.potions.forEach(p => p.render(this.ctx, this.camera));

        // NPCs
        this.npcs.forEach(n => n.render(this.ctx, this.camera));

        // Player
        this.player.render(this.ctx, this.camera);

        // Bullets
        this.bullets.forEach(b => b.render(this.ctx, this.camera));

        // Explosions
        this.explosions.forEach(e => e.render(this.ctx, this.camera));

        // Particles
        this.particles.forEach(p => p.render(this.ctx, this.camera));

        this.ctx.restore();

        // UI Removed: handled by React
    }
}
