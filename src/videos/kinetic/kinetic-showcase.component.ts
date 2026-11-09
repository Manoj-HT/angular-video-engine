import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  injectCurrentFrame,
  injectVideoConfig,
  interpolate,
  spring,
  stagger,
  AveAnimateDirective,
  AveSequenceDirective
} from '@angular-video/core';

export interface KineticShowcaseProps {
  title: string;
  tagline: string;
  badgeText: string;
  themeColor: string;
  secondaryColor: string;
}

@Component({
  selector: 'app-kinetic-showcase',
  standalone: true,
  imports: [CommonModule, AveAnimateDirective, AveSequenceDirective],
  template: `
    <div
      class="showcase-stage"
      [style.--primary]="themeColor"
      [style.--secondary]="secondaryColor"
    >
      <!-- 0. DYNAMIC AMBIENT AURORA BACKGROUND -->
      <div class="ambient-layer">
        <!-- Floating Fluid Orb 1 (Cyan / Primary) -->
        <div
          class="aurora-orb orb-1"
          [style.left.%]="orb1X()"
          [style.top.%]="orb1Y()"
          [style.transform]="'scale(' + orb1Scale() + ')'"
        ></div>

        <!-- Floating Fluid Orb 2 (Violet / Secondary) -->
        <div
          class="aurora-orb orb-2"
          [style.left.%]="orb2X()"
          [style.top.%]="orb2Y()"
          [style.transform]="'scale(' + orb2Scale() + ')'"
        ></div>

        <!-- Floating Fluid Orb 3 (Magenta / Accent) -->
        <div
          class="aurora-orb orb-3"
          [style.left.%]="orb3X()"
          [style.top.%]="orb3Y()"
          [style.transform]="'scale(' + orb3Scale() + ')'"
        ></div>

        <!-- Perspective Retro-Cyber Grid Floor -->
        <div
          class="perspective-grid"
          [style.background-position-y.px]="gridOffsetY()"
        ></div>

        <!-- Floating Dust Particles -->
        <div class="particles-field">
          @for (p of particles; track p.id) {
            <div
              class="particle"
              [style.left.%]="p.x"
              [style.top.%]="(p.y + (frame() * p.speed)) % 100"
              [style.width.px]="p.size"
              [style.height.px]="p.size"
              [style.opacity]="p.baseOpacity + 0.3 * Math.sin(frame() * 0.05 + p.id)"
            ></div>
          }
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- ACT I: KINETIC LOGO & EQUALIZER VISUALIZER (Frames 0 - 160)     -->
      <!-- ============================================================== -->
      <div class="scene-container" [aveSequence]="{ from: 0, duration: 165 }">
        <!-- Rotating Hexagonal Energy Ring & Shield Logo -->
        <div
          class="hero-logo-box"
          [aveAnimate]="{
            range: [0, 45],
            from: { opacity: 0, scale: 0.3, translateY: 60 },
            to: { opacity: 1, scale: 1, translateY: 0 },
            spring: { damping: 11, stiffness: 120 }
          }"
        >
          <!-- Hex Energy Rings -->
          <div
            class="hex-ring ring-outer"
            [style.transform]="'rotate(' + (frame() * 1.2) + 'deg)'"
          ></div>
          <div
            class="hex-ring ring-inner"
            [style.transform]="'rotate(' + (-frame() * 1.8) + 'deg)'"
          ></div>

          <!-- Central Glowing Emblem -->
          <div class="core-emblem">
            <span class="emblem-symbol">⚡</span>
          </div>
        </div>

        <!-- Category Badge -->
        <div
          class="neon-badge"
          [aveAnimate]="{
            range: [15, 50],
            from: { opacity: 0, translateY: -25, scale: 0.8 },
            to: { opacity: 1, translateY: 0, scale: 1 },
            spring: { damping: 12 }
          }"
        >
          <span class="badge-pulsing-dot"></span>
          <span>{{ badgeText }}</span>
        </div>

        <!-- Grand Animated Title -->
        <h1
          class="kinetic-title"
          [aveAnimate]="{
            range: [25, 65],
            from: { opacity: 0, translateY: 50, scale: 0.9 },
            to: { opacity: 1, translateY: 0, scale: 1 },
            spring: { damping: 13 }
          }"
        >
          <span class="gradient-text">{{ title }}</span>
        </h1>

        <!-- Subheading -->
        <p
          class="kinetic-tagline"
          [aveAnimate]="{
            range: [40, 80],
            from: { opacity: 0, translateY: 30 },
            to: { opacity: 0.9, translateY: 0 }
          }"
        >
          {{ tagline }}
        </p>

        <!-- 28-Bar Harmonic Audio Waveform Visualizer -->
        <div
          class="audio-waveform-bar"
          [aveAnimate]="{
            range: [50, 90],
            from: { opacity: 0, scale: 0.8 },
            to: { opacity: 1, scale: 1 },
            spring: { damping: 14 }
          }"
        >
          @for (bar of equalizerBars(); track $index) {
            <div
              class="eq-bar"
              [style.height.%]="bar.height"
              [style.background]="bar.color"
            ></div>
          }
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- ACT II: 3D GLASSMORPHISM DASHBOARD & GAUGES (Frames 150 - 330) -->
      <!-- ============================================================== -->
      <div class="scene-container" [aveSequence]="{ from: 155, duration: 175 }">
        <div class="scene-header">
          <div class="section-tag">ACT II · REAL-TIME TELEMETRY</div>
          <h2 class="section-title">Deterministic Graphics Pipeline</h2>
        </div>

        <!-- 3 Glassmorphic Feature Cards with Dynamic SVG Visuals -->
        <div class="glass-dashboard-grid">
          <!-- Card 1: 60 FPS Frame Clock with Animated Circular Gauge -->
          <div
            class="glass-card"
            [aveAnimate]="{
              range: [165, 205],
              from: { opacity: 0, translateY: 40, scale: 0.85 },
              to: { opacity: 1, translateY: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            <div class="card-top">
              <span class="card-icon-pill">⏱️ CLOCK</span>
              <span class="live-dot-green">● 60 FPS</span>
            </div>

            <!-- Animated SVG Circular Ring Gauge -->
            <div class="gauge-center">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  stroke-width="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  [attr.stroke]="themeColor"
                  stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="283"
                  [attr.stroke-dashoffset]="gaugeDashOffset()"
                  transform="rotate(-90 60 60)"
                  style="filter: drop-shadow(0 0 6px var(--primary));"
                />
              </svg>
              <div class="gauge-value">
                <span class="big-num">{{ gaugePercentage() }}%</span>
                <span class="sub-num">RENDER READY</span>
              </div>
            </div>

            <div class="card-caption">Zero dropped frames on Chromium pipe</div>
          </div>

          <!-- Card 2: Spring Physics Waveform -->
          <div
            class="glass-card"
            [aveAnimate]="{
              range: [180, 220],
              from: { opacity: 0, translateY: 40, scale: 0.85 },
              to: { opacity: 1, translateY: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            <div class="card-top">
              <span class="card-icon-pill">🌊 SPRINGS</span>
              <span class="metric-badge">0.00ms Drift</span>
            </div>

            <!-- Dynamic Animated SVG Spring Waveform -->
            <div class="sparkline-box">
              <svg width="240" height="90" viewBox="0 0 240 90">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" [attr.stop-color]="themeColor" />
                    <stop offset="100%" [attr.stop-color]="secondaryColor" />
                  </linearGradient>
                </defs>
                <path
                  [attr.d]="springWavePath()"
                  fill="none"
                  stroke="url(#waveGrad)"
                  stroke-width="4"
                  stroke-linecap="round"
                />
              </svg>
            </div>

            <div class="card-stat-row">
              <div class="stat-unit">
                <span class="stat-label">Mass</span>
                <span class="stat-val">1.0</span>
              </div>
              <div class="stat-unit">
                <span class="stat-label">Damping</span>
                <span class="stat-val">12.5</span>
              </div>
              <div class="stat-unit">
                <span class="stat-label">Stiffness</span>
                <span class="stat-val">180</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Native Web Standards Suite -->
          <div
            class="glass-card"
            [aveAnimate]="{
              range: [195, 235],
              from: { opacity: 0, translateY: 40, scale: 0.85 },
              to: { opacity: 1, translateY: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            <div class="card-top">
              <span class="card-icon-pill">🚀 ARCHITECTURE</span>
              <span class="tag-angular">v22 Zoneless</span>
            </div>

            <div class="standards-list">
              <div class="standard-row">
                <span class="std-icon">✨</span>
                <span class="std-name">Directives & Signals</span>
                <span class="std-check">✔</span>
              </div>
              <div class="standard-row">
                <span class="std-icon">🎞️</span>
                <span class="std-name">FFmpeg Direct In-Memory Pipe</span>
                <span class="std-check">✔</span>
              </div>
              <div class="standard-row">
                <span class="std-icon">🖥️</span>
                <span class="std-name">WebSocket Remote Clean Feed</span>
                <span class="std-check">✔</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- ACT III: 3D ISOMETRIC GEOMETRY & MORPHING CUBE (Frames 320-480)-->
      <!-- ============================================================== -->
      <div class="scene-container" [aveSequence]="{ from: 325, duration: 165 }">
        <div class="scene-header">
          <div class="section-tag">ACT III · 3D HARDWARE ACCELERATION</div>
          <h2 class="section-title">Spatial Motion Graphics</h2>
        </div>

        <div class="spatial-center-stage">
          <!-- 3D Perspective Glass Cube Rotating with Frame -->
          <div
            class="cube-3d-scene"
            [style.transform]="cubeTransform()"
          >
            <div class="cube-face front"><span>AVE</span></div>
            <div class="cube-face back"><span>60FPS</span></div>
            <div class="cube-face right"><span>CORE</span></div>
            <div class="cube-face left"><span>SYNC</span></div>
            <div class="cube-face top"><span>WEB</span></div>
            <div class="cube-face bottom"><span>NODE</span></div>
          </div>

          <!-- Surrounding Orbiting Feature Badges -->
          <div
            class="orbit-badge badge-top-left"
            [aveAnimate]="{
              range: [335, 375],
              from: { opacity: 0, translateX: -60, scale: 0.5 },
              to: { opacity: 1, translateX: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            ⚡ Sub-pixel Precision
          </div>

          <div
            class="orbit-badge badge-top-right"
            [aveAnimate]="{
              range: [345, 385],
              from: { opacity: 0, translateX: 60, scale: 0.5 },
              to: { opacity: 1, translateX: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            🎯 Frame-Accurate Clock
          </div>

          <div
            class="orbit-badge badge-bot-left"
            [aveAnimate]="{
              range: [355, 395],
              from: { opacity: 0, translateX: -60, scale: 0.5 },
              to: { opacity: 1, translateX: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            💎 100% Declarative
          </div>

          <div
            class="orbit-badge badge-bot-right"
            [aveAnimate]="{
              range: [365, 405],
              from: { opacity: 0, translateX: 60, scale: 0.5 },
              to: { opacity: 1, translateX: 0, scale: 1 },
              spring: { damping: 12 }
            }"
          >
            🌐 Native CSS & Canvas
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- ACT IV: GRAND FINALE & CODE TERMINAL (Frames 470 - 600)        -->
      <!-- ============================================================== -->
      <div class="scene-container" [aveSequence]="{ from: 480, duration: 120 }">
        <!-- Expanding Shockwave Ring -->
        <div
          class="shockwave-ring"
          [style.transform]="'scale(' + shockwaveScale() + ')'"
          [style.opacity]="shockwaveOpacity()"
        ></div>

        <div class="finale-content">
          <div
            class="finale-pill"
            [aveAnimate]="{
              range: [480, 515],
              from: { opacity: 0, translateY: -20 },
              to: { opacity: 1, translateY: 0 },
              spring: { damping: 12 }
            }"
          >
            🔥 READY FOR PRODUCTION
          </div>

          <h2
            class="finale-headline"
            [aveAnimate]="{
              range: [490, 530],
              from: { opacity: 0, translateY: 30, scale: 0.9 },
              to: { opacity: 1, translateY: 0, scale: 1 },
              spring: { damping: 14 }
            }"
          >
            Start Creating Videos With Code
          </h2>

          <!-- Interactive Code Terminal Mockup -->
          <div
            class="terminal-window"
            [aveAnimate]="{
              range: [505, 545],
              from: { opacity: 0, translateY: 40, scale: 0.92 },
              to: { opacity: 1, translateY: 0, scale: 1 },
              spring: { damping: 13 }
            }"
          >
            <div class="terminal-header">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
              <span class="terminal-title">bash — 80×24</span>
            </div>
            <div class="terminal-body">
              <div class="term-line">
                <span class="term-prompt">$</span>
                <span class="term-cmd">npx ave-cli render DemoPromo --output=promo.mp4</span>
              </div>
              <div class="term-output">
                <span class="term-success">✔ Video exported: 1920×1080 @ 60fps [H.264]</span>
              </div>
            </div>
          </div>

          <!-- Pulsating Shimmer Button -->
          <div
            class="cta-button-box"
            [aveAnimate]="{
              range: [520, 560],
              from: { opacity: 0, scale: 0.7 },
              to: { opacity: 1, scale: 1 },
              spring: { damping: 10 }
            }"
          >
            <button class="glowing-cta-btn">
              <span>EXPLORE STUDIO WORKBENCH</span>
              <span class="cta-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: #060813;
      color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      user-select: none;
    }

    .showcase-stage {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* 0. AMBIENT AURORA & PARTICLES */
    .ambient-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .aurora-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(120px);
      mix-blend-mode: screen;
      transform-origin: center center;
    }

    .orb-1 {
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, var(--primary, #06b6d4) 0%, transparent 70%);
      opacity: 0.35;
    }

    .orb-2 {
      width: 900px;
      height: 900px;
      background: radial-gradient(circle, var(--secondary, #8b5cf6) 0%, transparent 70%);
      opacity: 0.32;
    }

    .orb-3 {
      width: 750px;
      height: 750px;
      background: radial-gradient(circle, #ec4899 0%, transparent 70%);
      opacity: 0.28;
    }

    /* Cyberpunk Perspective Floor Grid */
    .perspective-grid {
      position: absolute;
      bottom: 0;
      left: -50%;
      width: 200%;
      height: 55%;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 60px 60px;
      transform: perspective(600px) rotateX(72deg);
      mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent 85%);
      opacity: 0.6;
    }

    .particles-field {
      position: absolute;
      inset: 0;
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 6px #fff;
    }

    /* SCENE COMMON CONTAINERS */
    .scene-container {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 60px;
      z-index: 10;
    }

    /* ACT I: HERO TYPOGRAPHY & EQUALIZER */
    .hero-logo-box {
      position: relative;
      width: 140px;
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    }

    .hex-ring {
      position: absolute;
      border-radius: 35%;
      border: 2px dashed rgba(255, 255, 255, 0.2);
    }

    .ring-outer {
      width: 140px;
      height: 140px;
      border-color: var(--primary, #06b6d4);
      box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
    }

    .ring-inner {
      width: 100px;
      height: 100px;
      border-color: var(--secondary, #8b5cf6);
      box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
    }

    .core-emblem {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      background: linear-gradient(135deg, var(--primary, #06b6d4), var(--secondary, #8b5cf6));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 30px var(--primary, #06b6d4);
    }

    .emblem-symbol {
      font-size: 32px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    }

    .neon-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(12px);
      padding: 6px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .badge-pulsing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }

    .kinetic-title {
      font-size: 76px;
      font-weight: 900;
      letter-spacing: -2px;
      margin: 0 0 16px 0;
      text-align: center;
      line-height: 1.1;
    }

    .gradient-text {
      background: linear-gradient(135deg, #ffffff 10%, #38bdf8 50%, var(--secondary, #c084fc) 90%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 4px 20px rgba(56, 189, 248, 0.3));
    }

    .kinetic-tagline {
      font-size: 22px;
      color: #94a3b8;
      max-width: 800px;
      text-align: center;
      margin: 0 0 36px 0;
      font-weight: 400;
      letter-spacing: 0.5px;
    }

    .audio-waveform-bar {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 56px;
      padding: 6px 16px;
      background: rgba(15, 17, 26, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      backdrop-filter: blur(12px);
    }

    .eq-bar {
      width: 6px;
      min-height: 8px;
      border-radius: 3px;
      transition: height 0.05s ease;
    }

    /* ACT II: GLASS DASHBOARD */
    .scene-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .section-tag {
      font-size: 12px;
      font-weight: 700;
      color: var(--primary, #38bdf8);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .section-title {
      font-size: 48px;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, #ffffff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .glass-dashboard-grid {
      display: flex;
      gap: 28px;
      max-width: 1200px;
      width: 100%;
    }

    .glass-card {
      flex: 1;
      background: rgba(18, 20, 32, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .card-top {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .card-icon-pill {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 1px;
    }

    .live-dot-green {
      color: #10b981;
      font-weight: 700;
      font-size: 12px;
    }

    .metric-badge {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #10b981;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }

    .tag-angular {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #ef4444;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }

    .gauge-center {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .gauge-value {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .big-num {
      font-size: 26px;
      font-weight: 800;
      color: #fff;
    }

    .sub-num {
      font-size: 8px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 1px;
    }

    .card-caption {
      font-size: 13px;
      color: #94a3b8;
      text-align: center;
    }

    .sparkline-box {
      width: 100%;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .card-stat-row {
      width: 100%;
      display: flex;
      justify-content: space-around;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 12px;
    }

    .stat-unit {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
    }

    .stat-val {
      font-size: 14px;
      font-weight: 700;
      color: #f1f5f9;
    }

    .standards-list {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 12px;
    }

    .standard-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.04);
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
    }

    .std-name {
      flex: 1;
      color: #e2e8f0;
    }

    .std-check {
      color: #10b981;
      font-weight: 800;
    }

    /* ACT III: 3D SPATIAL CUBE */
    .spatial-center-stage {
      position: relative;
      width: 600px;
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cube-3d-scene {
      width: 160px;
      height: 160px;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.05s linear;
    }

    .cube-face {
      position: absolute;
      width: 160px;
      height: 160px;
      background: rgba(6, 182, 212, 0.12);
      border: 2px solid var(--primary, #06b6d4);
      box-shadow: inset 0 0 25px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.2);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 2px;
    }

    .cube-face.front  { transform: rotateY(0deg) translateZ(80px); }
    .cube-face.back   { transform: rotateY(180deg) translateZ(80px); }
    .cube-face.right  { transform: rotateY(90deg) translateZ(80px); }
    .cube-face.left   { transform: rotateY(-90deg) translateZ(80px); }
    .cube-face.top    { transform: rotateX(90deg) translateZ(80px); }
    .cube-face.bottom { transform: rotateX(-90deg) translateZ(80px); }

    .orbit-badge {
      position: absolute;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(12px);
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    }

    .badge-top-left  { top: 20px; left: 0; }
    .badge-top-right { top: 20px; right: 0; }
    .badge-bot-left  { bottom: 20px; left: 0; }
    .badge-bot-right { bottom: 20px; right: 0; }

    /* ACT IV: FINALE & TERMINAL */
    .shockwave-ring {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      border: 4px solid var(--primary, #06b6d4);
      box-shadow: 0 0 40px var(--primary, #06b6d4);
      pointer-events: none;
    }

    .finale-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .finale-pill {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #f59e0b;
      margin-bottom: 16px;
    }

    .finale-headline {
      font-size: 58px;
      font-weight: 900;
      letter-spacing: -1.5px;
      margin: 0 0 32px 0;
      background: linear-gradient(135deg, #ffffff 30%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .terminal-window {
      width: 650px;
      background: #0b0f19;
      border: 1px solid #1e293b;
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      margin-bottom: 36px;
      text-align: left;
    }

    .terminal-header {
      height: 36px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 8px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }

    .terminal-title {
      flex: 1;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
    }

    .terminal-body {
      padding: 20px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 14px;
    }

    .term-line {
      display: flex;
      gap: 10px;
      color: #f1f5f9;
      margin-bottom: 10px;
    }

    .term-prompt {
      color: #38bdf8;
      font-weight: 700;
    }

    .term-success {
      color: #10b981;
    }

    .glowing-cta-btn {
      background: linear-gradient(135deg, var(--primary, #06b6d4), var(--secondary, #8b5cf6));
      border: none;
      color: #fff;
      padding: 16px 36px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 1px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 0 35px rgba(6, 182, 212, 0.6);
      cursor: pointer;
    }

    .cta-arrow {
      font-size: 18px;
    }
  `]
})
export class KineticShowcaseComponent {
  @Input() title = 'ANGULAR VIDEO ENGINE';
  @Input() tagline = 'Deterministic, Frame-Accurate Programmatic Video Runtime';
  @Input() badgeText = 'AVE v1.0 KINETIC SHOWCASE';
  @Input() themeColor = '#06b6d4';
  @Input() secondaryColor = '#8b5cf6';

  readonly frame = injectCurrentFrame();
  readonly config = injectVideoConfig();

  protected readonly Math = Math;

  // Dust Particles Array
  readonly particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (i * 3.3) % 100,
    y: (i * 7.7) % 100,
    size: 2 + (i % 3),
    speed: 0.15 + (i % 4) * 0.08,
    baseOpacity: 0.2 + (i % 4) * 0.15
  }));

  // Background Aurora Orbs
  readonly orb1X = computed(() => 50 + 22 * Math.sin(this.frame() * 0.02));
  readonly orb1Y = computed(() => 35 + 18 * Math.cos(this.frame() * 0.025));
  readonly orb1Scale = computed(() => 1.0 + 0.25 * Math.sin(this.frame() * 0.035));

  readonly orb2X = computed(() => 75 + 18 * Math.cos(this.frame() * 0.018));
  readonly orb2Y = computed(() => 65 + 22 * Math.sin(this.frame() * 0.022));
  readonly orb2Scale = computed(() => 1.1 + 0.3 * Math.cos(this.frame() * 0.03));

  readonly orb3X = computed(() => 25 + 25 * Math.sin(this.frame() * 0.015));
  readonly orb3Y = computed(() => 75 + 15 * Math.cos(this.frame() * 0.028));
  readonly orb3Scale = computed(() => 0.95 + 0.2 * Math.sin(this.frame() * 0.025));

  readonly gridOffsetY = computed(() => (this.frame() * 3) % 60);

  // Act I: Equalizer Visualizer Bars
  readonly equalizerBars = computed(() => {
    const f = this.frame();
    const count = 28;
    return Array.from({ length: count }, (_, i) => {
      const freq = Math.abs(
        Math.sin(f * 0.14 + i * 0.45) * Math.cos(f * 0.09 - i * 0.25)
      );
      const height = Math.max(12, Math.min(100, Math.round(15 + freq * 85)));
      const color = i < 14 ? this.themeColor : this.secondaryColor;
      return { height, color };
    });
  });

  // Act II: Circular Gauge & Sparkline Waveform
  readonly gaugePercentage = computed(() => {
    const f = this.frame();
    const p = interpolate(f, [165, 290], [0, 100], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    });
    return Math.round(p);
  });

  readonly gaugeDashOffset = computed(() => {
    const pct = this.gaugePercentage();
    return 283 * (1 - pct / 100);
  });

  readonly springWavePath = computed(() => {
    const f = this.frame();
    const points: string[] = [];
    const width = 240;
    const height = 90;
    const segments = 12;

    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width;
      const angle = (i * 0.8) + (f * 0.12);
      const y = height / 2 + Math.sin(angle) * 26 * Math.cos(f * 0.04);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }

    return points.join(' ');
  });

  // Act III: 3D Isometric Cube Transformation
  readonly cubeTransform = computed(() => {
    const f = this.frame();
    const rotX = -20 + Math.sin(f * 0.03) * 15;
    const rotY = f * 1.4;
    return `perspective(900px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;
  });

  // Act IV: Shockwave Ring
  readonly shockwaveScale = computed(() => {
    const f = this.frame();
    return interpolate(f, [480, 560], [0.4, 3.2], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    });
  });

  readonly shockwaveOpacity = computed(() => {
    const f = this.frame();
    return interpolate(f, [480, 560], [0.8, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    });
  });
}
