'use strict';

const CW = PARAMS.canvasW;
const CH = PARAMS.canvasH;
const WL = PARAMS.wallLeft;
const WR = PARAMS.wallRight;
const WT = PARAMS.wallTop;
const WB = PARAMS.wallBottom;

// ── Ray casting ────────────────────────────────────────────────────────────────
// Returns only the first wall-bounce segment for the aim preview (mystery after that).
// Targets are skipped until after the first wall bounce.

function castRayPreview(ox, oy, dx, dy) {
  let x = ox, y = oy, vx = dx, vy = dy;
  const r = PARAMS.bulletRadius;

  let tWall = Infinity, wnx = 0, wny = 0;
  if (vx < 0) { const t=(WL+r-x)/vx; if(t>0.001&&t<tWall){tWall=t;wnx=1;wny=0;} }
  if (vx > 0) { const t=(WR-r-x)/vx; if(t>0.001&&t<tWall){tWall=t;wnx=-1;wny=0;} }
  if (vy < 0) { const t=(WT+r-y)/vy; if(t>0.001&&t<tWall){tWall=t;wnx=0;wny=1;} }
  if (vy > 0) { const t=(WB-r-y)/vy; if(t>0.001&&t<tWall){tWall=t;wnx=0;wny=-1;} }

  if (tWall === Infinity) return null;
  return { x1:x, y1:y, x2:x+vx*tWall, y2:y+vy*tWall };
}

// ── Target ─────────────────────────────────────────────────────────────────────

class Target {
  constructor(x, y, hp) {
    this.x = x; this.y = y; this.hp = hp; this.maxHp = hp;
    this._flashTimer = 0;
    this._shakeX = 0;
    this._particles = [];
  }

  hit() {
    this.hp--;
    this._flashTimer = 0.15;
    this._shakeX = 5;
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
        x:this.x, y:this.y,
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        life:0.4+Math.random()*0.25, t:0, r:2+Math.random()*3,
      });
    }
  }

  update(dt) {
    if (this._flashTimer > 0) this._flashTimer -= dt;
    if (this._shakeX > 0) this._shakeX = Math.max(0, this._shakeX - dt*45);
    for (const p of this._particles) p.t += dt;
    this._particles = this._particles.filter(p => p.t < p.life);
  }

  draw(ctx) {
    // Particles (show even when destroyed)
    for (const p of this._particles) {
      const a = 1 - p.t/p.life;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(p.x+p.vx*p.t, p.y+p.vy*p.t, p.r*a, 0, Math.PI*2);
      ctx.fill(); ctx.restore();
    }
    if (this.hp <= 0) return;

    const hw = PARAMS.targetW/2, hh = PARAMS.targetH/2;
    const sx = this._shakeX * (Math.random()>0.5?1:-1);
    ctx.save(); ctx.translate(this.x+sx, this.y);

    // Body (human)
    const flash = this._flashTimer > 0;
    ctx.fillStyle = flash ? '#fff' : (this.maxHp >= 2 ? '#e88' : '#f9c06e');
    ctx.beginPath(); ctx.roundRect(-hw, -hh, PARAMS.targetW, PARAMS.targetH, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();

    if (!flash) {
      // Eyes
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(-7, -3, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( 7, -3, 2, 0, Math.PI*2); ctx.fill();
      // Mouth (scared if hp:2)
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      if (this.maxHp >= 2 && this.hp < this.maxHp) {
        // Frown after hit
        ctx.beginPath(); ctx.arc(0, 6, 5, Math.PI+0.3, -0.3); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 4, 5, 0.2, Math.PI-0.2); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ── Bullet (Poop) ──────────────────────────────────────────────────────────────

class Bullet {
  constructor(x, y, vx, vy) {
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.r = PARAMS.bulletRadius;
    this.bounces = 0;    // wall bounces
    this._totalHits = 0;
    this.dead = false;
    this._trail = [];
  }

  get _charged() { return this.bounces > 0; }

  update(dt, targets) {
    const steps = 3, subDt = dt/steps;
    for (let s = 0; s < steps; s++) {
      this._trail.push({x:this.x, y:this.y});
      if (this._trail.length > 14) this._trail.shift();

      this.x += this.vx * subDt;
      this.y += this.vy * subDt;

      if (this.x - this.r <= WL) { this.x=WL+this.r; this.vx=Math.abs(this.vx); this._onWallBounce(); }
      if (this.x + this.r >= WR) { this.x=WR-this.r; this.vx=-Math.abs(this.vx); this._onWallBounce(); }
      if (this.y - this.r <= WT) { this.y=WT+this.r; this.vy=Math.abs(this.vy); this._onWallBounce(); }
      if (this.y + this.r >= WB) { this.dead=true; return; }
      if (this.dead) return;

      // Target collision
      for (const tgt of targets) {
        if (tgt.hp <= 0) continue;
        const hw=PARAMS.targetW/2, hh=PARAMS.targetH/2;
        const cx=Math.max(tgt.x-hw,Math.min(this.x,tgt.x+hw));
        const cy=Math.max(tgt.y-hh,Math.min(this.y,tgt.y+hh));
        let nx=this.x-cx, ny=this.y-cy;
        const distSq=nx*nx+ny*ny;
        if (distSq < this.r*this.r) {
          if (!this._charged) {
            // Direct hit before wall bounce → miss
            this.dead=true; this.isMiss=true;
          } else {
            const len=Math.sqrt(distSq)||0.001;
            nx/=len; ny/=len;
            const dot=this.vx*nx+this.vy*ny;
            if (dot < 0) {
              this.x=cx+nx*(this.r+1); this.y=cy+ny*(this.r+1);
              this.vx-=2*dot*nx; this.vy-=2*dot*ny;
              tgt.hit();
              this._totalHits++;
              if (this._totalHits > 40) this.dead=true;
            }
          }
          break;
        }
      }
      if (this.dead) return;
    }
  }

  _onWallBounce() {
    this.bounces++;
    this._totalHits++;
    window.audioManager && window.audioManager.bounce();
    if (this.bounces > PARAMS.maxBounces) this.dead=true;
  }

  draw(ctx) {
    const charged = this._charged;
    // Trail
    for (let i=0; i<this._trail.length; i++) {
      const a=(i/this._trail.length)*0.35*(charged?1:0.4);
      ctx.save(); ctx.globalAlpha=a;
      ctx.fillStyle=charged?'#8B4513':'#aaa';
      ctx.beginPath(); ctx.arc(this._trail[i].x, this._trail[i].y, this.r*0.55, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = charged ? 1.0 : 0.45;

    // Poop base (dark brown)
    ctx.fillStyle = charged ? '#5c3317' : '#888';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r+1, 0, Math.PI*2); ctx.fill();

    // Top swirl bumps
    ctx.fillStyle = charged ? '#7a4522' : '#aaa';
    ctx.beginPath(); ctx.arc(this.x, this.y-3, this.r*0.65, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = charged ? '#6b3a1f' : '#999';
    ctx.beginPath(); ctx.arc(this.x+1, this.y-6, this.r*0.4, 0, Math.PI*2); ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255,255,200,0.25)';
    ctx.beginPath(); ctx.arc(this.x-2, this.y-2, this.r*0.3, 0, Math.PI*2); ctx.fill();

    ctx.restore();
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
    this._aimAngle = -Math.PI/2;
    this._previewSeg = null;

    this._resultTimer = 0;
    this._resultType = '';
    this._flashTimer = 0;
    this._flashColor = '';
    this._missPopup = 0; // countdown timer for "直当てダメ！" text
    this._lastTime = null;

    this._bindEvents();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _loadStage(idx) {
    const def = PARAMS.stages[idx];
    this.targets = def.targets.map(t => new Target(t.x, t.y, t.hp));
    this.shotsLeft = def.shots;
    this.shotsUsed = 0;
    this.bullet = null;
    this._aimDrag = false;
    this._previewSeg = null;
    this._flashTimer = 0;
    this._missPopup = 0;
  }

  _startGame() {
    this.stageIndex = 0; this.stars = [];
    this._loadStage(0); this.state = 'playing';
  }

  _nextStage() {
    this.stageIndex++;
    if (this.stageIndex >= PARAMS.stages.length) {
      this.state = 'allclear';
      window.audioManager && window.audioManager.allClear();
      return;
    }
    this._loadStage(this.stageIndex); this.state = 'playing';
  }

  _calcStars(def, used) {
    const l = def.shots;
    if (used <= Math.ceil(l*0.5))  return 3;
    if (used <= Math.ceil(l*0.75)) return 2;
    return 1;
  }

  _shoot() {
    if (this.shotsLeft<=0 || this.bullet) return;
    const spd=PARAMS.bulletSpeed;
    this.bullet=new Bullet(PARAMS.cannonX, PARAMS.cannonY,
      Math.cos(this._aimAngle)*spd, Math.sin(this._aimAngle)*spd);
    this.shotsLeft--; this.shotsUsed++;
    this._previewSeg=null;
    window.audioManager && window.audioManager.shoot();
  }

  _updatePreview() {
    if (this.bullet) { this._previewSeg=null; return; }
    this._previewSeg = castRayPreview(
      PARAMS.cannonX, PARAMS.cannonY,
      Math.cos(this._aimAngle), Math.sin(this._aimAngle)
    );
  }

  _bindEvents() {
    this.canvas.addEventListener('touchstart', e=>this._onTouchStart(e), {passive:false});
    this.canvas.addEventListener('touchmove',  e=>this._onTouchMove(e),  {passive:false});
    this.canvas.addEventListener('touchend',   e=>this._onTouchEnd(e),   {passive:false});
    window.addEventListener('keydown', e=>this._onKey(e));
  }

  _canvasPos(cx, cy) {
    const r=this.canvas.getBoundingClientRect();
    return {x:(cx-r.left)*(CW/r.width), y:(cy-r.top)*(CH/r.height)};
  }

  _setAim(cx, cy) {
    const dx=cx-PARAMS.cannonX, dy=cy-PARAMS.cannonY;
    if (dx*dx+dy*dy < 100) return;
    let a=Math.atan2(dy,dx);
    if (a>0) a-=Math.PI*2;
    this._aimAngle=Math.max(-Math.PI+0.35, Math.min(-0.35, a));
    this._updatePreview();
  }

  _onTouchStart(e) {
    e.preventDefault();
    const t=e.touches[0]; if(!t) return;
    const p=this._canvasPos(t.clientX, t.clientY);
    if (this.state==='start')    { this._startGame(); return; }
    if (this.state==='allclear') { this._startGame(); return; }
    if (this.state==='result') {
      if (this._resultTimer<=0) {
        if (this._resultType==='clear') this._nextStage();
        else { this._loadStage(this.stageIndex); this.state='playing'; }
      }
      return;
    }
    if (this.state!=='playing') return;
    this._aimDrag=true; this._setAim(p.x, p.y);
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this._aimDrag||this.state!=='playing') return;
    const t=e.touches[0]; if(!t) return;
    const p=this._canvasPos(t.clientX, t.clientY);
    this._setAim(p.x, p.y);
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (!this._aimDrag||this.state!=='playing') return;
    this._aimDrag=false;
    if (!this.bullet) this._shoot();
  }

  _onKey(e) {
    if (this.state==='start'&&(e.code==='Space'||e.code==='Enter'))   { this._startGame(); return; }
    if (this.state==='allclear'&&(e.code==='Space'||e.code==='KeyR')) { this._startGame(); return; }
    if (this.state==='result'&&this._resultTimer<=0) {
      if (e.code==='Space'||e.code==='Enter'||e.code==='KeyR') {
        if (this._resultType==='clear') this._nextStage();
        else { this._loadStage(this.stageIndex); this.state='playing'; }
        return;
      }
    }
    if (this.state==='playing') {
      if (e.code==='ArrowLeft')  { this._aimAngle=Math.max(-Math.PI+0.35,this._aimAngle-0.05); this._updatePreview(); }
      if (e.code==='ArrowRight') { this._aimAngle=Math.min(-0.35,this._aimAngle+0.05); this._updatePreview(); }
      if (e.code==='Space'||e.code==='Enter') this._shoot();
    }
  }

  _loop(ts) {
    if (this._lastTime===null) this._lastTime=ts;
    const dt=Math.min((ts-this._lastTime)/1000, 0.05);
    this._lastTime=ts;
    this._update(dt); this._draw();
    requestAnimationFrame(t=>this._loop(t));
  }

  _update(dt) {
    if (this._flashTimer>0) this._flashTimer-=dt;
    if (this.state==='result') { this._resultTimer-=dt; for(const t of this.targets) t.update(dt); return; }
    if (this.state!=='playing') return;
    for (const t of this.targets) t.update(dt);
    if (this._missPopup > 0) this._missPopup -= dt;
    if (this.bullet) {
      this.bullet.update(dt, this.targets);
      if (this.bullet.dead) {
        const wasMiss = this.bullet.isMiss;
        this.bullet=null; this._updatePreview();
        if (wasMiss) this._triggerMiss();
      }
    }
    this._checkStageEnd();
  }

  _triggerMiss() {
    this._flashTimer = 0.35;
    this._flashColor = 'rgba(255,30,30,0.45)';
    this._missPopup = 1.4;
    window.audioManager && window.audioManager.miss();
  }

  _checkStageEnd() {
    if (this.state!=='playing') return;
    if (this.targets.every(t=>t.hp<=0)) {
      if (this.bullet) { this.bullet.dead=true; this.bullet=null; }
      this.stars[this.stageIndex]=this._calcStars(PARAMS.stages[this.stageIndex], this.shotsUsed);
      this._resultType='clear'; this._resultTimer=1.8;
      this._flashTimer=0.3; this._flashColor='rgba(255,220,80,0.45)';
      this.state='result';
      window.audioManager && window.audioManager.stageClear();
      return;
    }
    if (this.shotsLeft<=0&&!this.bullet) {
      this._resultType='fail'; this._resultTimer=1.5;
      this._flashTimer=0.2; this._flashColor='rgba(255,60,60,0.35)';
      this.state='result';
      window.audioManager && window.audioManager.stageFail();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  _draw() {
    const ctx=this.ctx;
    ctx.clearRect(0,0,CW,CH);
    if (this.state==='start')    { this._drawStart(ctx); return; }
    if (this.state==='allclear') { this._drawAllClear(ctx); return; }

    this._drawBG(ctx);
    this._drawPreview(ctx);
    for (const t of this.targets) t.draw(ctx);
    if (this.bullet) this.bullet.draw(ctx);
    this._drawGorilla(ctx);
    this._drawHUD(ctx);

    if (this._flashTimer>0) {
      ctx.save(); ctx.globalAlpha=this._flashTimer*3;
      ctx.fillStyle=this._flashColor; ctx.fillRect(0,0,CW,CH); ctx.restore();
    }

    // Miss popup
    if (this._missPopup > 0) {
      const a = Math.min(1, this._missPopup * 2);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('直当てダメ！', CW/2+2, CH/2+2);
      ctx.fillStyle = '#ff4444';
      ctx.fillText('直当てダメ！', CW/2, CH/2);
      ctx.restore();
    }

    if (this.state==='result') this._drawResult(ctx);
  }

  _drawBG(ctx) {
    const grad=ctx.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#0a150a'); grad.addColorStop(1,'#111e0f');
    ctx.fillStyle=grad; ctx.fillRect(0,0,CW,CH);

    ctx.strokeStyle='rgba(60,120,40,0.3)'; ctx.lineWidth=1;
    ctx.strokeRect(WL,WT,WR-WL,WB-WT);

    ctx.strokeStyle='rgba(40,80,30,0.15)'; ctx.lineWidth=0.5;
    for(let gx=WL;gx<=WR;gx+=40){ctx.beginPath();ctx.moveTo(gx,WT);ctx.lineTo(gx,WB);ctx.stroke();}
    for(let gy=WT;gy<=WB;gy+=40){ctx.beginPath();ctx.moveTo(WL,gy);ctx.lineTo(WR,gy);ctx.stroke();}
  }

  _drawGorilla(ctx) {
    const cx=PARAMS.cannonX, cy=PARAMS.cannonY;

    // Arm in aim direction
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(this._aimAngle);
    ctx.fillStyle='#3d2b1f';
    ctx.beginPath(); ctx.roundRect(12,-5,22,10,4); ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle='#2d1f14';
    ctx.beginPath(); ctx.ellipse(cx,cy+2,22,18,0,0,Math.PI*2); ctx.fill();

    // Face
    ctx.fillStyle='#5a3825';
    ctx.beginPath(); ctx.ellipse(cx,cy-2,16,14,0,0,Math.PI*2); ctx.fill();

    // Brow ridge
    ctx.fillStyle='#2d1f14';
    ctx.beginPath(); ctx.ellipse(cx,cy-10,14,5,0,Math.PI,Math.PI*2); ctx.fill();

    // Muzzle
    ctx.fillStyle='#8B6245';
    ctx.beginPath(); ctx.ellipse(cx,cy+4,9,7,0,0,Math.PI*2); ctx.fill();

    // Eyes
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(cx-6,cy-6,3.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+6,cy-6,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#222';
    ctx.beginPath(); ctx.arc(cx-5,cy-6,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+7,cy-6,2,0,Math.PI*2); ctx.fill();

    // Nostrils
    ctx.fillStyle='#3d2218';
    ctx.beginPath(); ctx.arc(cx-3,cy+5,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+3,cy+5,2,0,Math.PI*2); ctx.fill();
  }

  _drawPreview(ctx) {
    // Only show the first wall-bounce segment, fading to invisible
    if (!this._previewSeg||this.bullet) return;
    const {x1,y1,x2,y2}=this._previewSeg;
    ctx.save();
    const grad=ctx.createLinearGradient(x1,y1,x2,y2);
    grad.addColorStop(0,'rgba(200,140,60,0.7)');
    grad.addColorStop(0.6,'rgba(200,140,60,0.2)');
    grad.addColorStop(1,'rgba(200,140,60,0)');
    ctx.strokeStyle=grad;
    ctx.setLineDash([5,9]);
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.restore();
  }

  _drawHUD(ctx) {
    ctx.fillStyle='#8bc34a';
    ctx.font='bold 13px monospace';
    ctx.textAlign='left';
    ctx.fillText(`STAGE ${this.stageIndex+1} / ${PARAMS.stages.length}`, 16, 46);

    ctx.textAlign='right'; ctx.fillStyle='#fff';
    ctx.fillText(`ウンコ: ${this.shotsLeft}`, CW-16, 46);

    const maxS=PARAMS.stages[this.stageIndex].shots;
    for(let i=0;i<maxS;i++){
      // Small poop icon
      ctx.fillStyle=i<this.shotsLeft?'#8B4513':'#333';
      ctx.beginPath(); ctx.arc(CW-16-i*10, 60, 3.5, 0, Math.PI*2); ctx.fill();
    }

    if (!this.bullet&&!this._aimDrag) {
      ctx.fillStyle='rgba(180,220,120,0.55)';
      ctx.font='11px monospace';
      ctx.textAlign='center';
      ctx.fillText('壁に反射させてから当てよ！', CW/2, CH-18);
    }
  }

  _drawResult(ctx) {
    const isClear=this._resultType==='clear';
    ctx.fillStyle=isClear?'rgba(0,20,0,0.7)':'rgba(30,0,0,0.7)';
    ctx.fillRect(0,0,CW,CH);
    const my=CH*0.42;

    if (isClear) {
      ctx.fillStyle='#ffe060'; ctx.font='bold 36px monospace'; ctx.textAlign='center';
      ctx.fillText('CLEAR！', CW/2, my-30);
      const s=this.stars[this.stageIndex]||0;
      for(let i=0;i<3;i++){
        ctx.fillStyle=i<s?'#ffe060':'#333'; ctx.font='36px monospace';
        ctx.fillText('★', CW/2+(i-1)*44, my+20);
      }
      ctx.fillStyle='rgba(200,240,160,0.7)'; ctx.font='12px monospace';
      ctx.fillText(`ウンコ使用数: ${this.shotsUsed} / ${PARAMS.stages[this.stageIndex].shots}`, CW/2, my+60);
      if (this._resultTimer<=0) {
        const label=this.stageIndex+1>=PARAMS.stages.length?'結果を見る':'次のステージへ';
        this._drawBlink(ctx, label, CW/2, my+100, '#8cf');
      }
    } else {
      ctx.fillStyle='#f66'; ctx.font='bold 32px monospace'; ctx.textAlign='center';
      ctx.fillText('FAILED', CW/2, my);
      ctx.fillStyle='rgba(220,180,180,0.7)'; ctx.font='13px monospace';
      ctx.fillText('ウンコが尽きた！', CW/2, my+40);
      if (this._resultTimer<=0) this._drawBlink(ctx,'タップでリトライ',CW/2,my+90,'#faa');
    }
  }

  _drawBlink(ctx,text,x,y,color) {
    if (Math.floor(Date.now()/500)%2===0) {
      ctx.fillStyle=color; ctx.font='bold 14px monospace'; ctx.textAlign='center'; ctx.fillText(text,x,y);
    }
  }

  _drawStart(ctx) {
    const grad=ctx.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#060f06'); grad.addColorStop(1,'#0a180a');
    ctx.fillStyle=grad; ctx.fillRect(0,0,CW,CH);

    // Jungle dots
    ctx.fillStyle='rgba(80,160,60,0.12)';
    for(let i=0;i<40;i++){
      ctx.beginPath();
      ctx.arc((Math.sin(i*137.5)*0.5+0.5)*CW,(Math.sin(i*97.3+1)*0.5+0.5)*CH*0.85,1.5,0,Math.PI*2);
      ctx.fill();
    }

    ctx.textAlign='center';
    ctx.fillStyle='#8bc34a'; ctx.font='bold 22px monospace';
    ctx.fillText('ゴリラのウンコ投げ', CW/2, 150);
    ctx.fillStyle='#ffe060'; ctx.font='bold 42px monospace';
    ctx.fillText('POOP SHOT', CW/2, 200);

    // Mini gorilla on start screen (same drawing)
    ctx.save(); ctx.translate(CW/2-8, 290); ctx.scale(1.4,1.4);
    this._drawGorillaAt(ctx,0,0); ctx.restore();

    ctx.fillStyle='rgba(180,230,120,0.85)'; ctx.font='12px monospace';
    ['ドラッグ: 照準', '離す: ウンコ発射', '壁に反射させてから人間に当てろ！', '直当てはダメ！ 必ず壁を使え！', '少ない発射数ほど高評価']
      .forEach((r,i)=>ctx.fillText(r, CW/2, 370+i*22));

    this._drawBlink(ctx,'タップしてスタート',CW/2,570,'#8cf');
  }

  _drawGorillaAt(ctx,cx,cy) {
    ctx.fillStyle='#2d1f14';
    ctx.beginPath(); ctx.ellipse(cx,cy+2,22,18,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#5a3825';
    ctx.beginPath(); ctx.ellipse(cx,cy-2,16,14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2d1f14';
    ctx.beginPath(); ctx.ellipse(cx,cy-10,14,5,0,Math.PI,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8B6245';
    ctx.beginPath(); ctx.ellipse(cx,cy+4,9,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(cx-6,cy-6,3.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+6,cy-6,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#222';
    ctx.beginPath(); ctx.arc(cx-5,cy-6,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+7,cy-6,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3d2218';
    ctx.beginPath(); ctx.arc(cx-3,cy+5,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+3,cy+5,2,0,Math.PI*2); ctx.fill();
  }

  _drawAllClear(ctx) {
    const grad=ctx.createLinearGradient(0,0,0,CH);
    grad.addColorStop(0,'#0a1400'); grad.addColorStop(1,'#001400');
    ctx.fillStyle=grad; ctx.fillRect(0,0,CW,CH);

    ctx.textAlign='center';
    ctx.fillStyle='#ffe060'; ctx.font='bold 38px monospace';
    ctx.fillText('ALL CLEAR！', CW/2, 180);
    ctx.fillStyle='#8f8'; ctx.font='15px monospace';
    ctx.fillText('全人間にウンコ命中！', CW/2, 218);

    const total=this.stars.reduce((a,b)=>a+(b||0),0);
    ctx.fillStyle='#ffe060'; ctx.font='bold 18px monospace';
    ctx.fillText(`獲得スター: ${total} / ${PARAMS.stages.length*3}`, CW/2, 275);

    const cols=5;
    for(let i=0;i<PARAMS.stages.length;i++){
      const col=i%cols, row=Math.floor(i/cols);
      const sx=36+col*60, sy=320+row*38;
      const s=this.stars[i]||0;
      ctx.textAlign='left'; ctx.fillStyle='#aaa'; ctx.font='11px monospace';
      ctx.fillText(`S${i+1}`, sx, sy);
      ctx.font='12px monospace';
      for(let j=0;j<3;j++){
        ctx.fillStyle=j<s?'#ffe060':'#333';
        ctx.fillText('★', sx+j*13, sy+15);
      }
    }
    ctx.textAlign='center';
    this._drawBlink(ctx,'タップで最初から',CW/2,590,'#8cf');
  }
}

window.addEventListener('load', () => { new Game(); });
