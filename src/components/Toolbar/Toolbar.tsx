import { useState, useRef } from 'react';
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
  const shellHistoryRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedInputRef = useRef('');
  const cmds = useAdbCommands();
  const selectedCount = useStore((s) => s.selectedSerials.size);

  async function sendText() {
    if (!text.trim()) return;
    await cmds.sendText(text);
    setText('');
  }

  async function runShell() {
    if (!shellCmd.trim()) return;
    const history = shellHistoryRef.current;
    if (history.length === 0 || history[history.length - 1] !== shellCmd) {
      history.push(shellCmd);
    }
    setHistoryIndex(-1);
    savedInputRef.current = '';
    const results = await cmds.runShell(shellCmd);
    setShellResults(results);
    setShellCmd('');
  }

  function handleShellKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      runShell();
      return;
    }
    const history = shellHistoryRef.current;
    if (history.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex === -1) {
        savedInputRef.current = shellCmd;
        setHistoryIndex(history.length - 1);
        setShellCmd(history[history.length - 1]);
      } else if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setShellCmd(history[historyIndex - 1]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex < history.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setShellCmd(history[historyIndex + 1]);
      } else {
        setHistoryIndex(-1);
        setShellCmd(savedInputRef.current);
      }
    }
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
              onKeyDown={handleShellKeyDown}
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
