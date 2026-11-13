import { useEffect, useMemo, useState } from 'react';
import { Penflow } from 'penflow/react';

const fonts = [
  { name: 'Brittany Signature', url: '/fonts/BrittanySignature.ttf' },
  { name: 'Arizonia', url: '/fonts/arizonia/Arizonia-Regular.ttf' },
  { name: 'Mr De Haviland', url: '/fonts/mrdehaviland/MrDeHaviland-Regular.ttf' },
  { name: 'Monsieur La Doulaise', url: '/fonts/monsieurladoulaise/MonsieurLaDoulaise-Regular.ttf' },
  { name: 'Mrs Saint Delafield', url: '/fonts/mrssaintdelafield/MrsSaintDelafield-Regular.ttf' },
] as const;

const qualities = ['calm', 'balanced', 'snappy'] as const;
type Quality = (typeof qualities)[number];

const installTabs = ['npm', 'pnpm', 'yarn', 'bun'] as const;
type InstallTab = (typeof installTabs)[number];

const installCommands: Record<InstallTab, string> = {
  npm: 'npm i penflow',
  pnpm: 'pnpm add penflow',
  yarn: 'yarn add penflow',
  bun: 'bun add penflow'
};

const wrapLine = (line: string, maxChars = 28): string[] => {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
    else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
};

const wrapForDemo = (input: string, maxChars = 28): string =>
  input
    .split('\n')
    .flatMap((line) => wrapLine(line, maxChars))
    .join('\n');

export default function App() {
  const [text, setText] = useState(`handwriting matters.\nanimation should feel authored.`);
  const [fontUrl, setFontUrl] = useState<string>(fonts[0].url);
  const [quality, setQuality] = useState<Quality>('balanced');
  const [playheadKey, setPlayheadKey] = useState(0);
  const [demoReady, setDemoReady] = useState(false);
  const [installTab, setInstallTab] = useState<InstallTab>('npm');
  const [installCopied, setInstallCopied] = useState(false);
  const [usageCopied, setUsageCopied] = useState(false);

  const reactUsageCode = `import { Penflow } from 'penflow/react';

<Penflow
  text="hello world"
  fontUrl="${fontUrl}"
  quality="${quality}"
/>`;

  const wrappedText = useMemo(() => wrapForDemo(text, 28), [text]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDemoReady(true);
      setPlayheadKey((x) => x + 1);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, []);

  const onReplay = () => {
    setDemoReady(true);
    setPlayheadKey((x) => x + 1);
  };

  const copy = async (value: string, type: 'install' | 'usage') => {
    try {
      await navigator.clipboard.writeText(value);
      if (type === 'install') {
        setInstallCopied(true);
        window.setTimeout(() => setInstallCopied(false), 900);
      } else {
        setUsageCopied(true);
        window.setTimeout(() => setUsageCopied(false), 900);
      }
    } catch {
      // no-op
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <div className="wordmark">
          <Penflow
            text="penflow"
            fontUrl={fonts[0].url}
            size={68}
            quality="balanced"
            brushScale={0.072}
            seed="wordmark"
            color="#ffffff"
            animate
            incremental={false}
          />
        </div>
        <p>Contour-driven handwriting animation with streaming timing and font-aware brush profiles.</p>
      </section>

      <section className="demo">
        <Penflow
          key={fontUrl}
          text={demoReady ? wrappedText : ''}
          fontUrl={fontUrl}
          brushScale={0.072}
          quality={quality}
          playheadKey={playheadKey}
          seed="site-seed"
          color="#ffffff"
        />
      </section>

      <section className="controls">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <div className="bar">
          <select aria-label="Font" value={fontUrl} onChange={(e) => {
            setFontUrl(e.target.value);
            onReplay();
          }}>
            {fonts.map((font) => (
              <option key={font.url} value={font.url}>
                {font.name}
              </option>
            ))}
          </select>
          <select aria-label="Animation quality" value={quality} onChange={(e) => {
            setQuality(e.target.value as Quality);
            onReplay();
          }}>
            {qualities.map((value) => (
              <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>
            ))}
          </select>
          <button className="reset" onClick={onReplay}>
            Replay
          </button>
        </div>
      </section>

      <section className="docs">
        <h3>Install</h3>
        <div className="tabs">
          {installTabs.map((tab) => (
            <button key={tab} type="button" className={`tabBtn ${installTab === tab ? 'active' : ''}`} onClick={() => setInstallTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="codeRow">
          <code>$ {installCommands[installTab]}</code>
          <button type="button" className="copyBtn" onClick={() => copy(installCommands[installTab], 'install')}>
            {installCopied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <h3>Usage</h3>
        <div className="pills">
          <span className="pill active">React</span>
        </div>
        <div className="codeBlock">
          <pre>{reactUsageCode}</pre>
          <button type="button" className="copyBtn" onClick={() => copy(reactUsageCode, 'usage')}>
            {usageCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </section>

      <footer className="footer">
        <p>
          Inspiration from{' '}
          <a href="https://lochie.me/" target="_blank" rel="noreferrer">
            Lochie Axon
          </a>
        </p>
        <p>
          Crafted by{' '}
          <a href="https://twitter.com/cristicrtu" target="_blank" rel="noreferrer">
            Cristian Cretu
          </a>
        </p>
        <p className="footerLinks">
          <a href="https://www.npmjs.com/package/penflow" target="_blank" rel="noreferrer">
            npm
          </a>
          <span> • </span>
          <a href="https://github.com/cristicretu/penflow" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}
