import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/landing.css'

const photos = [
  { src: '/images/matteo/20260110_212442.jpg', caption: 'The whole family — Mum, big brother Elliot, and baby Matteo. Before we knew.', date: '10 Jan 2026' },
  { src: '/images/matteo/20260113_151855.jpg', caption: 'The day we noticed something wasn\'t right. Chest asymmetry visible.', date: '13 Jan 2026' },
  { src: '/images/matteo/20260117_181731.jpg', caption: 'Safe in Mum\'s arms at Westmead. Surgery is tomorrow.', date: '17 Jan 2026' },
  { src: '/images/matteo/20260118_105632.jpg', caption: 'A quiet bottle feed before the big day.', date: '18 Jan 2026' },
  { src: '/images/matteo/20260118_212430.jpg', caption: 'Mum and Matteo smiling through it all. Monitors on, spirit up.', date: '18 Jan 2026' },
  { src: '/images/matteo/20260118_223509.jpg', caption: 'Tummy time warrior. Those big eyes taking everything in.', date: '18 Jan 2026' },
  { src: '/images/matteo/20260119_074130.jpg', caption: 'First cuddles with Dad after surgery. Chest bandage and all.', date: '19 Jan 2026' },
  { src: '/images/matteo/20260128_154831.jpg', caption: 'Mum and Matteo with CPAP. Recovery in HDU — getting stronger every day.', date: '28 Jan 2026' },
  { src: '/images/matteo/20260129_104802.jpg', caption: 'A warrior\'s scar. The open-heart surgery incision healing on his dinosaur sheets.', date: '29 Jan 2026' },
  { src: '/images/matteo/20260131_194145.jpg', caption: 'Wide-eyed and alert with Dad. NG tube and bandages — the look of a fighter.', date: '31 Jan 2026' },
  { src: '/images/matteo/20260205_185720.jpg', caption: 'Moved to the ward! Reaching out, CPAP on, surrounded by colourful toys.', date: '5 Feb 2026' },
  { src: '/images/matteo/20260207_132205.jpg', caption: 'Peaceful sleep on Dad\'s chest. NG tube still in, but getting there.', date: '7 Feb 2026' },
  { src: '/images/matteo/20260210_165242.jpg', caption: 'Bouncer time! With the red fox and his name on the whiteboard. Ward life.', date: '10 Feb 2026' },
  { src: '/images/matteo/20260212_172443.jpg', caption: 'Quiet moment in the evening light. Winnie the Pooh keeping him company.', date: '12 Feb 2026' },
  { src: '/images/matteo/20260215_084859.jpg', caption: 'Dad and Matteo hanging out in the ward. Nearly home.', date: '15 Feb 2026' },
  { src: '/images/matteo/20260215_191824.jpg', caption: 'Asleep on Dad\'s chest with his dummy. Pure peace.', date: '15 Feb 2026' },
  { src: '/images/matteo/20260215_193627.jpg', caption: 'The whole crew — knitted blue bear, red fox, and bumble bee on his dinosaur sheets.', date: '15 Feb 2026' },
]

export default function Landing() {
  const [lightbox, setLightbox] = useState(null)

  return (
    <div className="ll-landing">
      {/* Lightbox */}
      {lightbox !== null && (
        <div className="ll-lightbox" onClick={() => setLightbox(null)}>
          <button className="ll-lightbox-close" onClick={() => setLightbox(null)}>&times;</button>
          <button
            className="ll-lightbox-prev"
            onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length) }}
          >
            &lsaquo;
          </button>
          <div className="ll-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={photos[lightbox].src} alt={photos[lightbox].caption} />
            <div className="ll-lightbox-caption">
              <span className="ll-lightbox-date">{photos[lightbox].date}</span>
              {photos[lightbox].caption}
            </div>
          </div>
          <button
            className="ll-lightbox-next"
            onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length) }}
          >
            &rsaquo;
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="ll-hero">
        <span className="ll-hero-icon">&#11088;</span>
        <h1>Every Little Legend Deserves a Tracker</h1>
        <p className="hero-tagline">
          Track medications, feeds, weight, and more for medically complex babies.
          Built by parents who know what it's like to juggle syringes at 3am.
        </p>
        <Link to="/signup" className="hero-cta">
          Start Tracking Free
        </Link>
      </div>

      <div className="ll-landing-content">

        {/* See it in action */}
        <div className="ll-section ll-screenshot-section">
          <div className="ll-section-title">&#128241; See It In Action</div>
          <h2>This Is Matteo's Real Dashboard</h2>
          <p style={{ marginBottom: '24px' }}>
            Not a mockup. Not stock data. The actual app his parents open at 6am, 2pm, and 10pm to keep his
            heart medications on track.
          </p>
          <div className="ll-screenshot-frame">
            <img
              src="/images/dashboard-screenshot.jpg"
              alt="Matteo's dashboard showing next medication, supply alert, today's medication timeline, and feeding stats"
              loading="lazy"
            />
          </div>
          <div className="ll-screenshot-callouts">
            <div className="ll-callout">
              <strong>Supply alerts</strong>
              <span>Captopril expires in 3 days &mdash; reorder reminder right at the top</span>
            </div>
            <div className="ll-callout">
              <strong>Next med, big and clear</strong>
              <span>One glance tells you what's coming and when, even at 3am</span>
            </div>
            <div className="ll-callout">
              <strong>Today at a glance</strong>
              <span>5 of 10 doses given, 3 feeds, 370mL total &mdash; before you've finished your coffee</span>
            </div>
            <div className="ll-callout">
              <strong>Crossed-off timeline</strong>
              <span>Visual proof of every dose given, so the other parent knows instantly</span>
            </div>
          </div>
        </div>

        {/* Why Section */}
        <div className="ll-section">
          <div className="ll-section-title">&#128149; Why Little Legend Tracker</div>
          <h2>Built by Parents, For Parents</h2>
          <div className="ll-why-grid">
            <div className="ll-why-card">
              <span className="ll-why-icon">&#128164;</span>
              <div>
                <h3>Sleep-Deprived Friendly UX</h3>
                <p>
                  Big buttons, clear labels, minimal steps. Designed so you can log a med
                  dose one-handed at 2am without thinking twice.
                </p>
              </div>
            </div>
            <div className="ll-why-card">
              <span className="ll-why-icon">&#128101;</span>
              <div>
                <h3>Real-Time Multi-Parent Sync</h3>
                <p>
                  Both parents see live updates instantly. No more texting
                  "did you give the aspirin?" — just check the app.
                </p>
              </div>
            </div>
            <div className="ll-why-card">
              <span className="ll-why-icon">&#128241;</span>
              <div>
                <h3>Works Offline on Your Phone</h3>
                <p>
                  Hospital WiFi unreliable? No worries. Log everything offline
                  and it syncs when you're back online.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="ll-section">
          <div className="ll-section-title">&#9889; Features</div>
          <h2>Everything You Need</h2>
          <div className="ll-feature-grid">
            <div className="ll-feature-card">
              <span className="ll-feature-icon">&#128138;</span>
              <h3>Medications</h3>
              <p>Track doses, schedules, and who gave what</p>
            </div>
            <div className="ll-feature-card">
              <span className="ll-feature-icon">&#127868;</span>
              <h3>Feeding</h3>
              <p>Log bottle, breast, and NG feeds with amounts</p>
            </div>
            <div className="ll-feature-card">
              <span className="ll-feature-icon">&#9878;&#65039;</span>
              <h3>Weight</h3>
              <p>Chart weight over time with visual trends</p>
            </div>
            <div className="ll-feature-card">
              <span className="ll-feature-icon">&#128203;</span>
              <h3>Custom Trackers</h3>
              <p>Track nappies, temperature, oxygen — anything</p>
            </div>
            <div className="ll-feature-card">
              <span className="ll-feature-icon">&#128196;</span>
              <h3>PDF Reports</h3>
              <p>Generate summaries for doctors and specialists</p>
            </div>
            <div className="ll-feature-card">
              <span className="ll-feature-icon">&#128106;</span>
              <h3>Multi-Parent</h3>
              <p>Invite your partner with a family PIN code</p>
            </div>
          </div>
        </div>

        {/* Matteo's Story */}
        <div className="ll-section">
          <div className="ll-section-title">&#128153; The Origin Story</div>
          <h2>The Story Behind Little Legend Tracker</h2>
          <p>
            Matteo Norman was born in August 2025 on the Central Coast, Australia.
            A happy, healthy baby who loved cuddles and was hitting every milestone.
            Then in January 2026, everything changed.
          </p>

          <div className="ll-story-highlight">
            <h3>What is ALCAPA?</h3>
            <p>
              <strong>ALCAPA</strong> (Anomalous Left Coronary Artery from the Pulmonary Artery)
              is a rare congenital heart defect where the left coronary artery connects to the
              pulmonary artery instead of the aorta, starving the heart of oxygen-rich blood.
            </p>
            <p>
              Matteo's heart had been underperfused from birth. His left ventricle was weakening,
              his mitral valve was stretched, and his heart was working at half capacity — yet
              he still appeared to be a completely happy baby. That's what made it so terrifying.
            </p>
          </div>

          {/* Condensed Timeline */}
          <div className="ll-timeline" style={{ marginTop: '20px' }}>
            <div className="ll-timeline-item">
              <div className="ll-timeline-date">August 2025</div>
              <div className="ll-timeline-title">Matteo is Born</div>
              <div className="ll-timeline-desc">A healthy birth on the Central Coast. No issues detected.</div>
            </div>
            <div className="ll-timeline-item highlight">
              <div className="ll-timeline-date">15 January 2026</div>
              <div className="ll-timeline-title">Diagnosis: ALCAPA</div>
              <div className="ll-timeline-desc">X-ray reveals an enlarged heart. Echocardiogram confirms ALCAPA. Transferred to Westmead Children's Hospital.</div>
            </div>
            <div className="ll-timeline-item highlight">
              <div className="ll-timeline-date">18-19 January 2026</div>
              <div className="ll-timeline-title">Open-Heart Surgery</div>
              <div className="ll-timeline-desc">Coronary reimplantation — reconnecting the left coronary artery to the aorta. The surgery was a success.</div>
            </div>
            <div className="ll-timeline-item">
              <div className="ll-timeline-date">19-31 January 2026</div>
              <div className="ll-timeline-title">ICU &amp; HDU Recovery</div>
              <div className="ll-timeline-desc">Sedation, ventilation, chest closure, extubation, and progressive improvement. No ECMO needed.</div>
            </div>
            <div className="ll-timeline-item highlight">
              <div className="ll-timeline-date">19 February 2026</div>
              <div className="ll-timeline-title">Home!</div>
              <div className="ll-timeline-desc">Discharged at 6.01kg with 6 medications and a heart full of love. The real recovery begins at home.</div>
            </div>
          </div>

          {/* Recovery */}
          <div className="ll-recovery-banner">
            <div className="recovery-icon">&#127803;</div>
            <p>
              Recovery after ALCAPA repair takes 3-12 months. His heart needs time to strengthen
              now that proper blood flow is restored.
            </p>
            <p className="recovery-quote">
              The surgery turned the tap on. The water is flowing.
              But the garden doesn't green up overnight.
            </p>
          </div>
        </div>

        {/* Personality */}
        <div className="ll-section">
          <div className="ll-section-title">&#11088; Little Legend Moments</div>
          <h2>Things That Made Us Smile</h2>
          <div className="ll-personality-grid">
            <div className="ll-personality-item">
              <span className="p-icon">&#128268;</span>
              Pulled his own central line out (self-discharged his IV!)
            </div>
            <div className="ll-personality-item">
              <span className="p-icon">&#128548;</span>
              Gamed the CPAP by positioning it over one nostril
            </div>
            <div className="ll-personality-item">
              <span className="p-icon">&#129528;</span>
              Surrounded by his crew — blue bear, red fox, bumble bee
            </div>
            <div className="ll-personality-item">
              <span className="p-icon">&#128214;</span>
              Dad read him books in the play area every night
            </div>
            <div className="ll-personality-item">
              <span className="p-icon">&#129429;</span>
              Dinosaur bedsheets in his hospital cot
            </div>
            <div className="ll-personality-item">
              <span className="p-icon">&#129303;</span>
              First real cuddles on dad's chest after being untethered from lines
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        <div className="ll-section">
          <div className="ll-section-title">&#128248; The Journey in Photos</div>
          <h2>Through Our Eyes</h2>
          <p style={{ marginBottom: '16px' }}>
            From the day we first noticed something was wrong, through surgery, recovery, and coming home.
          </p>
          <div className="ll-gallery">
            {photos.map((photo, i) => (
              <div key={i} className="ll-gallery-item" onClick={() => setLightbox(i)}>
                <img src={photo.src} alt={photo.caption} loading="lazy" />
                <div className="ll-gallery-overlay">
                  <span className="ll-gallery-date">{photo.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thank You */}
        <div className="ll-section ll-thank-you-section">
          <div className="ll-section-title">&#128591; Thank You</div>
          <h2>We Couldn't Have Done This Without You</h2>
          <p>
            Our family owes so much to the incredible people who carried us through the scariest
            time of our lives.
          </p>
          <div className="ll-thank-you-grid">
            <div className="ll-thank-you-card">
              <span className="ty-icon">&#127973;</span>
              <h3>Dr Johann Brink</h3>
              <p>
                Paediatric Cardiothoracic Surgeon at the Heart Centre for Children, The Children's Hospital at Westmead.
                For your steady hands and incredible skill performing Matteo's coronary reimplantation surgery.
                You gave our son his heart back.
              </p>
            </div>
            <div className="ll-thank-you-card">
              <span className="ty-icon">&#128104;&#8205;&#9877;&#65039;</span>
              <h3>Dr Greg Kelly</h3>
              <p>
                For really helping us understand what was happening and taking the time to just listen.
                When everything felt overwhelming, your patience and clarity made all the difference.
              </p>
            </div>
            <div className="ll-thank-you-card">
              <span className="ty-icon">&#129657;</span>
              <h3>PICU — Helen McMillan Ward</h3>
              <p>
                The incredible team in the Paediatric Intensive Care Unit at Westmead.
                You kept our boy safe through the most critical hours after surgery.
              </p>
            </div>
            <div className="ll-thank-you-card">
              <span className="ty-icon">&#128153;</span>
              <h3>Cardiac Ward — Edgar Stephen Ward</h3>
              <p>
                The doctors, nurses, and specialists on ESW who cared for Matteo through his recovery.
                Your warmth and expertise were extraordinary.
              </p>
            </div>
            <div className="ll-thank-you-card">
              <span className="ty-icon">&#127968;</span>
              <h3>Ronald McDonald House</h3>
              <p>
                For giving our family a home away from home during the hardest weeks of our lives.
                A warm bed, meals, and the comfort of knowing we were close to Matteo.
              </p>
              <a href="https://www.rmhc.org.au/donate" target="_blank" rel="noopener noreferrer" className="ll-donate-link">
                Donate to RMHC
              </a>
            </div>
            <div className="ll-thank-you-card">
              <span className="ty-icon">&#128155;</span>
              <h3>CCKIN — Central Coast Kids in Need</h3>
              <p>
                For covering our costs at Ronald McDonald House. Your generosity meant
                we could focus entirely on Matteo's recovery without worrying about accommodation.
              </p>
              <a href="https://www.cckin.com.au/" target="_blank" rel="noopener noreferrer" className="ll-donate-link">
                Support CCKIN
              </a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="ll-section ll-cta-section">
          <h2>Start Tracking in 60 Seconds</h2>
          <p>Free for families, forever.</p>
          <Link to="/signup" className="ll-cta-btn">
            Create Your Free Account
          </Link>
          <p className="ll-cta-note">No credit card. No ads. Just care.</p>
        </div>

        {/* Footer */}
        <div className="ll-footer">
          <p>Little Legend Tracker — Built with love by Matteo's family</p>
          <p style={{ marginTop: '8px' }}>
            <Link to="/login">Family Login</Link>
            {' · '}
            <Link to="/privacy">Privacy Policy</Link>
            {' · '}
            <Link to="/terms">Terms of Service</Link>
          </p>
        </div>

      </div>
    </div>
  )
}
