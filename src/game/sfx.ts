/**
 * Casino floor built from Web Audio only.
 * Levels sit under a compressor so the room, the dice, and a cheer can play together
 * without the harsh square-wave pile-up of a toy sound font.
 */
export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private rustle: { osc: OscillatorNode; gain: GainNode } | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  on = true;
  crowd = true;
  vol = 0.7;
  heat = 0;
  private amb = 0;
  private started = false;

  ensure(): boolean {
    if (!this.on) return false;
    if (!this.ctx) {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const C = W.AudioContext || W.webkitAudioContext;
      if (!C) return false;
      try {
        this.ctx = new C();
      } catch {
        return false;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.vol;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -16;
      this.comp.knee.value = 20;
      this.comp.ratio.value = 3.2;
      this.comp.attack.value = 0.008;
      this.comp.release.value = 0.28;
      this.master.connect(this.comp);
      this.comp.connect(c.destination);
      const len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.started = true;
      this.loadVoices();
      this.ambience();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  setHeat(level: number): void {
    this.heat = Math.max(0, Math.min(1, level));
  }

  setVol(v: number): void {
    this.vol = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setOn(b: boolean): void {
    this.on = b;
    if (!b) {
      this.rustleStop();
      if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
    } else this.ensure();
  }

  stopAll(): void {
    window.clearTimeout(this.amb);
    this.rustleStop();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.noise = null;
    this.started = false;
  }

  private loadVoices(): void {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const grab = () => {
      this.voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
    };
    grab();
    synth.addEventListener("voiceschanged", grab);
  }

  /** Slot tunes and spoken floor noise. No looping filtered noise. Heat makes the yells come faster. */
  private ambience(): void {
    const again = (): void => {
      const gap = 5600 - this.heat * 4200 + Math.random() * 900;
      this.amb = window.setTimeout(again, Math.max(800, gap));
      if (!this.on || !this.ctx || this.ctx.state !== "running") return;
      const yell = this.heat > 0.35 && Math.random() < 0.25 + this.heat * 0.45;
      if (yell && this.crowd) this.floorTalk("yell");
      else if (Math.random() < 0.62) this.slotJingle();
      else if (this.crowd) this.floorTalk("talk");
    };
    again();
  }

  private slotJingle(): void {
    const pan = Math.random() * 1.2 - 0.6;
    const motifs = [
      [784, 988, 1175, 1568],
      [659, 784, 1047, 1319],
      [880, 1175, 880, 1760],
      [523, 659, 784, 1047, 784],
    ];
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    motif.forEach((f, i) => this.tone(f, 0.11, i % 2 ? "triangle" : "sine", 0.02, i * 0.09, 0, pan));
    this.tone(motif[motif.length - 1] * 2, 0.16, "sine", 0.012, motif.length * 0.09, 0, pan);
  }

  private floorTalk(kind: "talk" | "yell" | "groan"): void {
    const synth = window.speechSynthesis;
    if (!synth || synth.speaking) return;
    const lines = {
      talk: ["Place your bets.", "Come on now.", "Looking good.", "One more time.", "Let's see it.", "Nice and easy."],
      yell: ["Yeah!", "Winner!", "That's it!", "Wooo!", "Pay the line!", "Here we go!"],
      groan: ["Oh no. Seven out.", "Aww, seven.", "That's a seven out."],
    }[kind];
    const text = lines[Math.floor(Math.random() * lines.length)];
    const u = new SpeechSynthesisUtterance(text);
    if (this.voices.length) u.voice = this.voices[Math.floor(Math.random() * this.voices.length)];
    u.rate = kind === "yell" ? 1.15 + Math.random() * 0.2 : kind === "groan" ? 0.85 : 0.95 + Math.random() * 0.15;
    u.pitch = kind === "yell" ? 1.15 + Math.random() * 0.35 : kind === "groan" ? 0.65 + Math.random() * 0.15 : 0.8 + Math.random() * 0.4;
    u.volume = Math.min(1, this.vol * (kind === "yell" ? 0.9 : 0.55));
    synth.speak(u);
  }

  private tone(f: number, dur: number, type: OscillatorType, gain: number, at = 0, slide = 0, pan?: number): void {
    const c = this.ctx;
    if (!c || !this.master || !this.on) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, f), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    this.out(g, pan);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private nz(dur: number, type: BiquadFilterType, f: number, q: number, gain: number, at = 0, f2 = 0, attack = 0.004, pan?: number): void {
    const c = this.ctx;
    if (!c || !this.master || !this.noise || !this.on) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(Math.max(40, f), t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    this.out(g, pan);
    s.start(t, Math.random());
    s.stop(t + dur + 0.04);
  }

  private out(node: AudioNode, pan?: number): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (pan !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      p.connect(this.master);
    } else node.connect(this.master);
  }

  rustleStart(): void {
    if (!this.ensure() || !this.ctx || !this.master || this.rustle) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 220;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.rustle = { osc, gain };
  }

  rustleSet(level: number): void {
    if (!this.rustle || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.rustle.osc.frequency.setTargetAtTime(180 + level * 420, t, 0.05);
    this.rustle.gain.gain.setTargetAtTime(0.012 + level * 0.02, t, 0.05);
  }

  rustleStop(): void {
    if (!this.rustle || !this.ctx) {
      this.rustle = null;
      return;
    }
    const t = this.ctx.currentTime;
    this.rustle.gain.gain.cancelScheduledValues(t);
    this.rustle.gain.gain.setTargetAtTime(0.0001, t, 0.03);
    try {
      this.rustle.osc.stop(t + 0.08);
    } catch {
      // already stopped
    }
    this.rustle = null;
  }

  whoosh(power: number): void {
    if (!this.ensure()) return;
    const p = Math.max(0, Math.min(1, power));
    this.nz(0.42 + p * 0.2, "bandpass", 220, 0.7, 0.09 + p * 0.05, 0, 1600 + p * 1400, 0.03);
    this.tone(90, 0.28, "sine", 0.06 + p * 0.04, 0, 48);
  }

  rattle(dur: number, power: number): void {
    if (!this.ensure()) return;
    const p = Math.max(0, Math.min(1, power));
    let t = 0;
    while (t < dur) {
      const k = 1 - t / Math.max(0.2, dur);
      this.nz(0.018, "bandpass", 2400 + Math.random() * 2800, 5, (0.02 + 0.03 * p) * (0.35 + 0.65 * k), t, 0, 0.002, Math.random() * 0.6 - 0.3);
      t += 0.045 + Math.random() * 0.05;
    }
  }

  thunk(): void {
    if (!this.ensure()) return;
    this.tone(78, 0.2, "sine", 0.16, 0, 42);
    this.nz(0.09, "lowpass", 240, 0.6, 0.1);
  }

  clack(): void {
    if (!this.ensure()) return;
    this.nz(0.02, "bandpass", 3200, 4, 0.04);
  }

  button(): void {
    if (!this.ensure()) return;
    this.nz(0.012, "highpass", 1800, 0.7, 0.04);
    this.tone(160, 0.03, "sine", 0.03);
  }

  chip(): void {
    if (!this.ensure()) return;
    this.nz(0.016, "bandpass", 4200, 3, 0.055);
    this.tone(2500, 0.03, "triangle", 0.02, 0.012, 1400);
  }

  winJingle(big: boolean): void {
    if (!this.ensure()) return;
    const notes = big ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.22, "sine", 0.04, i * 0.09));
  }

  tickUp(steps: number): void {
    if (!this.ensure()) return;
    const n = Math.max(2, Math.min(8, steps));
    for (let i = 0; i < n; i++) this.tone(1500 + i * 40, 0.035, "triangle", 0.018, 0.28 + i * 0.055, 900);
  }

  lossTone(): void {
    if (!this.ensure()) return;
    this.tone(196, 0.42, "sine", 0.05, 0, 98);
  }

  cheer(heat: number, big: boolean): void {
    if (!this.ensure() || !this.crowd) return;
    this.slotJingle();
    if (heat > 0.2 || big) this.floorTalk(big ? "yell" : "talk");
  }

  groan(): void {
    if (!this.ensure() || !this.crowd) return;
    this.tone(146, 0.45, "sine", 0.05, 0, 90);
    this.floorTalk("groan");
  }

  noMore(): void {
    if (!this.ensure()) return;
    this.tone(620, 0.1, "sine", 0.04);
    this.tone(466, 0.18, "sine", 0.035, 0.1);
  }

  get alive(): boolean {
    return this.started;
  }
}

export function speak(text: string): void {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 0.92;
    window.speechSynthesis.speak(u);
  } catch {
    // voice is optional
  }
}
