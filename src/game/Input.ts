export class Input {
    public keys: { [key: string]: boolean } = {};
    public mouse: { x: number, y: number } = { x: 0, y: 0 };
    public mouseDown: boolean = false;

    public joystick: { x: number, y: number } | null = null;

    constructor() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', () => this.mouseDown = true);
        window.addEventListener('mouseup', () => this.mouseDown = false);
    }
}
