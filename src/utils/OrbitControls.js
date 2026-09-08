import * as THREE from 'three';

export class OrbitControls {
  constructor(camera, domElement, options = {}) {
    this.camera     = camera;
    this.domElement = domElement;
    this.target     = new THREE.Vector3();
    this.enableDamping = true;
    this.enablePan     = false;
    this.dampingFactor = 0.05;
    // Unset (0/Infinity) by default so existing unclamped callers — the solar
    // sim zooms freely between planets — see no behavior change.
    this.minDistance = options.minDistance ?? 0;
    this.maxDistance = options.maxDistance ?? Infinity;

    this.spherical      = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.scale = 1;

    this.rotateStart = new THREE.Vector2();
    this.rotateEnd   = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();

    // Pre-allocated to avoid per-frame GC pressure
    this._offset = new THREE.Vector3();

    this.isPointerDown = false;
    this.pinchStartDist = null;

    this._onPointerDown  = this._onPointerDown.bind(this);
    this._onPointerMove  = this._onPointerMove.bind(this);
    this._onPointerUp    = this._onPointerUp.bind(this);
    this._onWheel        = this._onWheel.bind(this);
    this._onTouchStart   = this._onTouchStart.bind(this);
    this._onTouchMove    = this._onTouchMove.bind(this);
    this._onTouchEnd     = this._onTouchEnd.bind(this);

    domElement.addEventListener('mousedown',  this._onPointerDown);
    domElement.addEventListener('wheel',      this._onWheel, { passive: false });
    domElement.addEventListener('touchstart', this._onTouchStart, { passive: false });
    domElement.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    domElement.addEventListener('touchend',   this._onTouchEnd);
  }

  // ── Mouse ───────────────────────────────────────────────────────────────────

  _onPointerDown(e) {
    this.isPointerDown = true;
    this.rotateStart.set(e.clientX, e.clientY);
    document.addEventListener('mousemove', this._onPointerMove);
    document.addEventListener('mouseup',   this._onPointerUp);
  }

  _onPointerMove(e) {
    if (!this.isPointerDown) return;
    this.rotateEnd.set(e.clientX, e.clientY);
    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);
    this._applyRotateDelta(this.rotateDelta);
    this.rotateStart.copy(this.rotateEnd);
  }

  _onPointerUp() {
    this.isPointerDown = false;
    document.removeEventListener('mousemove', this._onPointerMove);
    document.removeEventListener('mouseup',   this._onPointerUp);
  }

  _onWheel(e) {
    e.preventDefault();
    // Proportional to scroll magnitude so trackpad nudges feel gentle,
    // capped at ±5% so a fast scroll still responds firmly.
    const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 0.001, 0.05);
    this.scale *= 1 + delta;
  }

  // ── Touch ───────────────────────────────────────────────────────────────────

  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isPointerDown = true;
      this.rotateStart.set(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      this.isPointerDown = false;
      this.pinchStartDist = this._pinchDist(e);
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this.isPointerDown) {
      this.rotateEnd.set(e.touches[0].clientX, e.touches[0].clientY);
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);
      this._applyRotateDelta(this.rotateDelta);
      this.rotateStart.copy(this.rotateEnd);
    } else if (e.touches.length === 2 && this.pinchStartDist !== null) {
      const dist = this._pinchDist(e);
      this.scale *= this.pinchStartDist / dist;
      this.pinchStartDist = dist;
    }
  }

  _onTouchEnd() {
    this.isPointerDown  = false;
    this.pinchStartDist = null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _pinchDist(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _applyRotateDelta(delta) {
    const h = this.domElement.clientHeight;
    this.sphericalDelta.theta -= (2 * Math.PI * delta.x) / h;
    this.sphericalDelta.phi   -= (2 * Math.PI * delta.y) / h;
  }

  // ── Update (called every frame) ──────────────────────────────────────────────

  update() {
    this._offset.copy(this.camera.position).sub(this.target);

    this.spherical.setFromVector3(this._offset);
    this.spherical.theta  += this.sphericalDelta.theta;
    this.spherical.phi    += this.sphericalDelta.phi;
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    this.spherical.makeSafe();

    this._offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(this._offset);
    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      const d = 1 - this.dampingFactor;
      this.sphericalDelta.theta *= d;
      this.sphericalDelta.phi   *= d;
      this.scale = 1 + (this.scale - 1) * d;
    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.scale = 1;
    }
  }

  dispose() {
    this.domElement.removeEventListener('mousedown',  this._onPointerDown);
    this.domElement.removeEventListener('wheel',      this._onWheel);
    this.domElement.removeEventListener('touchstart', this._onTouchStart);
    this.domElement.removeEventListener('touchmove',  this._onTouchMove);
    this.domElement.removeEventListener('touchend',   this._onTouchEnd);
    document.removeEventListener('mousemove', this._onPointerMove);
    document.removeEventListener('mouseup',   this._onPointerUp);
  }
}
