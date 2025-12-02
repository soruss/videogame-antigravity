import { World, TILE_SIZE, TileType } from './World';
import { Player, Bullet, Loot, WEAPONS, WeaponType, Explosion, Particle } from './Entities';
import { Input } from './Input';

export enum GameState {
    COUNTDOWN,
    PLAYING,
    GAME_OVER
}

export class Engine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private world: World;
    private player: Player;
    private npcs: Player[] = [];
    private bullets: Bullet[] = [];
    private loot: Loot[] = [];
    private explosions: Explosion[] = [];
    private particles: Particle[] = [];
    private input: Input;
    private lastTime: number = 0;
    private camera: { x: number, y: number } = { x: 0, y: 0 };
    private viewW: number;
    private viewH: number;
    private animationId: number | null = null;

    public onGameStateChange?: (state: GameState) => void;
    public onWinner?: (winner: string) => void;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.input = new Input(this.canvas);
        this.world = new World(50, 50); // 50x50 tiles
        this.viewW = this.canvas.width;
        this.viewH = this.canvas.height;

        // Spawn Player in Safe Zone
        this.player = new Player(5 * TILE_SIZE + TILE_SIZE / 2, 5 * TILE_SIZE + TILE_SIZE / 2);

        // Initial Loot
        this.spawnLoot();

        // Initial NPCs
        this.spawnNPCs(5);
    }

    public start() {
        if (!this.animationId) {
            this.lastTime = performance.now();
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

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.viewW = this.canvas.width;
        this.viewH = this.canvas.height;
    }

    private spawnLoot() {
        for (let i = 0; i < 10; i++) {
            const pos = this.findValidSpawnPosition();
            if (pos) {
                const weapons = Object.values(WeaponType);
                const weapon = weapons[Math.floor(Math.random() * weapons.length)];
                this.loot.push(new Loot(pos.x, pos.y, weapon));
            }
        }
    }

    private spawnNPCs(count: number) {
        for (let i = 0; i < count; i++) {
            const pos = this.findValidSpawnPosition();
            if (pos) {
                const npc = new Player(pos.x, pos.y, true);
                // Give NPC random weapon
                const weapons = Object.values(WeaponType);
                const weapon = weapons[Math.floor(Math.random() * weapons.length)];
                npc.weapon = weapon;
                npc.currentAmmo = WEAPONS[weapon].magSize;
                npc.maxAmmo = WEAPONS[weapon].magSize;
                this.npcs.push(npc);
            }
        }
    }

    private findValidSpawnPosition(): { x: number, y: number } | null {
        for (let i = 0; i < 100; i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(Math.random() * this.world.height);
            if (this.world.getTile(x, y) === TileType.FLOOR) {
                return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
            }
        }
        return null;
    }

    private reset() {
        this.world = new World(50, 50);
        this.player = new Player(5 * TILE_SIZE + TILE_SIZE / 2, 5 * TILE_SIZE + TILE_SIZE / 2);
        this.npcs = [];
        this.bullets = [];
        this.loot = [];
        this.explosions = [];
        this.particles = [];
        this.spawnLoot();
        this.spawnNPCs(5);
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
        if (this.player.isDead) {
            // Restart with 'R' to match UI
            if (this.input.keys['KeyR']) {
                this.reset();
            }
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

        // Drop Weapon (G)
        if (this.input.keys['KeyG'] && !this.player.dropRequested) {
            this.player.dropRequested = true;
            if (this.player.weapon) {
                this.loot.push(new Loot(this.player.position.x, this.player.position.y, this.player.weapon));
                this.player.weapon = null;
            }
        } else if (!this.input.keys['KeyG']) {
            this.player.dropRequested = false;
        }

        this.player.update(dt, this.world, this.input, this.camera);

        // Camera Follow
        this.camera.x = this.player.position.x - this.viewW / 2;
        this.camera.y = this.player.position.y - this.viewH / 2;

        // Player Shooting
        if (this.input.mouse.left) {
            const newBullets = this.player.shoot();
            if (newBullets) {
                this.bullets.push(...newBullets);
            }
        }

        // NPCs
        this.npcs.forEach(npc => {
            // Simple AI
            const dist = Math.sqrt((this.player.position.x - npc.position.x) ** 2 + (this.player.position.y - npc.position.y) ** 2);

            if (dist < 400) {
                // Aim at player
                npc.rotation = Math.atan2(this.player.position.y - npc.position.y, this.player.position.x - npc.position.x);

                // Shoot if line of sight (simplified)
                const newBullets = npc.shoot();
                if (newBullets) {
                    this.bullets.push(...newBullets);
                }
            }

            npc.update(dt, this.world);
        });

        // Bullets
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
                    this.explosions.push(new Explosion(b.position.x, b.position.y));
                }
            }

            // Entity Collision
            // Check Player
            if (b.owner !== this.player) {
                const dist = Math.sqrt((b.position.x - this.player.position.x) ** 2 + (b.position.y - this.player.position.y) ** 2);
                if (dist < this.player.radius + b.radius) {
                    b.active = false;
                    this.damageEntity(this.player, b.damage);
                    if (b.isRocket) this.explosions.push(new Explosion(b.position.x, b.position.y));
                }
            }

            // Check NPCs
            this.npcs.forEach(npc => {
                if (b.owner !== npc) {
                    const dist = Math.sqrt((b.position.x - npc.position.x) ** 2 + (b.position.y - npc.position.y) ** 2);
                    if (dist < npc.radius + b.radius) {
                        b.active = false;
                        this.damageEntity(npc, b.damage);
                        if (b.isRocket) this.explosions.push(new Explosion(b.position.x, b.position.y));
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
                    this.damageEntity(this.player, 100 * (1 - pDist / exp.maxRadius));
                }

                // Check NPCs
                this.npcs.forEach(npc => {
                    const nDist = Math.sqrt((exp.position.x - npc.position.x) ** 2 + (exp.position.y - npc.position.y) ** 2);
                    if (nDist < exp.maxRadius) {
                        this.damageEntity(npc, 100 * (1 - nDist / exp.maxRadius));
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
                    // Pick up
                    if (!this.player.weapon) {
                        this.player.weapon = l.weapon;
                        this.player.currentAmmo = WEAPONS[l.weapon].magSize;
                        this.player.maxAmmo = WEAPONS[l.weapon].magSize;
                        l.active = false;
                    }
                }
            }
        });
        this.loot = this.loot.filter(l => l.active);

        // Particles
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        // Cleanup Dead NPCs
        this.npcs = this.npcs.filter(n => !n.isDead);

        // Regen
        if (performance.now() / 1000 - this.player.lastDamageTime > 5) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + dt);
        }
    }

    private damageEntity(entity: Player, amount: number) {
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
            entity.isDead = true;
            this.spawnBlood(entity.position.x, entity.position.y);

            // Siphon (if player killed npc)
            if (entity.isNPC && !this.player.isDead) {
                this.player.health += 30;
                if (this.player.health > this.player.maxHealth) {
                    const overflow = this.player.health - this.player.maxHealth;
                    this.player.health = this.player.maxHealth;
                    this.player.shield = Math.min(this.player.maxShield, this.player.shield + overflow);
                }
            } else if (!entity.isNPC) {
                // Player Died
                if (this.onGameStateChange) this.onGameStateChange(GameState.GAME_OVER);
                if (this.onWinner) this.onWinner('GAME OVER');
            }
        }
    }

    private spawnBlood(x: number, y: number) {
        for (let i = 0; i < 20; i++) {
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
        // Camera Transform
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // World
        this.world.render(this.ctx, this.camera, this.viewW, this.viewH);

        // Loot
        this.loot.forEach(l => l.render(this.ctx, this.camera));

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

        // UI
        this.renderUI();
    }

    private renderUI() {
        if (this.player.isDead) {
            // Don't draw internal Game Over text, let React handle it
            return;
        }

        // HUD Bottom Left
        const hudX = 20;
        const hudY = this.canvas.height - 20;

        // Health Bar
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(hudX, hudY - 30, 200, 20);
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(hudX, hudY - 30, 200 * (this.player.health / this.player.maxHealth), 20);
        this.ctx.strokeStyle = '#FFF';
        this.ctx.strokeRect(hudX, hudY - 30, 200, 20);

        // Shield Bar (Above Health)
        if (this.player.shield > 0) {
            this.ctx.fillStyle = '#004488';
            this.ctx.fillRect(hudX, hudY - 60, 200, 15);
            this.ctx.fillStyle = '#00FFFF';
            this.ctx.fillRect(hudX, hudY - 60, 200 * (this.player.shield / this.player.maxShield), 15);
            this.ctx.strokeStyle = '#FFF';
            this.ctx.strokeRect(hudX, hudY - 60, 200, 15);
        }

        // Ammo / Weapon Info
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        if (this.player.weapon) {
            this.ctx.fillText(`${this.player.weapon}`, hudX, hudY - 80);
            this.ctx.fillText(`${this.player.currentAmmo} / ${this.player.maxAmmo}`, hudX, hudY - 105);
            if (this.player.isReloading) {
                this.ctx.fillStyle = '#FFFF00';
                this.ctx.fillText('RELOADING...', hudX + 150, hudY - 105);
            }
        } else {
            this.ctx.fillText('Unarmed', hudX, hudY - 80);
        }

        // Dash Cooldown
        const dashReady = performance.now() / 1000 - this.player.lastDashTime >= this.player.dashCooldown;
        this.ctx.fillStyle = dashReady ? '#00FF00' : '#555';
        this.ctx.fillText(`DASH: ${dashReady ? 'READY' : 'COOLDOWN'}`, hudX, hudY - 130);
    }
}
