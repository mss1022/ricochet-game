'use strict';

const CW = PARAMS.canvasW;
const CH = PARAMS.canvasH;
const WL = PARAMS.wallLeft;
const WR = PARAMS.wallRight;
const WT = PARAMS.wallTop;
const WB = PARAMS.wallBottom;

// ── Ray casting ────────────────────────────────────────────────────────────────
// Bounces off both walls AND targets. Tracks virtual HP for accurate preview.

function castRay(ox, oy, dx, dy, targets, maxBounces) {
  const segments = [];
  let x = ox, y = oy;
  let vx = dx, vy = dy;
  const r = PARAMS.bulletRadius;
  const hpLeft = targets.map(t => t.hp);

  for (let b = 0; b <= maxBounces; b++) {
    // Closest wall
    let tWall = Infinity, wnx = 0, wny = 0;
    if (vx < 0) { const t=(WL+r-x)/vx; if(t>0.001&&t<tWall){tWall=t;wnx=1;wny=0;} }
    if (vx > 0) { const t=(WR-r-x)/vx; if(t>0.001&&t<tWall){tWall=t;wnx=-1;wny=0;} }
    if (vy < 0) { const t=(WT+r-y)/vy; if(t>0.001&&t<tWall){tWall=t;wnx=0;wny=1;} }
    if (vy > 0) { const t=(WB-r-y)/vy; if(t>0.001&&t<tWall){tWall=t;wnx=0;wny=-1;} }

    // Closest target
    let tTarget = Infinity, hitIdx = -1, tnx = 0, tny = 0;
    for (let i = 0; i < targets.length; i++) {
      if (hpLeft[i] <= 0) continue;
      const tgt = targets[i];
      const hw = PARAMS.targetW / 2 + r;
      const hh = PARAMS.targetH / 2 + r;
      let t1x, t2x, t1y, t2y;
      if (vx !== 0) { t1x=(tgt.x-hw-x)/vx; t2x=(tgt.x+hw-x)/vx; }
      else { if(x<tgt.x-hw||x>tgt.x+hw) continue; t1x=-Infinity; t2x=Infinity; }
      if (vy !== 0) { t1y=(tgt.y-hh-y)/vy; t2y=(tgt.y+hh-y)/vy; }
      else { if(y<tgt.y-hh||y>tgt.y+hh) continue; t1y=-Infinity; t2y=Infinity; }
      const txEnt=Math.min(t1x,t2x), tyEnt=Math.min(t1y,t2y);
      const tEnt=Math.max(txEnt,tyEnt);
      const tEx=Math.min(Math.max(t1x,t2x),Math.max(t1y,t2y));
      if (tEnt<tEx && tEnt>0.001 && tEnt<tTarget) {
        tTarget=tEnt; hitIdx=i;
        // Determine which face was hit → reflection normal
        if (txEnt>tyEnt) { tnx=vx>0?-1:1; tny=0; }
        else             { tnx=0; tny=vy>0?-1:1; }
      }
    }

    if (hitIdx >= 0 && tTarget < tWall) {
      // Hit target: draw segment, decrement virtual HP, reflect
      const ex=x+vx*tTarget, ey=y+vy*tTarget;
      segments.push({ x1:x, y1:y, x2:ex, y2:ey, onTarget:true });
      hpLeft[hitIdx]--;
      const dot=vx*tnx+vy*tny;
      vx-=2*dot*tnx; vy-=2*dot*tny;
      x=ex; y=ey;
    } else if (tWall < Infinity) {
      // Hit wall: draw segment, reflect
      const ex=x+vx*tWall, ey=y+vy*tWall;
      segments.push({ x1:x, y1:y, x2:ex, y2:ey, onTarget:false });
      if (ey >= WB-r) break; // hit floor → stop preview
      const dot=vx*wnx+vy*wny;
      vx-=2*dot*wnx; vy-=2*dot*wny;
      x=ex; y=ey;
    } else break;
  }
  return { segments };
}

// ── Target ─────────────────────────────────────────────────────────────────────

class Target {
  constructor(x, y, hp) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this._flashTimer = 0;
    this._shakeX = 0;
    this._particles = [];
  }

  hit() {
    this.hp--;
    this._flashTimer = 0.12;
    this._shakeX = 4;
    if (this.hp > 0) {
      window.audioManager && window.audioManager.hit();
    } else {
      window.audioManager && window.audioManager.destroy();
      this._spawnParticles();
    }
  }

  _spawnParticles() {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this._particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.25,
        t: 0,
        r: 2 + Math.random() * 3,
      });
    }
  }

  update(dt) {
    if (this._flashTimer > 0) this._flashTimer -= dt;
    if (this._shakeX > 0) this._shakeX = Math.max(0, this._shakeX - dt * 40);
    for (const p of this._particles) p.t += dt;
    this._particles = this._particles.filter(p => p.t < p.life);
  }

  draw(ctx) {
    // Particles (show even after destroyed)
    for (const p of this._particles) {
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fa0';
      ctx.beginPath();
      ctx.arc(p.x + p.vx * p.t, p.y + p.vy * p.t, p.r * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.hp <= 0) return;

    const hw = PARAMS.targetW / 2;
    const hh = PARAMS.targetH / 2;
    const sx = this._shakeX * (Math.random() > 0.5 ? 1 : -1);
    ctx.save();
    ctx.translate(this.x + sx, this.y);

    const flash = this._flashTimer > 0;
    const color = this.maxHp >= 2 ? (flash ? '#fff' : '#e74') : (flash ? '#fff' : '#4af');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, PARAMS.targetW, PARAMS.targetH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // HP dots for multi-hit targets
    if (this.maxHp >= 2) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < this.hp; i++) {
        const dx = (i - (this.hp - 1) / 2) * 10;
        ctx.beginPath();
        ctx.arc(dx, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ── Bullet ─────────────────────────────────────────────────────────────────────

class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = PARAMS.bulletRadius;
    this.bounces = 0;    // wall bounces only
    this._totalHits = 0; // all hits (safety cap)
    this.dead = false;
    this._trail = [];
  }

  update(dt, targets) {
    const steps = 3;
    const subDt = dt / steps;

    for (let s = 0; s < steps; s++) {
      this._trail.push({ x: this.x, y: this.y });
      if (this._trail.length > 14) this._trail.shift();

      this.x += this.vx * subDt;
      this.y += this.vy * subDt;

      // Wall bounces
      if (this.x - this.r <= WL) {
        this.x = WL + this.r;
        this.vx = Math.abs(this.vx);
        this._onWallBounce();
      }
      if (this.x + this.r >= WR) {
        this.x = WR - this.r;
        this.vx = -Math.abs(this.vx);
        this._onWallBounce();
      }
      if (this.y - this.r <= WT) {
        this.y = WT + this.r;
        this.vy = Math.abs(this.vy);
        this._onWallBounce();
      }
      if (this.y + this.r >= WB) {
        this.dead = true;
        return;
      }
      if (this.dead) return;

      // Target collision — reflect instead of dying
      for (const tgt of targets) {
        if (tgt.hp <= 0) continue;
        const hw = PARAMS.targetW / 2;
        const hh = PARAMS.targetH / 2;
        const closestX = Math.max(tgt.x - hw, Math.min(this.x, tgt.x + hw));
        const closestY = Math.max(tgt.y - hh, Math.min(this.y, tgt.y + hh));
        let nx = this.x - closestX;
        let ny = this.y - closestY;
        const distSq = nx * nx + ny * ny;
        if (distSq < this.r * this.r) {
          const len = Math.sqrt(distSq) || 0.001;
          nx /= len; ny /= len;
          const dot = this.vx * nx + this.vy * ny;
          if (dot < 0) { // approaching — reflect
            this.x = closestX + nx * (this.r + 1);
            this.y = closestY + ny * (this.r + 1);
            this.vx -= 2 * dot * nx;
            this.vy -= 2 * dot * ny;
            tgt.hit();
            this._totalHits++;
            if (this._totalHits > 40) this.dead = true; // safety cap
          }
          break; // one target per sub-step
        }
      }
      if (this.dead) return;
    }
  }

  _onWallBounce() {
    this.bounces++;
    this._totalHits++;
    window.audioManager && window.audioManager.bounce();
    if (this.bounces > PARAMS.maxBounces) this.dead = true;
  }

  draw(ctx) {
    // Trail
    for (let i = 0; i < this._trail.length; i++) {
      const a = (i / this._trail.length) * 0.4;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this._trail[i].x, this._trail[i].y, this.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aef';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ── Main Game ──────────────────────────────────────────────────────────────────

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.state = 'start';
    this.stageIndex = 0;
    this.stars = [];

    this.targets = [];
    this.bullet = null;
    this.shotsLeft = 0;
    this.shotsUsed = 0;

    this._aimDrag = false;
    this._aimAngle = -Math.PI / 2;
    this._preview = null;

    this._resultTimer = 0;
    this._resultType = '';

    this._flashTimer = 0;
    this._flashColor = 'rgba(255,255,255,0.5)';

    this._lastTime = null;

    this._bindEvents();
    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Stage ─────────────────────────────────────────────────────────────────

  _loadStage(idx) {
    const def = PARAMS.stages[idx];
    this.targets = def.targets.map(t => new Target(t.x, t.y, t.hp));
    this.shotsLeft = def.shots;
    this.shotsUsed = 0;
    this.bullet = null;
    this._aimDrag = false;
    this._preview = null;
    this._flashTimer = 0;
  }

  _startGame() {
    this.stageIndex = 0;
    this.stars = [];
    this._loadStage(0);
    this.state = 'playing';
  }

  _nextStage() {
    this.stageIndex++;
    if (this.stageIndex >= PARAMS.stages.length) {
      this.state = 'allclear';
      window.audioManager && window.audioManager.allClear();
      return;
    }
    this._loadStage(this.stageIndex);
    this.state = 'playing';
  }

  _calcStars(def, shotsUsed) {
    const limit = def.shots;
    if (shotsUsed <= Math.ceil(limit * 0.5))  return 3;
    if (shotsUsed <= Math.ceil(limit * 0.75)) return 2;
    return 1;
  }

  // ── Shooting ──────────────────────────────────────────────────────────────

  _shoot() {
    if (this.shotsLeft <= 0 || this.bullet) return;
    const spd = PARAMS.bulletSpeed;
    this.bullet = new Bullet(
      PARAMS.cannonX, PARAMS.cannonY,
      Math.cos(this._aimAngle) * spd,
      Math.sin(this._aimAngle) * spd
    );
    this.shotsLeft--;
    this.shotsUsed++;
    this._preview = null;
    window.audioManager && window.audioManager.shoot();
  }

  _updatePreview() {
    if (this.bullet) { this._preview = null; return; }
    this._preview = castRay(
      PARAMS.cannonX, PARAMS.cannonY,
      Math.cos(this._aimAngle), Math.sin(this._aimAngle),
      this.targets, PARAMS.maxBounces
    );
  }

  // ── Events ────────────────────────────────────────────────────────────────

  _bindEvents() {
    this.canvas.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove',  e => this._onTouchMove(e),  { passive: false });
    this.canvas.addEventListener('touchend',   e => this._onTouchEnd(e),   { passive: false });
    window.addEventListener('keydown', e => this._onKey(e));
  }

  _canvasPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CW / rect.width),
      y: (clientY - rect.top)  * (CH / rect.height),
    };
  }

  _setAimFromCanvas(cx, cy) {
    const dx = cx - PARAMS.cannonX;
    const dy = cy - PARAMS.cannonY;
    if (Math.sqrt(dx*dx + dy*dy) < 10) return;
    let angle = Math.atan2(dy, dx);
    if (angle > 0) angle -= Math.PI * 2;
    this._aimAngle = Math.max(-Math.PI + 0.35, Math.min(-0.35, angle));
    this._updatePreview();
  }

  _onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const pos = this._canvasPos(touch.clientX, touch.clientY);

    if (this.state === 'start')    { this._startGame(); return; }
    if (this.state === 'allclear') { this._startGame(); return; }
    if (this.state === 'result') {
      if (this._resultTimer <= 0) {
        if (this._resultType === 'clear') this._nextStage();
        else { this._loadStage(this.stageIndex); this.state = 'playing'; }
      }
      return;
    }
    if (this.state !== 'playing') return;
    this._aimDrag = true;
    this._setAimFromCanvas(pos.x, pos.y);
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this._aimDrag || this.state !== 'playing') return;
    const touch = e.touches[0];
    if (!touch) return;
    this._setAimFromCanvas(...Object.values(this._canvasPos(touch.clientX, touch.clientY)));
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (!this._aimDrag || this.state !== 'playing') return;
    this._aimDrag = false;
    if (!this.bullet) this._shoot();
  }

  _onKey(e) {
    if (this.state === 'start' && (e.code === 'Space' || e.code === 'Enter')) { this._startGame(); return; }
    if (this.state === 'allclear' && (e.code === 'Space' || e.code === 'KeyR')) { this._startGame(); return; }
    if (this.state === 'result' && this._resultTimer <= 0) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR') {
        if (this._resultType === 'clear') this._nextStage();
        else { this._loadStage(this.stageIndex); this.state = 'playing'; }
        return;
      }
    }
    if (this.state === 'playing') {
      if (e.code === 'ArrowLeft')  { this._aimAngle = Math.max(-Math.PI+0.35, this._aimAngle-0.05); this._updatePreview(); }
      if (e.code === 'ArrowRight') { this._aimAngle = Math.min(-0.35, this._aimAngle+0.05);         this._updatePreview(); }
      if (e.code === 'Space' || e.code === 'Enter') this._shoot();
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  _loop(ts) {
    if (this._lastTime === null) this._lastTime = ts;
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    if (this._flashTimer > 0) this._flashTimer -= dt;

    if (this.state === 'result') {
      this._resultTimer -= dt;
      for (const t of this.targets) t.update(dt);
      return;
    }
    if (this.state !== 'playing') return;

    for (const t of this.targets) t.update(dt);

    if (this.bullet) {
      this.bullet.update(dt, this.targets);
      if (this.bullet.dead) {
        this.bullet = null;
        this._updatePreview();
      }
    }

    this._checkStageEnd();
  }

  _checkStageEnd() {
    if (this.state !== 'playing') return;
    const allDead = this.targets.every(t => t.hp <= 0);
    if (allDead) {
      if (this.bullet) { this.bullet.dead = true; this.bullet = null; }
      const s = this._calcStars(PARAMS.stages[this.stageIndex], this.shotsUsed);
      this.stars[this.stageIndex] = s;
      this._resultType = 'clear';
      this._resultTimer = 1.8;
      this._flashTimer = 0.3;
      this._flashColor = 'rgba(255,220,80,0.45)';
      this.state = 'result';
      window.audioManager && window.audioManager.stageClear();
      return;
    }
    if (this.shotsLeft <= 0 && !this.bullet) {
      this._resultType = 'fail';
      this._resultTimer = 1.5;
      this._flashTimer = 0.2;
      this._flashColor = 'rgba(255,60,60,0.35)';
      this.state = 'result';
      window.audioManager && window.audioManager.stageFail();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CW, CH);

    if (this.state === 'start')    { this._drawStart(ctx);    return; }
    if (this.state === 'allclear') { this._drawAllClear(ctx); return; }

    this._drawBG(ctx);
    this._drawPreview(ctx);
    for (const t of this.targets) t.draw(ctx);
    if (this.bullet) this.bullet.draw(ctx);
    this._drawCannon(ctx);
    this._drawHUD(ctx);

    if (this._flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = this._flashTimer * 3;
      ctx.fillStyle = this._flashColor;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    if (this.state === 'result') this._drawResult(ctx);
  }

  _drawBG(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#0a0e1a');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    ctx.strokeStyle = 'rgba(80,120,200,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(WL, WT, WR-WL, WB-WT);

    ctx.strokeStyle = 'rgba(60,80,140,0.15)';
    ctx.lineWidth = 0.5;
    for (let gx=WL; gx<=WR; gx+=40) { ctx.beginPath(); ctx.moveTo(gx,WT); ctx.lineTo(gx,WB); ctx.stroke(); }
    for (let gy=WT; gy<=WB; gy+=40) { ctx.beginPath(); ctx.moveTo(WL,gy); ctx.lineTo(WR,gy); ctx.stroke(); }
  }

  _drawCannon(ctx) {
    const cx = PARAMS.cannonX, cy = PARAMS.cannonY, cr = PARAMS.cannonRadius;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._aimAngle);
    ctx.fillStyle = '#8af';
    ctx.beginPath();
    ctx.roundRect(0, -5, 28, 10, 3);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#8cf';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1a3a5a';
    ctx.beginPath();
    ctx.arc(cx, cy, cr*0.55, 0, Math.PI*2);
    ctx.fill();
  }

  _drawPreview(ctx) {
    if (!this._preview || this.bullet) return;
    ctx.save();
    const segs = this._preview.segments;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const a = Math.max(0.08, 1 - i * (0.65 / Math.max(segs.length, 1)));
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 1.5;
      // Orange when ray is about to hit a target, blue for wall segments
      ctx.strokeStyle = seg.onTarget
        ? `rgba(255,160,60,${a})`
        : `rgba(100,180,255,${a})`;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      if (i < segs.length - 1) {
        ctx.setLineDash([]);
        ctx.fillStyle = seg.onTarget ? `rgba(255,160,60,${a})` : `rgba(100,200,255,${a})`;
        ctx.beginPath();
        ctx.arc(seg.x2, seg.y2, 3, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawHUD(ctx) {
    ctx.fillStyle = '#8af';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`STAGE ${this.stageIndex+1} / ${PARAMS.stages.length}`, 16, 46);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SHOTS: ${this.shotsLeft}`, CW-16, 46);

    // Shot pip icons
    const maxShots = PARAMS.stages[this.stageIndex].shots;
    for (let i = 0; i < maxShots; i++) {
      ctx.beginPath();
      ctx.arc(CW-16 - i*10, 60, 3.5, 0, Math.PI*2);
      ctx.fillStyle = i < this.shotsLeft ? '#4af' : '#333';
      ctx.fill();
    }

    if (!this.bullet && !this._aimDrag) {
      ctx.fillStyle = 'rgba(180,220,255,0.5)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ドラッグして狙い、離して発射', CW/2, CH-18);
    }
  }

  _drawResult(ctx) {
    const isClear = this._resultType === 'clear';
    ctx.fillStyle = isClear ? 'rgba(0,20,0,0.65)' : 'rgba(30,0,0,0.65)';
    ctx.fillRect(0, 0, CW, CH);
    const midY = CH * 0.42;

    if (isClear) {
      ctx.fillStyle = '#ffe060';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CLEAR!', CW/2, midY - 30);

      const s = this.stars[this.stageIndex] || 0;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < s ? '#ffe060' : '#333';
        ctx.font = '36px monospace';
        ctx.fillText('★', CW/2 + (i-1)*44, midY+20);
      }
      ctx.fillStyle = 'rgba(200,240,200,0.7)';
      ctx.font = '12px monospace';
      ctx.fillText(`使用弾数: ${this.shotsUsed} / ${PARAMS.stages[this.stageIndex].shots}`, CW/2, midY+60);

      if (this._resultTimer <= 0) {
        const label = this.stageIndex+1 >= PARAMS.stages.length ? '結果を見る' : '次のステージへ';
        this._drawBlinkText(ctx, label, CW/2, midY+100, '#8cf');
      }
    } else {
      ctx.fillStyle = '#f66';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FAILED', CW/2, midY);
      ctx.fillStyle = 'rgba(220,180,180,0.7)';
      ctx.font = '13px monospace';
      ctx.fillText('弾が尽きました', CW/2, midY+40);
      if (this._resultTimer <= 0) this._drawBlinkText(ctx, 'タップでリトライ', CW/2, midY+90, '#faa');
    }
  }

  _drawBlinkText(ctx, text, x, y, color) {
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y);
    }
  }

  _drawStart(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#050a14');
    grad.addColorStop(1, '#0a1428');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    ctx.fillStyle = 'rgba(100,160,255,0.15)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc((Math.sin(i*137.5)*0.5+0.5)*CW, (Math.sin(i*97.3+1)*0.5+0.5)*CH*0.85, 1.5, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('RICOCHET', CW/2, 200);

    ctx.fillStyle = '#8cf';
    ctx.font = '14px monospace';
    ctx.fillText('弾を反射させてターゲットを破壊せよ', CW/2, 240);

    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(CW/2, 370, 18, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = 'rgba(160,200,240,0.8)';
    ctx.font = '12px monospace';
    ['ドラッグ: 照準', '指を離す: 発射', '弾は壁とターゲットで反射する', '少ない弾数ほど高評価']
      .forEach((r, i) => ctx.fillText(r, CW/2, 420 + i*22));

    this._drawBlinkText(ctx, 'タップしてスタート', CW/2, 560, '#8cf');
  }

  _drawAllClear(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, '#0a1400');
    grad.addColorStop(1, '#001400');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe060';
    ctx.font = 'bold 42px monospace';
    ctx.fillText('ALL CLEAR!', CW/2, 200);
    ctx.fillStyle = '#8f8';
    ctx.font = '16px monospace';
    ctx.fillText('全ステージ制覇！', CW/2, 248);

    const total = this.stars.reduce((a,b) => a+(b||0), 0);
    ctx.fillStyle = '#ffe060';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`獲得スター: ${total} / ${PARAMS.stages.length*3}`, CW/2, 310);

    // Stage star grid (5 columns)
    const cols = 5;
    for (let i = 0; i < PARAMS.stages.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const sx = 36 + col * 60, sy = 360 + row * 38;
      const s = this.stars[i] || 0;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.fillText(`S${i+1}`, sx, sy);
      ctx.font = '12px monospace';
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = j < s ? '#ffe060' : '#333';
        ctx.fillText('★', sx + j*13, sy+15);
      }
    }

    ctx.textAlign = 'center';
    this._drawBlinkText(ctx, 'タップで最初から', CW/2, 590, '#8cf');
  }
}

window.addEventListener('load', () => { new Game(); });
