export default function Home() {
  return (
    <>
      <style>{`
        /* ── Keyframes ── */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.4); }
          50%      { box-shadow: 0 0 40px rgba(139,92,246,0.7); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }

        /* ── Utility animation classes ── */
        .anim-fade-1 { animation: fadeInUp 0.8s ease-out 0.1s both; }
        .anim-fade-2 { animation: fadeInUp 0.8s ease-out 0.25s both; }
        .anim-fade-3 { animation: fadeInUp 0.8s ease-out 0.4s both; }
        .anim-fade-4 { animation: fadeInUp 0.8s ease-out 0.55s both; }
        .anim-fade-5 { animation: fadeInUp 0.8s ease-out 0.7s both; }
        .anim-fade-6 { animation: fadeInUp 0.8s ease-out 0.85s both; }
        .anim-fade-7 { animation: fadeInUp 0.8s ease-out 1.0s both; }
        .anim-fade-8 { animation: fadeInUp 0.8s ease-out 1.15s both; }

        /* ── Hero gradient text ── */
        .gradient-text {
          background: linear-gradient(135deg, #8B5CF6, #6366F1, #3B82F6, #8B5CF6);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 6s ease infinite;
        }

        /* ── CTA glow ── */
        .cta-btn {
          animation: subtlePulse 3s ease-in-out infinite;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .cta-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 50px rgba(139,92,246,0.8);
        }

        /* ── Glass card ── */
        .glass-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          transition: transform 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease;
        }
        .glass-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 8px 40px rgba(139,92,246,0.15);
          border-color: rgba(139,92,246,0.3);
        }

        /* ── Caption style card ── */
        .caption-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .caption-card:hover {
          transform: scale(1.04);
          border-color: rgba(139,92,246,0.4);
          box-shadow: 0 4px 30px rgba(139,92,246,0.1);
        }

        /* ── Pricing card ── */
        .pricing-card {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          transition: transform 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease;
        }
        .pricing-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 48px rgba(139,92,246,0.15);
          border-color: rgba(139,92,246,0.3);
        }
        .pricing-popular {
          border-color: rgba(139,92,246,0.5);
          background: rgba(139,92,246,0.06);
        }

        /* ── FAQ details ── */
        .faq-item {
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .faq-item summary {
          cursor: pointer;
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 0;
          font-size: 1.1rem;
          font-weight: 500;
          color: #f0f0f0;
          transition: color 0.3s ease;
        }
        .faq-item summary:hover { color: #8B5CF6; }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after {
          content: '+';
          font-size: 1.5rem;
          font-weight: 300;
          color: rgba(255,255,255,0.3);
          transition: transform 0.3s ease, color 0.3s ease;
        }
        .faq-item[open] summary::after {
          transform: rotate(45deg);
          color: #8B5CF6;
        }

        /* ── Step connector ── */
        .step-number {
          width: 56px; height: 56px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #8B5CF6, #6366F1);
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }

        /* ── Floating orb bg ── */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          pointer-events: none;
        }

        /* ── Section spacing ── */
        .section-pad {
          padding-top: 7rem;
          padding-bottom: 7rem;
        }
      `}</style>

      <div className="min-h-screen bg-[#0A0A0B] text-white antialiased overflow-x-hidden" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>

        {/* ═══════════ HERO ═══════════ */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
          {/* Orbs */}
          <div className="orb w-[500px] h-[500px] bg-purple-600 -top-40 -left-40" style={{ position: 'absolute' }} />
          <div className="orb w-[400px] h-[400px] bg-blue-600 -bottom-32 -right-32" style={{ position: 'absolute' }} />
          <div className="orb w-[300px] h-[300px] bg-violet-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ position: 'absolute' }} />

          <div className="relative z-10 max-w-4xl mx-auto">
            <p className="anim-fade-1 text-sm tracking-[0.3em] uppercase text-violet-400/80 mb-6 font-medium">
              AI Video Editing Platform
            </p>
            <h1 className="anim-fade-2 gradient-text text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-[0.9] mb-8">
              Cineflow
            </h1>
            <p className="anim-fade-3 text-lg sm:text-xl md:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-4 font-light">
              Tavo video. AI montažas.<br />
              Kinematografinė kokybė.
            </p>
            <p className="anim-fade-4 text-sm text-white/30 mb-10">
              AI-powered video editing. Cinematic results.
            </p>
            <div className="anim-fade-5">
              <a href="#pricing" className="cta-btn inline-block px-10 py-4 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-lg tracking-wide">
                Pradėti nemokamai
              </a>
            </div>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 anim-fade-7" style={{ animation: 'float 3s ease-in-out infinite, fadeInUp 0.8s ease-out 1.0s both' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        </section>

        {/* ═══════════ FEATURES ═══════════ */}
        <section className="section-pad px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 anim-fade-1">
              <p className="text-sm tracking-[0.25em] uppercase text-violet-400/70 mb-4 font-medium">Funkcijos</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white/95 tracking-tight">
                Viskas, ko reikia{' '}
                <span className="gradient-text">profesionaliam</span> video
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 */}
              <div className="glass-card p-8 anim-fade-2">
                <div className="text-4xl mb-5">🎬</div>
                <h3 className="text-xl font-semibold mb-3 text-white/95">Auto subtitrai</h3>
                <p className="text-white/45 leading-relaxed text-sm">
                  AI automatiškai transkribuoja ir prideda animuotus subtitrus su tobulu tikslumu.
                </p>
              </div>
              {/* Card 2 */}
              <div className="glass-card p-8 anim-fade-3">
                <div className="text-4xl mb-5">✂️</div>
                <h3 className="text-xl font-semibold mb-3 text-white/95">Silence Removal</h3>
                <p className="text-white/45 leading-relaxed text-sm">
                  Automatiškai pašalina tylias pauzes ir sukuria dinamišką, sklandų montažą.
                </p>
              </div>
              {/* Card 3 */}
              <div className="glass-card p-8 anim-fade-4">
                <div className="text-4xl mb-5">🎞️</div>
                <h3 className="text-xl font-semibold mb-3 text-white/95">AI B-Roll</h3>
                <p className="text-white/45 leading-relaxed text-sm">
                  Sugeneruoja ir įterpia kontekstinį B-Roll pagal tavo kalbos turinį.
                </p>
              </div>
              {/* Card 4 */}
              <div className="glass-card p-8 anim-fade-5">
                <div className="text-4xl mb-5">✨</div>
                <h3 className="text-xl font-semibold mb-3 text-white/95">Motion Graphics</h3>
                <p className="text-white/45 leading-relaxed text-sm">
                  Animuotos infografikės, teksto efektai ir vizualiniai akcentai profesionaliam look.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ KAIP VEIKIA ═══════════ */}
        <section className="section-pad px-6 relative">
          <div className="orb w-[350px] h-[350px] bg-violet-600 top-0 right-0" style={{ position: 'absolute' }} />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-20 anim-fade-1">
              <p className="text-sm tracking-[0.25em] uppercase text-violet-400/70 mb-4 font-medium">Procesas</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white/95 tracking-tight">
                Kaip tai{' '}
                <span className="gradient-text">veikia</span>
              </h2>
            </div>

            <div className="space-y-16">
              {/* Step 1 */}
              <div className="flex items-start gap-8 anim-fade-2">
                <div className="step-number">1</div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-white/95">Įkelk video</h3>
                  <p className="text-white/45 leading-relaxed max-w-lg">
                    Tiesiog nutempk savo raw video failą į platformą. Palaikomi visi populiarūs formatai — MP4, MOV, AVI ir daugiau.
                  </p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex items-start gap-8 anim-fade-3">
                <div className="step-number">2</div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-white/95">Pasirink stilių</h3>
                  <p className="text-white/45 leading-relaxed max-w-lg">
                    Išsirink subtitrų stilių, efektus ir montažo nustatymus. Nuo minimalistinio iki MrBeast lygio energijos.
                  </p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex items-start gap-8 anim-fade-4">
                <div className="step-number">3</div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-white/95">Gauk rezultatą</h3>
                  <p className="text-white/45 leading-relaxed max-w-lg">
                    AI sumontuoja tavo video per kelias minutes. Parsisiųsk gatavą, profesionalų video paruoštą publikavimui.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ CAPTION STILIAI ═══════════ */}
        <section className="section-pad px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 anim-fade-1">
              <p className="text-sm tracking-[0.25em] uppercase text-violet-400/70 mb-4 font-medium">Stiliai</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white/95 tracking-tight">
                Subtitrų{' '}
                <span className="gradient-text">stiliai</span>
              </h2>
              <p className="text-white/40 mt-4 text-lg">Pasirink savo vibe. Kiekvienas stilius — unikali estetika.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Default */}
              <div className="caption-card p-6 text-center anim-fade-2">
                <div className="text-3xl mb-3">📝</div>
                <div className="bg-white/10 rounded-lg px-3 py-2 mb-3 text-sm font-medium">
                  Paprastas tekstas
                </div>
                <p className="text-white/70 font-semibold text-sm">Default</p>
                <p className="text-white/30 text-xs mt-1">Švarus, minimalus</p>
              </div>
              {/* Cinematic */}
              <div className="caption-card p-6 text-center anim-fade-3">
                <div className="text-3xl mb-3">🎬</div>
                <div className="rounded-lg px-3 py-2 mb-3 text-sm font-medium" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))' }}>
                  <span style={{ textShadow: '0 0 10px rgba(139,92,246,0.5)' }}>Cinematic text</span>
                </div>
                <p className="text-white/70 font-semibold text-sm">Cinematic</p>
                <p className="text-white/30 text-xs mt-1">Filminis stilius</p>
              </div>
              {/* Hormozi */}
              <div className="caption-card p-6 text-center anim-fade-4">
                <div className="text-3xl mb-3">💰</div>
                <div className="bg-yellow-500/20 rounded-lg px-3 py-2 mb-3 text-sm font-bold text-yellow-300 uppercase">
                  BOLD TEXT
                </div>
                <p className="text-white/70 font-semibold text-sm">Hormozi</p>
                <p className="text-white/30 text-xs mt-1">Bold, in-your-face</p>
              </div>
              {/* TikTok */}
              <div className="caption-card p-6 text-center anim-fade-5">
                <div className="text-3xl mb-3">📱</div>
                <div className="bg-pink-500/20 rounded-lg px-3 py-2 mb-3 text-sm font-bold text-pink-300">
                  trendy text ✨
                </div>
                <p className="text-white/70 font-semibold text-sm">TikTok</p>
                <p className="text-white/30 text-xs mt-1">Viral estetika</p>
              </div>
              {/* MrBeast */}
              <div className="caption-card p-6 text-center anim-fade-6">
                <div className="text-3xl mb-3">🔥</div>
                <div className="bg-red-500/20 rounded-lg px-3 py-2 mb-3 text-sm font-black text-red-300 uppercase tracking-wider">
                  EPIC!
                </div>
                <p className="text-white/70 font-semibold text-sm">MrBeast</p>
                <p className="text-white/30 text-xs mt-1">Maximalus hype</p>
              </div>
              {/* Karaoke */}
              <div className="caption-card p-6 text-center anim-fade-7">
                <div className="text-3xl mb-3">🎤</div>
                <div className="bg-green-500/20 rounded-lg px-3 py-2 mb-3 text-sm font-medium">
                  <span className="text-green-300">word</span>{' '}
                  <span className="text-white/40">by word</span>
                </div>
                <p className="text-white/70 font-semibold text-sm">Karaoke</p>
                <p className="text-white/30 text-xs mt-1">Žodis po žodžio</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ PRICING ═══════════ */}
        <section id="pricing" className="section-pad px-6 relative">
          <div className="orb w-[400px] h-[400px] bg-blue-600 bottom-0 left-0" style={{ position: 'absolute' }} />
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-16 anim-fade-1">
              <p className="text-sm tracking-[0.25em] uppercase text-violet-400/70 mb-4 font-medium">Kainos</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white/95 tracking-tight">
                Paprastos{' '}
                <span className="gradient-text">kainos</span>
              </h2>
              <p className="text-white/40 mt-4 text-lg">Be paslėptų mokesčių. Atšaukyk bet kada.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Free */}
              <div className="pricing-card p-8 anim-fade-2 flex flex-col">
                <p className="text-sm text-white/40 font-medium uppercase tracking-wider mb-2">Free</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white/95">€0</span>
                  <span className="text-white/30 ml-1">/mėn</span>
                </div>
                <ul className="space-y-3 text-sm text-white/50 flex-1 mb-8">
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> 3 video per mėnesį</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Auto subtitrai</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Default stilius</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> 720p eksportas</li>
                  <li className="flex items-center gap-2"><span className="text-white/20">✗</span> <span className="text-white/25">Vandens ženklas</span></li>
                </ul>
                <a href="#" className="block text-center py-3 rounded-full border border-white/10 text-white/60 font-medium text-sm hover:border-violet-500/50 hover:text-white transition-all duration-300">
                  Pradėti nemokamai
                </a>
              </div>

              {/* Creator — Popular */}
              <div className="pricing-card pricing-popular p-8 anim-fade-3 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wider uppercase">
                  Populiariausias
                </div>
                <p className="text-sm text-violet-400 font-medium uppercase tracking-wider mb-2">Creator</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white/95">€25</span>
                  <span className="text-white/30 ml-1">/mėn</span>
                </div>
                <ul className="space-y-3 text-sm text-white/50 flex-1 mb-8">
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> 20 video per mėnesį</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Visi subtitrų stiliai</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Silence removal</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> 1080p eksportas</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Be vandens ženklo</li>
                </ul>
                <a href="#" className="cta-btn block text-center py-3 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm">
                  Pasirinkti Creator
                </a>
              </div>

              {/* Pro */}
              <div className="pricing-card p-8 anim-fade-4 flex flex-col">
                <p className="text-sm text-white/40 font-medium uppercase tracking-wider mb-2">Pro</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white/95">€99</span>
                  <span className="text-white/30 ml-1">/mėn</span>
                </div>
                <ul className="space-y-3 text-sm text-white/50 flex-1 mb-8">
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Neriboti video</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> AI B-Roll generavimas</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Motion graphics</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> 4K eksportas</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Prioritetinis apdorojimas</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> API prieiga</li>
                </ul>
                <a href="#" className="block text-center py-3 rounded-full border border-white/10 text-white/60 font-medium text-sm hover:border-violet-500/50 hover:text-white transition-all duration-300">
                  Pasirinkti Pro
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ FAQ ═══════════ */}
        <section className="section-pad px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16 anim-fade-1">
              <p className="text-sm tracking-[0.25em] uppercase text-violet-400/70 mb-4 font-medium">DUK</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white/95 tracking-tight">
                Dažnai užduodami{' '}
                <span className="gradient-text">klausimai</span>
              </h2>
            </div>

            <div className="anim-fade-2">
              <details className="faq-item">
                <summary>Ar reikia video montažo patirties?</summary>
                <p className="text-white/40 pb-5 leading-relaxed text-sm">
                  Visiškai ne. Cineflow sukurtas taip, kad bet kas galėtų sukurti profesionalų video. Tiesiog įkelk savo filmuotą medžiagą, pasirink stilių, ir AI padarys viską už tave — nuo subtitrų iki montažo.
                </p>
              </details>

              <details className="faq-item">
                <summary>Kiek laiko užtrunka video apdorojimas?</summary>
                <p className="text-white/40 pb-5 leading-relaxed text-sm">
                  Vidutiniškai 2-5 minutės, priklausomai nuo video ilgio ir pasirinkto plano. Pro plano naudotojai gauna prioritetinį apdorojimą — dažniausiai per 1-2 minutes.
                </p>
              </details>

              <details className="faq-item">
                <summary>Kokius video formatus palaikote?</summary>
                <p className="text-white/40 pb-5 leading-relaxed text-sm">
                  Palaikome visus populiarius formatus: MP4, MOV, AVI, MKV, WebM ir daugiau. Eksportas galimas MP4 formatu 720p, 1080p arba 4K raiška, priklausomai nuo plano.
                </p>
              </details>

              <details className="faq-item">
                <summary>Ar galiu atšaukti prenumeratą?</summary>
                <p className="text-white/40 pb-5 leading-relaxed text-sm">
                  Taip, bet kada. Jokių ilgalaikių įsipareigojimų. Atšaukus prenumeratą, galėsi naudotis paslauga iki apmokėto periodo pabaigos. Pinigų grąžinimo garantija per pirmąsias 14 dienų.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ═══════════ CTA ═══════════ */}
        <section className="section-pad px-6 relative overflow-hidden">
          <div className="orb w-[500px] h-[500px] bg-violet-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ position: 'absolute', opacity: 0.1 }} />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white/95 tracking-tight mb-6 anim-fade-1">
              Pasiruošęs{' '}
              <span className="gradient-text">kurti</span>?
            </h2>
            <p className="text-white/40 text-lg mb-10 anim-fade-2 max-w-xl mx-auto">
              Prisijunk prie tūkstančių kūrėjų, kurie jau naudoja Cineflow profesionaliam video montažui.
            </p>
            <div className="anim-fade-3">
              <a href="#pricing" className="cta-btn inline-block px-12 py-4 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-lg tracking-wide">
                Pradėti nemokamai →
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="border-t border-white/5 px-6 py-12">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="gradient-text text-xl font-bold">Cineflow</span>
              <span className="text-white/20 text-sm">© 2026 Cineflow. Visos teisės saugomos.</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/30 hover:text-violet-400 transition-colors text-sm">Twitter</a>
              <a href="#" className="text-white/30 hover:text-violet-400 transition-colors text-sm">Instagram</a>
              <a href="#" className="text-white/30 hover:text-violet-400 transition-colors text-sm">YouTube</a>
              <a href="#" className="text-white/30 hover:text-violet-400 transition-colors text-sm">LinkedIn</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
