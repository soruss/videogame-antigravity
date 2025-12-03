import { World, TILE_SIZE } from './World';
import type { Vector2 } from './types';
import type { Input } from './Input';

export const WeaponType = {
    SMG: 'SMG',
    AssaultRifle: 'Assault Rifle',
    Shotgun: 'Shotgun',
    Sniper: 'Sniper Rifle',
    RocketLauncher: 'Rocket Launcher'
} as const;

export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

export interface WeaponStats {
    type: WeaponType;
    fireRate: number; // Seconds between shots
    damage: number;
    speed: number;
    spread: number; // Radians
    count: number; // Bullets per shot
    isRocket?: boolean;
    color: string;
    magSize: number;
    reloadTime: number;
    wallDamage: number;
}

export const WEAPONS: Record<WeaponType, WeaponStats> = {
    [WeaponType.SMG]: { type: WeaponType.SMG, fireRate: 0.08, damage: 12, speed: 850, spread: 0.15, count: 1, color: '#CCCCCC', magSize: 25, reloadTime: 0.75, wallDamage: 0 },
    [WeaponType.AssaultRifle]: { type: WeaponType.AssaultRifle, fireRate: 0.1, damage: 15, speed: 900, spread: 0.1, count: 1, color: '#4444FF', magSize: 20, reloadTime: 1.0, wallDamage: 1 },
    [WeaponType.Shotgun]: { type: WeaponType.Shotgun, fireRate: 1.0, damage: 20, speed: 600, spread: 0.3, count: 5, color: '#FF4444', magSize: 8, reloadTime: 1.5, wallDamage: 2 },
    [WeaponType.Sniper]: { type: WeaponType.Sniper, fireRate: 1.5, damage: 80, speed: 1500, spread: 0.0, count: 1, color: '#44FF44', magSize: 5, reloadTime: 2.0, wallDamage: 5 },
    [WeaponType.RocketLauncher]: { type: WeaponType.RocketLauncher, fireRate: 2.0, damage: 100, speed: 500, spread: 0.05, count: 1, isRocket: true, color: '#FFAA00', magSize: 3, reloadTime: 1.75, wallDamage: 5 }
};

export class Loot {
    public position: Vector2;
    public weapon: WeaponType;
    public radius: number = 15;
    public active: boolean = true;

    constructor(x: number, y: number, weapon: WeaponType) {
        this.position = { x, y };
        this.weapon = weapon;
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = WEAPONS[this.weapon].color;

        ctx.fillStyle = '#333';
        ctx.fillRect(-10, -5, 20, 10);
        ctx.fillStyle = WEAPONS[this.weapon].color;
        ctx.fillRect(-5, -2, 10, 4);

        ctx.restore();
    }
}

export class Bullet {
    public position: Vector2;
    public velocity: Vector2;
    public radius: number = 3;
    public active: boolean = true;
    public lifeTime: number = 2.0; // Seconds
    public damage: number;
    public isRocket: boolean;
    public owner: Player | null = null; // To prevent self-damage

    constructor(x: number, y: number, angle: number, stats: WeaponStats, owner: Player | null = null) {
        this.position = { x, y };
        this.velocity = {
            x: Math.cos(angle) * stats.speed,
            y: Math.sin(angle) * stats.speed
        };
        this.damage = stats.damage;
        this.isRocket = !!stats.isRocket;
        if (this.isRocket) this.radius = 6;
        this.owner = owner;
    }

    public update(dt: number) {
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.active = false;
        }
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isRocket ? '#FFAA00' : '#FFFF00';
        ctx.fill();

        ctx.restore();
    }
}

export class Explosion {
    public position: Vector2;
    public radius: number = 10;
    public maxRadius: number = 50;
    public duration: number = 0.5;
    public timeElapsed: number = 0;
    public active: boolean = true;
    public owner: Player | null = null;

    constructor(x: number, y: number, owner: Player | null = null) {
        this.position = { x, y };
        this.owner = owner;
    }

    public update(dt: number) {
        this.timeElapsed += dt;
        if (this.timeElapsed >= this.duration) {
            this.active = false;
        } else {
            // Expand
            const progress = this.timeElapsed / this.duration;
            this.radius = 10 + (this.maxRadius - 10) * Math.sin(progress * Math.PI);
        }
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 100, 0, ${1 - this.timeElapsed / this.duration})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${1 - this.timeElapsed / this.duration})`;
        ctx.fill();

        ctx.restore();
    }
}

export class Particle {
    public position: Vector2;
    public velocity: Vector2;
    public life: number = 1.0; // Seconds
    public maxLife: number = 1.0;
    public color: string;
    public size: number;

    constructor(x: number, y: number, color: string) {
        this.position = { x, y };
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 50;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        this.color = color;
        this.size = Math.random() * 3 + 2;
        this.maxLife = Math.random() * 0.5 + 0.3;
        this.life = this.maxLife;
    }

    public update(dt: number) {
        this.life -= dt;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

export class Player {
    public position: Vector2;
    public velocity: Vector2 = { x: 0, y: 0 };
    public rotation: number = 0;
    public radius: number = 20;

    // Stats
    public health: number = 100;
    public maxHealth: number = 100;
    public isDead: boolean = false;
    public siphoned: boolean = false;

    // Inventory
    public weapon: WeaponType | null = null;
    public dropRequested: boolean = false;

    // Shooting
    public lastShotTime: number = 0;
    public currentAmmo: number = 0;
    public isReloading: boolean = false;
    public reloadTimer: number = 0;
    public maxAmmo: number = 0;

    // Shield & Health Regen
    public shield: number = 0;
    public maxShield: number = 50;
    public lastDamageTime: number = 0;

    // Dash
    public dashCooldown: number = 3.0;
    public lastDashTime: number = -10; // Allow immediate dash
    public isDashing: boolean = false;
    public dashDuration: number = 0.2;
    public dashTimer: number = 0;

    // AI Support
    public isNPC: boolean = false;
    public aiState: 'IDLE' | 'SEARCHING' | 'FIGHTING' = 'IDLE';
    public target: Vector2 | null = null;
    public path: Vector2[] = [];
    public pathTimer: number = 0;
    public weaponPickupTime: number = 0; // Track when weapon was picked up
    public hasHalo: boolean = false; // Swift Halo Effect

    constructor(x: number, y: number, isNPC: boolean = false) {
        this.position = { x, y };
        this.isNPC = isNPC;
    }

    public updateAI(dt: number, world: World, loot: Loot[], players: Player[], isMobile: boolean = false, potions: Potion[] = []) {
        if (!this.isNPC || this.isDead) return;

        // 1. State Decision
        if (!this.weapon) {
            this.aiState = 'SEARCHING';
        } else {
            this.aiState = 'FIGHTING';
        }

        // 2. Action based on State
        if (this.aiState === 'SEARCHING') {
            // Find nearest weapon
            let nearestLoot: Loot | null = null;
            let minDist = Infinity;

            for (const l of loot) {
                if (!l.active) continue;
                const dist = Math.sqrt((l.position.x - this.position.x) ** 2 + (l.position.y - this.position.y) ** 2);
                if (dist < minDist) {
                    minDist = dist;
                    nearestLoot = l;
                }
            }

            if (nearestLoot) {
                this.moveTo(dt, nearestLoot.position, world);
            }
        } else if (this.aiState === 'FIGHTING') {
            // Check 3-second delay
            const now = performance.now() / 1000;

            // Find nearest target (Player or other NPC)
            let nearestTarget: Player | null = null;
            let minTargetDist = Infinity;

            for (const p of players) {
                if (p === this || p.isDead) continue;
                const dist = Math.sqrt((p.position.x - this.position.x) ** 2 + (p.position.y - this.position.y) ** 2);
                if (dist < minTargetDist) {
                    minTargetDist = dist;
                    nearestTarget = p;
                }
            }

            // Potion Logic: If hurt (< 100 HP), check for potions
            let targetPotion: Potion | null = null;
            let minPotionDist = Infinity;

            if (this.health < 100) {
                for (const p of potions) {
                    if (!p.active) continue;
                    const dist = Math.sqrt((p.position.x - this.position.x) ** 2 + (p.position.y - this.position.y) ** 2);
                    if (dist < minPotionDist) {
                        minPotionDist = dist;
                        targetPotion = p;
                    }
                }
            }

            // Decision: Fight or Heal?
            // Heal if: Found potion AND (Potion is closer than Enemy OR No Enemy visible)
            if (targetPotion && (minPotionDist < minTargetDist || !nearestTarget)) {
                // Seek Potion
                this.moveTo(dt, targetPotion.position, world);
            } else if (nearestTarget) {
                // Fight
                const dist = minTargetDist;

                // Rotate towards target
                this.rotation = Math.atan2(nearestTarget.position.y - this.position.y, nearestTarget.position.x - this.position.x);

                if (dist < 400) {
                    // Shoot (Only if delay passed)
                    if (now - this.weaponPickupTime >= 3.0) {
                        // Nerf NPC accuracy on Mobile (2x spread)
                        const spreadMultiplier = isMobile ? 2.0 : 1.0;
                        return this.shoot(spreadMultiplier);
                    }
                } else {
                    // Chase
                    this.moveTo(dt, nearestTarget.position, world);
                }
            }
        }
        return null;
    }

    private moveTo(dt: number, target: Vector2, world: World) {
        // Re-path occasionally
        this.pathTimer -= dt;
        if (this.pathTimer <= 0 || (this.path.length === 0 && Math.random() < 0.1)) {
            this.pathTimer = 1.0; // Path every second
            const path = world.findPath(this.position, target);
            if (path) this.path = path;
        }

        // Follow Path
        if (this.path.length > 0) {
            const nextPoint = this.path[0];
            const dist = Math.sqrt((nextPoint.x - this.position.x) ** 2 + (nextPoint.y - this.position.y) ** 2);

            if (dist < 10) {
                this.path.shift(); // Reached point
            } else {
                // Move towards point
                const dx = nextPoint.x - this.position.x;
                const dy = nextPoint.y - this.position.y;
                this.rotation = Math.atan2(dy, dx);

                this.velocity.x = Math.cos(this.rotation) * 300;
                this.velocity.y = Math.sin(this.rotation) * 300;

                // Apply movement manually here since update() handles physics
                // Actually, let's set velocity and let update() handle collision
                return;
            }
        } else {
            // Fallback: Direct line if no path (or close)
            const dx = target.x - this.position.x;
            const dy = target.y - this.position.y;
            this.rotation = Math.atan2(dy, dx);
            this.velocity.x = Math.cos(this.rotation) * 300;
            this.velocity.y = Math.sin(this.rotation) * 300;
        }
    }

    public shoot(spreadMultiplier: number = 1.0): Bullet[] | null {
        if (this.isReloading || !this.weapon) return null;

        const now = performance.now() / 1000;
        if (now - this.lastShotTime >= WEAPONS[this.weapon].fireRate) {
            if (this.currentAmmo <= 0) {
                this.reload();
                return null;
            }

            this.lastShotTime = now;
            this.currentAmmo--;
            const stats = WEAPONS[this.weapon];

            // Spawn Bullets (Loop for shotgun pellets)
            const bullets: Bullet[] = [];

            for (let i = 0; i < stats.count; i++) {
                // Spread
                const angle = this.rotation + (Math.random() - 0.5) * stats.spread * spreadMultiplier;

                // Spawn Bullet
                // Offset to gun position
                const gunOffset = 30;
                const spawnX = this.position.x + Math.cos(this.rotation) * gunOffset;
                const spawnY = this.position.y + Math.sin(this.rotation) * gunOffset;

                bullets.push(new Bullet(spawnX, spawnY, angle, stats, this));
            }

            return bullets;
        }
        return null;
    }

    public reload() {
        if (this.isReloading || !this.weapon || this.currentAmmo === this.maxAmmo) return;
        this.isReloading = true;
        this.reloadTimer = WEAPONS[this.weapon].reloadTime;
    }

    public dash(): boolean {
        const now = performance.now() / 1000;
        if (now - this.lastDashTime >= this.dashCooldown && !this.isDashing) {
            this.isDashing = true;
            this.dashTimer = this.dashDuration;
            this.lastDashTime = now;

            // Dash in movement direction or facing direction
            let dx = 0;
            let dy = 0;
            if (this.velocity.x !== 0 || this.velocity.y !== 0) {
                dx = this.velocity.x;
                dy = this.velocity.y;
            } else {
                dx = Math.cos(this.rotation);
                dy = Math.sin(this.rotation);
            }

            // Normalize
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                dx /= len;
                dy /= len;
            }

            const dashSpeed = 1000;
            this.velocity = { x: dx * dashSpeed, y: dy * dashSpeed };
            return true;
        }
        return false;
    }

    public update(dt: number, world: World, input?: Input, camera?: Vector2) {
        if (this.isDead) return;

        // Reload Logic
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.isReloading = false;
                this.currentAmmo = this.maxAmmo;
            }
        }

        // Dash Logic
        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.velocity = { x: 0, y: 0 }; // Stop after dash
            }
            // Skip normal movement input while dashing
        }
        // Movement (Player only)
        // Movement (Player only)
        else if (!this.isNPC && input) {
            this.velocity = { x: 0, y: 0 };

            // Keyboard Input
            if (input.keys['KeyW']) this.velocity.y = -1;
            if (input.keys['KeyS']) this.velocity.y = 1;
            if (input.keys['KeyA']) this.velocity.x = -1;
            if (input.keys['KeyD']) this.velocity.x = 1;

            // Joystick Input (Override Keyboard if active)
            if (input.joystick) {
                this.velocity.x = input.joystick.x;
                this.velocity.y = -input.joystick.y; // Joystick Y is inverted (Up is positive)
            }

            // Normalize (Only for keyboard, joystick is already normalized usually)
            if (!input.joystick && (this.velocity.x !== 0 || this.velocity.y !== 0)) {
                const len = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
                this.velocity.x /= len;
                this.velocity.y /= len;
            }

            // Apply Speed
            const speed = this.weapon ? 300 : 400; // Faster when unarmed
            this.velocity.x *= speed;
            this.velocity.y *= speed;

            // Aiming (Rotation)
            if (camera) {
                // If using joystick and NOT shooting/aiming with mouse, look in movement direction
                if (input.joystick && !input.mouseDown) {
                    if (Math.abs(input.joystick.x) > 0.1 || Math.abs(input.joystick.y) > 0.1) {
                        this.rotation = Math.atan2(-input.joystick.y, input.joystick.x);
                    }
                } else {
                    // Mouse Aiming
                    const dx = input.mouse.x + camera.x - this.position.x;
                    const dy = input.mouse.y + camera.y - this.position.y;
                    this.rotation = Math.atan2(dy, dx);
                }
            }
        }

        // Apply Velocity
        const nextX = this.position.x + this.velocity.x * dt;
        const nextY = this.position.y + this.velocity.y * dt;

        // Collision Check (World) - Single Pass with Slide
        const collision = world.checkCollision({ x: nextX, y: nextY }, this.radius);
        if (collision) {
            // Push out
            this.position.x = nextX + collision.push.x;
            this.position.y = nextY + collision.push.y;

            // Slide Logic: Project velocity onto wall tangent
            // v_new = v - (v . n) * n
            const dot = this.velocity.x * collision.normal.x + this.velocity.y * collision.normal.y;
            // Only remove velocity component if moving INTO the wall (dot < 0)
            // But normal points OUT of wall, so if dot < 0 we are moving into it.
            if (dot < 0) {
                this.velocity.x -= collision.normal.x * dot;
                this.velocity.y -= collision.normal.y * dot;
            }
        } else {
            this.position.x = nextX;
            this.position.y = nextY;
        }

        // Clamp to world bounds
        this.position.x = Math.max(this.radius, Math.min(this.position.x, world.width * TILE_SIZE - this.radius));
        this.position.y = Math.max(this.radius, Math.min(this.position.y, world.height * TILE_SIZE - this.radius));
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        if (this.isDead) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);

        // Draw Player Body (Circle)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isNPC ? '#FF4444' : '#FFFFFF'; // Red for NPC, White for Player
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw Hands/Gun
        if (this.weapon) {
            ctx.fillStyle = WEAPONS[this.weapon].color;
            // Gun sticking out
            ctx.fillRect(15, -5, 30, 10);

            // Hands
            ctx.fillStyle = '#555555'; // Dark grey hands
            ctx.beginPath();
            ctx.arc(15, 10, 6, 0, Math.PI * 2); // Right hand
            ctx.arc(15, -10, 6, 0, Math.PI * 2); // Left hand
            ctx.fill();
        } else {
            // Fists
            ctx.fillStyle = '#555555';
            ctx.beginPath();
            ctx.arc(15, 15, 6, 0, Math.PI * 2);
            ctx.arc(15, -15, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Swift Halo (Render on top)
        if (this.hasHalo) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);

            // Halo Ring
            ctx.strokeStyle = '#FDE047'; // Yellow-400
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FEF08A'; // Yellow-200
            ctx.beginPath();
            ctx.ellipse(0, -25, 12, 4, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Feathers (Simple lines/shapes)
            ctx.fillStyle = '#FEF9C3'; // Yellow-100
            // Left Wing
            ctx.beginPath();
            ctx.moveTo(-12, -25);
            ctx.lineTo(-22, -30);
            ctx.lineTo(-20, -22);
            ctx.lineTo(-24, -20);
            ctx.lineTo(-12, -20);
            ctx.fill();
            // Right Wing
            ctx.beginPath();
            ctx.moveTo(12, -25);
            ctx.lineTo(22, -30);
            ctx.lineTo(20, -22);
            ctx.lineTo(24, -20);
            ctx.lineTo(12, -20);
            ctx.fill();

            ctx.restore();
        }

        // Health Bar
        if (this.health < this.maxHealth || this.shield > 0) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);

            // Health (Red/Green)
            ctx.fillStyle = 'red';
            ctx.fillRect(-20, -40, 40, 5);
            ctx.fillStyle = 'green';
            ctx.fillRect(-20, -40, 40 * (this.health / this.maxHealth), 5);

            // Shield (Blue)
            if (this.shield > 0) {
                ctx.fillStyle = '#0088FF'; // Darker Blue background
                ctx.fillRect(-20, -48, 40, 5);
                ctx.fillStyle = '#00FFFF'; // Cyan foreground
                ctx.fillRect(-20, -48, 40 * (this.shield / this.maxShield), 5);
            }

            ctx.restore();
        }

        // Reload Bar
        if (this.isReloading && this.weapon) {
            const stats = WEAPONS[this.weapon];
            const progress = 1 - (this.reloadTimer / stats.reloadTime);

            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.fillStyle = '#444';
            ctx.fillRect(-20, -50, 40, 5);
            ctx.fillStyle = '#FFFF00'; // Yellow
            ctx.fillRect(-20, -50, 40 * progress, 5);
            ctx.restore();
        }
    }
}

export class Potion {
    public position: Vector2;
    public radius: number = 15;
    public active: boolean = true;

    constructor(x: number, y: number) {
        this.position = { x, y };
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#3B82F6'; // Blue glow

        // Bottle Body (Round bottom)
        ctx.fillStyle = '#60A5FA'; // Light Blue Liquid
        ctx.beginPath();
        ctx.arc(0, 5, 8, 0, Math.PI * 2);
        ctx.fill();

        // Bottle Neck
        ctx.fillStyle = '#93C5FD'; // Lighter Blue Glass
        ctx.fillRect(-3, -8, 6, 8);

        // Cork
        ctx.fillStyle = '#78350F'; // Brown
        ctx.fillRect(-4, -10, 8, 3);

        // Highlight/Reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(-3, 3, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class SwiftHalo {
    public position: Vector2;
    public radius: number = 20;
    public active: boolean = true;

    constructor(x: number, y: number) {
        this.position = { x, y };
    }

    public render(ctx: CanvasRenderingContext2D, _cameraOffset: Vector2) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FDE047'; // Yellow Glow

        // Halo Ring
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Feathers
        ctx.fillStyle = '#FEF9C3';
        // Left
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-25, -5);
        ctx.lineTo(-22, 0);
        ctx.lineTo(-25, 5);
        ctx.fill();
        // Right
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(25, -5);
        ctx.lineTo(22, 0);
        ctx.lineTo(25, 5);
        ctx.fill();

        // Float Animation (Simple bob)
        const offset = Math.sin(performance.now() / 200) * 3;
        ctx.translate(0, offset);

        ctx.restore();
    }
}
