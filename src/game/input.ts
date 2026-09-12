export class Input {
  readonly keys = new Set<string>()
  mouseDx = 0
  mouseDy = 0
  fireHeld = false
  fireClicked = false
  restart = false
  pointerLocked = false

  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
  }

  lockPointer(): void {
    void this.canvas.requestPointerLock()
  }

  consumeMouse(): { dx: number; dy: number } {
    const delta = { dx: this.mouseDx, dy: this.mouseDy }
    this.mouseDx = 0
    this.mouseDy = 0
    return delta
  }

  consumeFireClick(): boolean {
    const clicked = this.fireClicked
    this.fireClicked = false
    return clicked
  }

  consumeRestart(): boolean {
    const restart = this.restart
    this.restart = false
    return restart
  }

  throttle(): number {
    let v = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) v += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) v -= 1
    return v
  }

  steer(): number {
    let v = 0
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) v += 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) v -= 1
    return v
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code)
    if (event.code === 'KeyR') this.restart = true
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) return
    this.mouseDx += event.movementX
    this.mouseDy += event.movementY
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    this.fireHeld = true
    this.fireClicked = true
  }

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 0) return
    this.fireHeld = false
  }

  private onLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }
}
