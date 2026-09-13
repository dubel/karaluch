export class Input {
  readonly keys = new Set<string>()
  mouseDx = 0
  mouseDy = 0
  fireHeld = false
  fireClicked = false
  restart = false
  artillery = false
  pointerLocked = false

  private readonly canvas: HTMLCanvasElement
  private mouseFire = false
  private spaceFire = false
  private armed = false
  private suppressFireUntil = 0

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

  /** Drop leftover clicks/keys from overlay and intro so entering the arena does not fire. */
  arm(): void {
    this.armed = true
    this.suppressFireUntil = performance.now() + 280
    this.fireClicked = false
    this.fireHeld = false
    this.mouseFire = false
    this.spaceFire = false
    this.artillery = false
  }

  private canFire(): boolean {
    return this.armed && performance.now() >= this.suppressFireUntil
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

  consumeArtillery(): boolean {
    const fired = this.artillery
    this.artillery = false
    return fired
  }

  throttle(): number {
    let v = 0
    if (this.keys.has('ArrowUp')) v += 1
    if (this.keys.has('ArrowDown')) v -= 1
    return v
  }

  elevate(): number {
    let v = 0
    if (this.keys.has('KeyW')) v += 1
    if (this.keys.has('KeyS')) v -= 1
    return v
  }

  steer(): number {
    let v = 0
    if (this.keys.has('ArrowLeft')) v += 1
    if (this.keys.has('ArrowRight')) v -= 1
    return v
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code === 'Space' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'ArrowLeft' ||
      event.code === 'ArrowRight'
    ) {
      event.preventDefault()
    }
    this.keys.add(event.code)
    if (event.repeat || !this.canFire()) return
    if (event.code === 'Space') {
      this.fireClicked = true
      this.spaceFire = true
      this.fireHeld = true
    }
    if (event.code === 'KeyR') this.restart = true
    if (event.code === 'KeyA') this.artillery = true
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
    if (event.code === 'Space') {
      this.spaceFire = false
      this.fireHeld = this.mouseFire || this.spaceFire
    }
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) return
    this.mouseDx += event.movementX
    this.mouseDy += event.movementY
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.canFire() || !this.pointerLocked) return
    this.mouseFire = true
    this.fireHeld = true
    this.fireClicked = true
  }

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button !== 0) return
    this.mouseFire = false
    this.fireHeld = this.mouseFire || this.spaceFire
  }

  private onLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }
}
