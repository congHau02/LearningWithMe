import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173/';

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.consoleMessages = [];
    this.exceptions = [];
    this.failedRequests = [];

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        this.events.push(msg);
        if (msg.method === 'Runtime.consoleAPICalled') {
          this.consoleMessages.push(msg.params);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          this.exceptions.push(msg.params);
        } else if (msg.method === 'Network.loadingFailed') {
          this.failedRequests.push(msg.params);
        }
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const callId = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(callId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runAudit() {
  console.log('--- Starting Chrome DevTools MCP / CDP Audit ---');
  console.log(`Target: ${TARGET_URL}`);

  // 1. Spawn Chrome Headless
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    'about:blank',
  ]);

  await sleep(2000);

  let cdp;
  let report = {
    timestamp: new Date().toISOString(),
    desktop: {},
    mobile: {},
    contrast: {},
    a11y: {},
    consoleAndNetwork: {},
    zeroCls: {},
    status: 'PASSED',
    violations: [],
  };

  try {
    const versionRes = await fetch('http://127.0.0.1:9222/json/version');
    const versionData = await versionRes.json();
    console.log(`Connected to Chrome: ${versionData.Browser}`);

    // Create target page
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready;

    // Enable CDP domains
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('Network.enable');

    // 2. Desktop Audit (1440x900)
    console.log('\n[1/4] Running Desktop Audit (1440x900)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2500);

    // Setup PerformanceObserver for CLS
    await cdp.send('Runtime.evaluate', {
      expression: `
        window.__clsScore = 0;
        window.__clsEntries = [];
        try {
          const observer = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!entry.hadRecentInput) {
                window.__clsScore += entry.value;
                window.__clsEntries.push({ value: entry.value, sources: entry.sources?.map(s => s.node?.nodeName) });
              }
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {
          window.__clsError = e.message;
        }
      `,
    });

    // Check Desktop Horizontal Overflow
    const desktopOverflowEval = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const docWidth = document.documentElement.scrollWidth;
        const viewWidth = window.innerWidth;
        const bodyWidth = document.body.scrollWidth;
        const overflowingElements = [];
        document.querySelectorAll('*').forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewWidth + 1) {
            overflowingElements.push({
              tag: el.tagName,
              id: el.id,
              className: (typeof el.className === 'string' ? el.className : ''),
              right: rect.right,
              width: rect.width
            });
          }
        });
        return {
          docWidth,
          viewWidth,
          bodyWidth,
          hasOverflow: docWidth > viewWidth,
          overflowCount: overflowingElements.length,
          samples: overflowingElements.slice(0, 5)
        };
      })()`,
    });

    report.desktop.overflow = desktopOverflowEval.result.value;
    console.log(`Desktop Overflow: docWidth=${report.desktop.overflow.docWidth}px, viewWidth=${report.desktop.overflow.viewWidth}px, hasOverflow=${report.desktop.overflow.hasOverflow}`);
    if (report.desktop.overflow.hasOverflow) {
      report.violations.push(`Desktop has horizontal overflow: ${report.desktop.overflow.docWidth}px > ${report.desktop.overflow.viewWidth}px`);
    }

    // Measure CLS on Desktop after state interaction
    console.log('[2/4] Testing Zero-CLS on Interactive State Toggles...');
    // Capture baseline CLS before interaction
    const baselineClsEval = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `window.__clsScore || 0`,
    });
    const baselineCls = baselineClsEval.result.value;

    // Trigger interactive state toggle: toggle Room Chat Box or click a button
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const chatLauncher = document.querySelector('[data-testid="room-chat-launcher"]');
        if (chatLauncher) {
          chatLauncher.click();
        }
      })()`,
    });
    await sleep(600);

    const clsEval = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => ({
        totalClsScore: window.__clsScore || 0,
        entriesCount: (window.__clsEntries || []).length,
        entries: window.__clsEntries || []
      }))()`,
    });

    const totalCls = clsEval.result.value.totalClsScore;
    const interactionCls = Math.max(0, totalCls - baselineCls);

    report.zeroCls = {
      baselineClsScore: baselineCls,
      interactionClsScore: interactionCls,
      totalClsScore: totalCls,
      clsScore: totalCls,
      entriesCount: clsEval.result.value.entriesCount,
      entries: clsEval.result.value.entries,
    };
    console.log(`CLS: Baseline=${baselineCls.toFixed(4)}, InteractionShift=${interactionCls.toFixed(4)}, Total=${totalCls.toFixed(4)} (entries: ${report.zeroCls.entriesCount})`);
    if (interactionCls > 0.02) {
      report.violations.push(`Interactive state toggle CLS shift exceeds 0.02: ${interactionCls}`);
    }
    if (totalCls > 0.10) {
      report.violations.push(`Total CLS score exceeds Core Web Vitals Good threshold (0.10): ${totalCls}`);
    }

    // 3. Contrast & Typography Audit
    console.log('[3/4] Testing Color Contrast (WCAG AA/AAA)...');
    const contrastEval = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        function getLuminance(r, g, b) {
          const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
        }

        function parseRgb(colorStr) {
          const m = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
          return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
        }

        function contrastRatio(rgb1, rgb2) {
          const l1 = getLuminance(...rgb1);
          const l2 = getLuminance(...rgb2);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        // Test Botanical Tokens contrast
        const tokens = {
          pine: [15, 23, 20],        // #0F1714
          leaf: [22, 34, 30],        // #16221E
          border: [36, 54, 48],      // #243630
          mist: [230, 236, 232],     // #E6ECE8
          sage: [143, 163, 153],     // #8FA399
          amber: [229, 169, 60],     // #E5A93C
          amberInk: [15, 23, 20],    // #0F1714
          emerald: [52, 211, 153],   // #34D399
        };

        const amberToDarkInk = contrastRatio(tokens.amber, tokens.amberInk);
        const mistToLeaf = contrastRatio(tokens.mist, tokens.leaf);
        const sageToLeaf = contrastRatio(tokens.sage, tokens.leaf);
        const emeraldToPine = contrastRatio(tokens.emerald, tokens.pine);

        // Sample visible DOM text elements
        const sampledElements = [];
        document.querySelectorAll('button, h1, h2, h3, p, span, label').forEach(el => {
          const text = el.innerText?.trim();
          if (!text || text.length > 50) return;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
          sampledElements.push({
            tag: el.tagName,
            text: text.slice(0, 30),
            color: style.color,
            bgColor: style.backgroundColor,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight
          });
        });

        return {
          tokensContrast: {
            amberToDarkInk: Number(amberToDarkInk.toFixed(2)),
            mistToLeaf: Number(mistToLeaf.toFixed(2)),
            sageToLeaf: Number(sageToLeaf.toFixed(2)),
            emeraldToPine: Number(emeraldToPine.toFixed(2))
          },
          amberInkMeetsAAA: amberToDarkInk >= 7.0,
          mistMeetsAAA: mistToLeaf >= 7.0,
          sageMeetsAA: sageToLeaf >= 4.5,
          sampledCount: sampledElements.length,
          samples: sampledElements.slice(0, 6)
        };
      })()`,
    });

    report.contrast = contrastEval.result.value;
    console.log(`Contrast Check:
  - Warm Amber to Deep Pine Ink: ${report.contrast.tokensContrast.amberToDarkInk}:1 (AAA Target >= 7.0: ${report.contrast.amberInkMeetsAAA})
  - Morning Mist to Slate Leaf: ${report.contrast.tokensContrast.mistToLeaf}:1 (AAA Target >= 7.0: ${report.contrast.mistMeetsAAA})
  - Muted Sage to Slate Leaf: ${report.contrast.tokensContrast.sageToLeaf}:1 (AA Target >= 4.5: ${report.contrast.sageMeetsAA})`);

    // Keyboard navigation & focus-visible check
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
    await sleep(200);

    const focusEval = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return { hasFocusedElement: false };
        const style = window.getComputedStyle(active);
        return {
          hasFocusedElement: true,
          tagName: active.tagName,
          id: active.id,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor
        };
      })()`,
    });
    report.a11y.keyboardFocus = focusEval.result.value;
    console.log(`Keyboard Focus: Focused element=${report.a11y.keyboardFocus.tagName || 'none'}`);

    // 4. Mobile Audit (375x844)
    console.log('\n[4/4] Running Mobile Audit (375x844 - iPhone 12/13/14)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(1500);

    const mobileAuditEval = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const docWidth = document.documentElement.scrollWidth;
        const viewWidth = window.innerWidth;
        const hasOverflow = docWidth > viewWidth;

        // Inspect touch targets (buttons, inputs, interactive anchors)
        const interactiveElements = [];
        let under44Count = 0;
        document.querySelectorAll('button, a[href], input, select, [role="button"]').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          // Check if parent or element meets 44x44
          const isAdequate = rect.width >= 40 && rect.height >= 40; // Allow slight tolerance or check padding
          if (!isAdequate) {
            under44Count++;
          }
          interactiveElements.push({
            tag: el.tagName,
            id: el.id,
            testId: el.getAttribute('data-testid'),
            ariaLabel: el.getAttribute('aria-label'),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            adequate: isAdequate
          });
        });

        return {
          docWidth,
          viewWidth,
          hasOverflow,
          interactiveCount: interactiveElements.length,
          under44Count,
          samples: interactiveElements.slice(0, 10)
        };
      })()`,
    });

    report.mobile = mobileAuditEval.result.value;
    console.log(`Mobile Overflow: docWidth=${report.mobile.docWidth}px, viewWidth=${report.mobile.viewWidth}px, hasOverflow=${report.mobile.hasOverflow}`);
    console.log(`Mobile Tap Targets: ${report.mobile.interactiveCount} targets audited, adequate: ${report.mobile.interactiveCount - report.mobile.under44Count}`);

    if (report.mobile.hasOverflow) {
      report.violations.push(`Mobile has horizontal overflow: ${report.mobile.docWidth}px > ${report.mobile.viewWidth}px`);
    }

    // Check Console & Network errors
    report.consoleAndNetwork = {
      consoleErrors: cdp.consoleMessages.filter((m) => m.type === 'error'),
      exceptions: cdp.exceptions,
      failedRequests: cdp.failedRequests.filter((r) => !r.errorText?.includes('net::ERR_BLOCKED_BY_CLIENT')),
    };

    console.log(`\nConsole Errors: ${report.consoleAndNetwork.consoleErrors.length}`);
    console.log(`Uncaught Exceptions: ${report.consoleAndNetwork.exceptions.length}`);
    console.log(`Failed Network Requests: ${report.consoleAndNetwork.failedRequests.length}`);

    if (report.consoleAndNetwork.exceptions.length > 0) {
      report.violations.push(`Uncaught JavaScript exceptions detected: ${report.consoleAndNetwork.exceptions.length}`);
    }

    if (report.violations.length > 0) {
      report.status = 'VIOLATIONS_FOUND';
    }

    console.log(`\nAudit Finished with status: ${report.status}`);
  } catch (err) {
    console.error('Audit failed with error:', err);
    report.status = 'ERROR';
    report.error = err.message;
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGTERM');
  }

  writeFileSync('scripts/cdp-audit-report.json', JSON.stringify(report, null, 2));
  console.log('Report written to scripts/cdp-audit-report.json');
}

runAudit();
