/**
 * Glassmorphic Web Calculator Engine
 * Handles expression parsing, math operations, history, keyboard shortcuts, Web Audio API sound, and unit conversions.
 */

class WebCalculator {
    constructor() {
        this.expression = '';
        this.result = '0';
        this.memory = 0;
        this.isDegree = true; // DEG by default, false = RAD
        this.soundEnabled = true;
        this.history = JSON.parse(localStorage.getItem('calc_history') || '[]');
        this.currentMode = 'standard'; // 'standard', 'scientific', 'converter'

        this.initDOM();
        this.initAudio();
        this.initEvents();
        this.initConverter();
        this.updateDisplay();
        this.renderHistory();
    }

    initDOM() {
        // Displays
        this.expressionDisplay = document.getElementById('expressionDisplay');
        this.resultDisplay = document.getElementById('resultDisplay');
        this.angleModeBadge = document.getElementById('angleModeBadge');
        this.memoryBadge = document.getElementById('memoryBadge');
        this.historyBadge = document.getElementById('historyBadge');

        // Containers & Controls
        this.appContainer = document.querySelector('.app-container');
        this.keypadContainer = document.getElementById('keypadContainer');
        this.converterContainer = document.getElementById('converterContainer');
        this.angleToggleBtn = document.getElementById('angleToggleBtn');

        // Buttons & Drawer
        this.toggleSoundBtn = document.getElementById('toggleSoundBtn');
        this.soundIcon = document.getElementById('soundIcon');
        this.toggleThemeBtn = document.getElementById('toggleThemeBtn');
        this.themeIcon = document.getElementById('themeIcon');
        this.openHistoryBtn = document.getElementById('openHistoryBtn');
        this.closeHistoryBtn = document.getElementById('closeHistoryBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.historyDrawer = document.getElementById('historyDrawer');
        this.drawerOverlay = document.getElementById('drawerOverlay');
        this.historyList = document.getElementById('historyList');

        // Unit Converter Elements
        this.converterCategory = document.getElementById('converterCategory');
        this.converterInput = document.getElementById('converterInput');
        this.converterOutput = document.getElementById('converterOutput');
        this.converterFromUnit = document.getElementById('converterFromUnit');
        this.converterToUnit = document.getElementById('converterToUnit');
        this.swapUnitsBtn = document.getElementById('swapUnitsBtn');
        this.converterFormula = document.getElementById('converterFormula');
    }

    initAudio() {
        this.audioCtx = null;
    }

    playSound(type = 'click') {
        if (!this.soundEnabled) return;
        try {
            if (!this.audioCtx) {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            if (!this.audioCtx) return;

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            const now = this.audioCtx.currentTime;
            if (type === 'equals') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'clear') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            }
        } catch (e) {
            // Silence any audio play errors
        }
    }

    initEvents() {
        // Mode Tabs
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
                this.playSound('click');
            });
        });

        // Sound Toggle
        this.toggleSoundBtn.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.soundIcon.className = this.soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
            this.playSound('click');
        });

        // Theme Toggle
        this.toggleThemeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            document.body.classList.toggle('dark-theme');
            const isLight = document.body.classList.contains('light-theme');
            this.themeIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            this.playSound('click');
        });

        // History Drawer Toggle
        this.openHistoryBtn.addEventListener('click', () => this.openHistory());
        this.closeHistoryBtn.addEventListener('click', () => this.closeHistory());
        this.drawerOverlay.addEventListener('click', () => this.closeHistory());
        this.clearHistoryBtn.addEventListener('click', () => {
            this.history = [];
            localStorage.setItem('calc_history', JSON.stringify([]));
            this.renderHistory();
            this.playSound('clear');
        });

        // Angle Toggle (DEG / RAD)
        this.angleToggleBtn.addEventListener('click', () => {
            this.isDegree = !this.isDegree;
            this.angleToggleBtn.innerText = this.isDegree ? 'RAD' : 'DEG';
            this.angleModeBadge.innerText = this.isDegree ? 'DEG' : 'RAD';
            this.playSound('click');
        });

        // Keypad Button Clicks
        document.querySelectorAll('.keypad-container .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleButtonInput(btn);
            });
        });

        // Physical Keyboard Input Mapping
        window.addEventListener('keydown', (e) => this.handleKeyboardInput(e));
    }

    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
        });

        if (mode === 'scientific') {
            this.appContainer.classList.add('scientific-active');
            this.keypadContainer.style.display = 'flex';
            this.converterContainer.style.display = 'none';
            this.angleModeBadge.style.display = 'inline-block';
        } else if (mode === 'standard') {
            this.appContainer.classList.remove('scientific-active');
            this.keypadContainer.style.display = 'flex';
            this.converterContainer.style.display = 'none';
            this.angleModeBadge.style.display = 'none';
        } else if (mode === 'converter') {
            this.appContainer.classList.remove('scientific-active');
            this.keypadContainer.style.display = 'none';
            this.converterContainer.style.display = 'block';
            this.angleModeBadge.style.display = 'none';
            this.updateConverter();
        }
    }

    handleButtonInput(btn) {
        const val = btn.dataset.val;
        const action = btn.dataset.action;

        // Visual press animation
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);

        if (action === 'clear') {
            this.clear();
            this.playSound('clear');
        } else if (action === 'delete') {
            this.deleteLast();
            this.playSound('click');
        } else if (action === 'calculate') {
            this.evaluate();
            this.playSound('equals');
        } else if (action === 'negate') {
            this.toggleNegate();
            this.playSound('click');
        } else if (action === 'func') {
            this.appendFunction(val);
            this.playSound('click');
        } else if (action === 'constant') {
            this.appendConstant(val);
            this.playSound('click');
        } else if (action === 'mem-clear') {
            this.memory = 0;
            this.memoryBadge.style.display = 'none';
            this.playSound('click');
        } else if (action === 'mem-recall') {
            this.expression += this.memory.toString();
            this.updateDisplay();
            this.playSound('click');
        } else if (action === 'mem-add') {
            this.evaluate(false);
            this.memory += parseFloat(this.result) || 0;
            this.memoryBadge.style.display = 'inline-block';
            this.playSound('click');
        } else if (action === 'mem-sub') {
            this.evaluate(false);
            this.memory -= parseFloat(this.result) || 0;
            this.memoryBadge.style.display = 'inline-block';
            this.playSound('click');
        } else if (val) {
            this.append(val);
            this.playSound('click');
        }
    }

    handleKeyboardInput(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        let key = e.key;
        let matchedBtn = null;

        if (key >= '0' && key <= '9') {
            matchedBtn = document.querySelector(`.btn[data-val="${key}"]`);
            this.append(key);
            this.playSound('click');
        } else if (key === '.') {
            matchedBtn = document.querySelector(`.btn[data-val="."]`);
            this.append('.');
            this.playSound('click');
        } else if (key === '+' || key === '-' || key === '*' || key === '/' || key === '%' || key === '^') {
            matchedBtn = document.querySelector(`.btn[data-val="${key}"]`);
            this.append(key);
            this.playSound('click');
        } else if (key === '(' || key === ')') {
            matchedBtn = document.querySelector(`.btn[data-val="${key}"]`);
            this.append(key);
            this.playSound('click');
        } else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            matchedBtn = document.querySelector('.btn-equals');
            this.evaluate();
            this.playSound('equals');
        } else if (key === 'Backspace') {
            matchedBtn = document.querySelector('.btn-danger');
            this.deleteLast();
            this.playSound('click');
        } else if (key === 'Escape' || key.toLowerCase() === 'c') {
            matchedBtn = document.querySelector('.btn-clear');
            this.clear();
            this.playSound('clear');
        }

        if (matchedBtn) {
            matchedBtn.classList.add('pressed');
            setTimeout(() => matchedBtn.classList.remove('pressed'), 120);
        }
    }

    isOperator(char) {
        return ['+', '-', '*', '/', '%', '^'].includes(char);
    }

    append(val) {
        // Reset state if previous calculation resulted in Error
        if (this.result === 'Error') {
            this.clear();
        }

        if (this.expression.length > 50) return;

        // Prevent multiple decimal points in a single number token
        if (val === '.') {
            const parts = this.expression.split(/[\+\-\*\/\%\^\(\)]/);
            const lastPart = parts[parts.length - 1];
            if (lastPart.includes('.')) return;

            // Auto-prepend '0' if expression is empty or ends with operator
            if (!this.expression || this.isOperator(this.expression.slice(-1))) {
                this.expression += '0';
            }
        }

        // Prevent consecutive operators (replace previous operator)
        if (this.isOperator(val)) {
            if (!this.expression) {
                if (val === '-') {
                    this.expression = '-';
                    this.updateDisplay();
                } else if (val !== '%') {
                    this.expression = '0' + val;
                    this.updateDisplay();
                }
                return;
            }

            const lastChar = this.expression.slice(-1);
            if (this.isOperator(lastChar)) {
                // Allow negative sign following operator (e.g. 5 * -3)
                if (val === '-' && lastChar !== '-') {
                    this.expression += val;
                    this.updateDisplay();
                    return;
                }
                // Replace previous operator(s)
                if (this.expression.length >= 2 && this.isOperator(this.expression.slice(-2, -1))) {
                    this.expression = this.expression.slice(0, -2) + val;
                } else {
                    this.expression = this.expression.slice(0, -1) + val;
                }
                this.updateDisplay();
                return;
            }
        }

        this.expression += val;
        this.updateDisplay();
    }

    appendFunction(fnVal) {
        if (this.result === 'Error') this.clear();
        if (fnVal === 'sqr') {
            this.expression += '^2';
        } else if (fnVal === 'fact') {
            this.expression += '!';
        } else {
            this.expression += fnVal;
        }
        this.updateDisplay();
    }

    appendConstant(c) {
        if (this.result === 'Error') this.clear();
        this.expression += c;
        this.updateDisplay();
    }

    toggleNegate() {
        if (!this.expression || this.expression === '0') {
            this.expression = '-';
        } else if (this.expression.endsWith('-')) {
            this.expression = this.expression.slice(0, -1);
        } else {
            this.expression += '-';
        }
        this.updateDisplay();
    }

    deleteLast() {
        if (this.result === 'Error') {
            this.clear();
            return;
        }
        if (this.expression.length > 0) {
            const funcs = ['asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'log(', 'sqrt(', 'abs(', 'ln('];
            let removed = false;
            for (let f of funcs) {
                if (this.expression.endsWith(f)) {
                    this.expression = this.expression.slice(0, -f.length);
                    removed = true;
                    break;
                }
            }
            if (!removed) {
                this.expression = this.expression.slice(0, -1);
            }
            this.updateDisplay();
        }
    }

    clear() {
        this.expression = '';
        this.result = '0';
        this.updateDisplay();
    }

    updateDisplay() {
        this.expressionDisplay.innerText = this.formatExpression(this.expression);
        this.resultDisplay.innerText = this.formatNumber(this.result);
    }

    formatExpression(expr) {
        if (!expr) return '';
        return expr
            .replace(/\*/g, ' × ')
            .replace(/\//g, ' ÷ ')
            .replace(/\-/g, ' − ')
            .replace(/\+/g, ' + ')
            .replace(/\^/g, ' ^ ');
    }

    formatNumber(numStr) {
        if (numStr === 'Error' || numStr === 'Infinity' || numStr === '-Infinity' || numStr === 'NaN') {
            return 'Error';
        }
        const num = parseFloat(numStr);
        if (isNaN(num)) return numStr;

        // Auto scientific notation for large or tiny numbers
        if (Math.abs(num) >= 1e12 || (Math.abs(num) < 1e-6 && num !== 0)) {
            return num.toExponential(6);
        }

        // Format commas for thousands
        const parts = numStr.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    evaluate(saveToHistory = true) {
        if (!this.expression) return;

        try {
            let sanitized = this.expression;

            // Trim trailing operators before evaluating
            while (sanitized.length > 0 && this.isOperator(sanitized.slice(-1))) {
                sanitized = sanitized.slice(0, -1);
            }

            if (!sanitized) return;

            // Handle Percentage (%)
            sanitized = sanitized.replace(/(\d+(\.\d+)?)%/g, '($1*0.01)');

            // Replace mathematical symbols & constants
            sanitized = sanitized.replace(/π/g, 'Math.PI');
            sanitized = sanitized.replace(/e/g, 'Math.E');

            // Implicit multiplication handling
            sanitized = sanitized.replace(/(\d+)\s*(Math\.PI|Math\.E|\()/g, '$1*$2');
            sanitized = sanitized.replace(/(\)|Math\.PI|Math\.E)\s*(\d+|\()/g, '$1*$2');

            // Trigonometric functions
            const toRad = this.isDegree ? '(Math.PI/180)*' : '';
            const toDeg = this.isDegree ? '*(180/Math.PI)' : '';

            sanitized = sanitized.replace(/asin\((.*?)\)/g, `(Math.asin($1)${toDeg})`);
            sanitized = sanitized.replace(/acos\((.*?)\)/g, `(Math.acos($1)${toDeg})`);
            sanitized = sanitized.replace(/atan\((.*?)\)/g, `(Math.atan($1)${toDeg})`);
            sanitized = sanitized.replace(/sin\((.*?)\)/g, `Math.sin(${toRad}($1))`);
            sanitized = sanitized.replace(/cos\((.*?)\)/g, `Math.cos(${toRad}($1))`);
            sanitized = sanitized.replace(/tan\((.*?)\)/g, `Math.tan(${toRad}($1))`);

            // Logarithm & Roots
            sanitized = sanitized.replace(/log\((.*?)\)/g, 'Math.log10($1)');
            sanitized = sanitized.replace(/ln\((.*?)\)/g, 'Math.log($1)');
            sanitized = sanitized.replace(/sqrt\((.*?)\)/g, 'Math.sqrt($1)');
            sanitized = sanitized.replace(/abs\((.*?)\)/g, 'Math.abs($1)');

            // Power operator (x^y)
            sanitized = sanitized.replace(/([0-9a-zA-Z_.]+)\^([0-9a-zA-Z_.]+)/g, 'Math.pow($1, $2)');

            // Factorials
            sanitized = sanitized.replace(/(\d+)!/g, (match, n) => this.factorial(parseInt(n)));

            // Safe Evaluation using Function constructor
            const evalResult = new Function(`'use strict'; return (${sanitized})`)();

            if (typeof evalResult === 'number') {
                if (!isFinite(evalResult) || isNaN(evalResult)) {
                    this.result = 'Error';
                } else {
                    // Fix float rounding precision artifacts (e.g. 0.1 + 0.2 = 0.3)
                    this.result = (Math.round(evalResult * 1e12) / 1e12).toString();
                }
            } else {
                this.result = 'Error';
            }

            if (saveToHistory && this.result !== 'Error') {
                this.addHistory(this.expression, this.result);
            }

        } catch (err) {
            this.result = 'Error';
        }

        this.updateDisplay();
    }

    factorial(n) {
        if (n < 0) return NaN;
        if (n === 0 || n === 1) return 1;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }

    addHistory(expr, res) {
        this.history.unshift({ expr, res, time: new Date().toLocaleTimeString() });
        if (this.history.length > 50) this.history.pop();
        localStorage.setItem('calc_history', JSON.stringify(this.history));
        this.renderHistory();
    }

    renderHistory() {
        this.historyBadge.innerText = this.history.length;
        if (this.history.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-history">
                    <i class="fa-solid fa-calculator"></i>
                    <p>저장된 계산 기록이 없습니다</p>
                </div>`;
            return;
        }

        this.historyList.innerHTML = this.history.map((item, idx) => `
            <div class="history-item" data-idx="${idx}">
                <span class="history-expr">${this.formatExpression(item.expr)} =</span>
                <span class="history-res">${this.formatNumber(item.res)}</span>
            </div>
        `).join('');

        // Item Click Handler to reuse result or expression
        document.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
                const item = this.history[el.dataset.idx];
                this.expression = item.res;
                this.result = item.res;
                this.updateDisplay();
                this.closeHistory();
                this.playSound('click');
            });
        });
    }

    openHistory() {
        this.historyDrawer.classList.add('active');
        this.drawerOverlay.classList.add('active');
        this.playSound('click');
    }

    closeHistory() {
        this.historyDrawer.classList.remove('active');
        this.drawerOverlay.classList.remove('active');
    }

    /* Unit Converter Module */
    initConverter() {
        this.converterUnits = {
            length: {
                m: { name: '미터 (m)', factor: 1 },
                cm: { name: '센티미터 (cm)', factor: 0.01 },
                mm: { name: '밀리미터 (mm)', factor: 0.001 },
                km: { name: '킬로미터 (km)', factor: 1000 },
                inch: { name: '인치 (in)', factor: 0.0254 },
                ft: { name: '피트 (ft)', factor: 0.3048 },
                yd: { name: '야드 (yd)', factor: 0.9144 },
                mi: { name: '마일 (mi)', factor: 1609.34 }
            },
            weight: {
                kg: { name: '킬로그램 (kg)', factor: 1 },
                g: { name: '그램 (g)', factor: 0.001 },
                mg: { name: '밀리그램 (mg)', factor: 0.000001 },
                lb: { name: '파운드 (lb)', factor: 0.453592 },
                oz: { name: '온스 (oz)', factor: 0.0283495 }
            },
            temperature: {
                c: { name: '섭씨 (°C)' },
                f: { name: '화씨 (°F)' },
                k: { name: '켈빈 (K)' }
            },
            area: {
                sqm: { name: '제곱미터 (m²)', factor: 1 },
                sqkm: { name: '제곱킬로미터 (km²)', factor: 1000000 },
                pyeong: { name: '평', factor: 3.305785 },
                acre: { name: '에이커 (acre)', factor: 4046.86 }
            },
            volume: {
                l: { name: '리터 (L)', factor: 1 },
                ml: { name: '밀리리터 (mL)', factor: 0.001 },
                cbm: { name: '세제곱미터 (m³)', factor: 1000 },
                gal: { name: '갤런 (gal)', factor: 3.78541 }
            }
        };

        this.converterCategory.addEventListener('change', () => this.updateConverterSelects());
        this.converterInput.addEventListener('input', () => this.updateConverter());
        this.converterFromUnit.addEventListener('change', () => this.updateConverter());
        this.converterToUnit.addEventListener('change', () => this.updateConverter());
        this.swapUnitsBtn.addEventListener('click', () => {
            const temp = this.converterFromUnit.value;
            this.converterFromUnit.value = this.converterToUnit.value;
            this.converterToUnit.value = temp;
            this.updateConverter();
            this.playSound('click');
        });

        this.updateConverterSelects();
    }

    updateConverterSelects() {
        const cat = this.converterCategory.value;
        const units = this.converterUnits[cat];
        const keys = Object.keys(units);

        this.converterFromUnit.innerHTML = keys.map(k => `<option value="${k}">${units[k].name}</option>`).join('');
        this.converterToUnit.innerHTML = keys.map(k => `<option value="${k}">${units[k].name}</option>`).join('');

        if (keys.length > 1) {
            this.converterToUnit.value = keys[1];
        }

        this.updateConverter();
    }

    updateConverter() {
        const cat = this.converterCategory.value;
        const from = this.converterFromUnit.value;
        const to = this.converterToUnit.value;
        const inputVal = parseFloat(this.converterInput.value) || 0;

        let outputVal = 0;

        if (cat === 'temperature') {
            outputVal = this.convertTemperature(inputVal, from, to);
        } else {
            const units = this.converterUnits[cat];
            const baseVal = inputVal * units[from].factor;
            outputVal = baseVal / units[to].factor;
        }

        // Format Output
        const formattedOutput = (Math.round(outputVal * 1e8) / 1e8).toString();
        this.converterOutput.value = formattedOutput;
        this.converterFormula.innerText = `1 ${from} = ${this.converterOutput.value / (inputVal || 1)} ${to}`;
    }

    convertTemperature(val, from, to) {
        if (from === to) return val;
        let celsius = val;
        if (from === 'f') celsius = (val - 32) * (5 / 9);
        if (from === 'k') celsius = val - 273.15;

        if (to === 'c') return celsius;
        if (to === 'f') return (celsius * 9 / 5) + 32;
        if (to === 'k') return celsius + 273.15;
    }
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.calculatorApp = new WebCalculator();
});
