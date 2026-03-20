import { useState } from 'react';
import { useAdbCommands } from '../../hooks/useAdbCommands';
import { useStore } from '../../store';
import type { CommandResult } from '../../types';
import styles from './Toolbar.module.css';

const KEYS = [
  { label: '⌂', title: 'Home', code: 3 },
  { label: '◁', title: 'Back', code: 4 },
  { label: '□', title: 'Recents', code: 187 },
  { label: '⏻', title: 'Power', code: 26 },
];

type Mode = 'text' | 'shell';

export function Toolbar() {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [shellCmd, setShellCmd] = useState('');
  const [shellResults, setShellResults] = useState<CommandResult[] | null>(null);
  const cmds = useAdbCommands();
  const selectedCount = useStore((s) => s.selectedSerials.size);

  async function sendText() {
    if (!text.trim()) return;
    await cmds.sendText(text);
    setText('');
  }

  async function runShell() {
    if (!shellCmd.trim()) return;
    const results = await cmds.runShell(shellCmd);
    setShellResults(results);
  }

  return (
    <div className={styles.toolbarWrap}>
      {/* Shell results overlay */}
      {shellResults && (
        <div className={styles.shellResults}>
          <div className={styles.shellResultsHeader}>
            <span>Shell Output ({shellResults.length} devices)</span>
            <button className={styles.shellCloseBtn} onClick={() => setShellResults(null)}>x</button>
          </div>
          <div className={styles.shellResultsList}>
            {shellResults.map((r) => (
              <div key={r.serial} className={styles.shellResultItem}>
                <span className={`${styles.shellSerial} ${r.success ? styles.shellOk : styles.shellErr}`}>
                  {r.serial}
                </span>
                <pre className={styles.shellOutput}>{r.message || '(no output)'}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.selBadge}>
          {selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}
        </div>

        <div className={styles.keyBtns}>
          {KEYS.map((k) => (
            <button
              key={k.code}
              className={styles.keyBtn}
              title={k.title}
              onClick={() => cmds.keyevent(k.code)}
              disabled={selectedCount === 0}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === 'text' ? styles.modeActive : ''}`}
            onClick={() => setMode('text')}
          >
            Text
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'shell' ? styles.modeActive : ''}`}
            onClick={() => setMode('shell')}
          >
            Shell
          </button>
        </div>

        {mode === 'text' ? (
          <div className={styles.textRow}>
            <input
              className={styles.textInput}
              placeholder="Type text to send..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendText()}
              disabled={selectedCount === 0}
            />
            <button
              className={styles.sendBtn}
              onClick={sendText}
              disabled={selectedCount === 0 || !text.trim()}
            >
              Send
            </button>
          </div>
        ) : (
          <div className={styles.textRow}>
            <input
              className={styles.textInput}
              placeholder="adb shell command..."
              value={shellCmd}
              onChange={(e) => setShellCmd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runShell()}
              disabled={selectedCount === 0}
            />
            <button
              className={styles.runBtn}
              onClick={runShell}
              disabled={selectedCount === 0 || !shellCmd.trim()}
            >
              Run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
