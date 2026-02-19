import { useEffect, useMemo, useState } from 'react';
import { Penflow } from '@cristicretu/penflow/react';

const fonts = [
  { name: 'Brittany Signature', url: '/fonts/BrittanySignature.ttf' },
  { name: 'Helvetica', url: '/fonts/Helvetica.ttc' },
  { name: 'Menlo', url: '/fonts/Menlo.ttc' },
  { name: 'Monaco', url: '/fonts/Monaco.ttf' },
  { name: 'New York', url: '/fonts/NewYork.ttf' },
  { name: 'SF Pro Rounded', url: '/fonts/SFNSRounded.ttf' }
] as const;

const installTabs = ['npm', 'pnpm', 'yarn', 'bun'] as const;
type InstallTab = (typeof installTabs)[number];

const installCommands: Record<InstallTab, string> = {
  npm: 'npm i @cristicretu/penflow',
  pnpm: 'pnpm add @cristicretu/penflow',
  yarn: 'yarn add @cristicretu/penflow',
  bun: 'bun add @cristicretu/penflow'
};

const reactUsageCode = `import { Penflow } from '@cristicretu/penflow/react';\n\n<Penflow text="hello world" fontUrl="/fonts/BrittanySignature.ttf" />`;

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
  const [fontUrl, setFontUrl] = useState(fonts[0].url);
  const [quality, setQuality] = useState<'calm' | 'balanced' | 'snappy'>('balanced');
  const [playheadKey, setPlayheadKey] = useState(0);
  const [demoReady, setDemoReady] = useState(false);
  const [installTab, setInstallTab] = useState<InstallTab>('npm');
  const [installCopied, setInstallCopied] = useState(false);
  const [usageCopied, setUsageCopied] = useState(false);

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
            fontUrl="/fonts/BrittanySignature.ttf"
            size={68}
            speed={1.2}
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
          text={demoReady ? wrappedText : ''}
          fontUrl={fontUrl}
          quality={quality}
          brushScale={0.072}
          speed={1}
          playheadKey={playheadKey}
          seed="site-seed"
          color="#ffffff"
        />
      </section>

      <section className="controls">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <div className="bar">
          <select value={fontUrl} onChange={(e) => setFontUrl(e.target.value)}>
            {fonts.map((font) => (
              <option key={font.url} value={font.url}>
                {font.name}
              </option>
            ))}
          </select>
          <select value={quality} onChange={(e) => setQuality(e.target.value as 'calm' | 'balanced' | 'snappy')}>
            <option value="calm">calm</option>
            <option value="balanced">balanced</option>
            <option value="snappy">snappy</option>
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
      </footer>
    </main>
  );
}
