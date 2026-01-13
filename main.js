const { Plugin } = require('obsidian');

module.exports = class BasesNumberingPlugin extends Plugin {
    async onload() {
        this.app.workspace.onLayoutReady(() => {
            this.watch();
            setTimeout(() => this.updateAll(), 1000);
            setTimeout(() => this.updateAll(), 3000);
        });
    }

    watch() {
        this.registerEvent(this.app.workspace.on('layout-change', () => this.updateAll()));
        
        let timer = null;
        this.observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            for (const m of mutations) {
                if (m.target.className && typeof m.target.className === 'string' && m.target.className.includes('strict-badge')) continue;
                if (m.target.classList && (m.target.classList.contains('bases-cards-item') || m.target.classList.contains('bases-view'))) {
                    shouldUpdate = true;
                }
            }
            if (shouldUpdate) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => this.updateAll(), 200);
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    findArrayByLength(obj, targetLen, depth = 0) {
        if (!obj || depth > 4) return null;
        const keys = Object.keys(obj);
        for (const key of keys) {
            try {
                if (['app','window','document','plugin'].includes(key)) continue;
                const val = obj[key];
                if (Array.isArray(val) && val.length === targetLen) {
                    const first = val[0];
                    if (first && (first.path || (first.file && first.file.path) || (first.row && first.row.path))) return val;
                }
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    const found = this.findArrayByLength(val, targetLen, depth + 1);
                    if (found) return found;
                }
            } catch (e) {}
        }
        return null;
    }

    findLargestArray(obj, depth = 0, foundCandidate = null) {
        if (!obj || depth > 5) return foundCandidate;
        const keys = Object.keys(obj);
        for (const key of keys) {
            try {
                if (['app','window','document','plugin','containerEl'].includes(key)) continue;
                const val = obj[key];
                if (Array.isArray(val) && val.length > 0) {
                    const first = val[0];
                    if (first && (first.path || (first.file && first.file.path) || (first.row && first.row.path))) {
                        if (!foundCandidate || val.length > foundCandidate.length) {
                            foundCandidate = val;
                        }
                    }
                }
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    foundCandidate = this.findLargestArray(val, depth + 1, foundCandidate);
                }
            } catch (e) {}
        }
        return foundCandidate;
    }

    updateAll() {
        const leaves = this.app.workspace.getLeavesOfType('bases');
        leaves.forEach(leaf => this.updateView(leaf.view));
    }

    updateView(view) {
        if (!view || !view.file || !view.contentEl) return;
        const parentFolder = view.file.parent.path;

        const allFiles = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(parentFolder));
        const targetCount = allFiles.length;

        let masterList = [];
        let sourceMode = "Fallback";

        let magicArray = this.findArrayByLength(view, targetCount);
        
        if (!magicArray) {
            magicArray = this.findLargestArray(view);
        }

        if (magicArray) {
            masterList = magicArray.map(item => {
                if (item.path) return item.path;
                if (item.file && item.file.path) return item.file.path;
                if (item.row && item.row.path) return item.row.path;
                return null;
            }).filter(p => p);
            sourceMode = "Magic Match";
        } else {
            masterList = allFiles.sort((a,b) => a.basename.localeCompare(b.basename)).map(f => f.path);
        }

        if (masterList.length === 0) return;

        const cards = view.contentEl.querySelectorAll('.bases-cards-item');
        
        cards.forEach(card => {
            const old = card.querySelector('.strict-badge');
            if (old) old.remove();

            const fullText = card.innerText;
            const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) return;
            const firstLine = lines[0]; 

            const matchPath = masterList.find(path => {
                const filename = path.split('/').pop().replace('.md', '');
                return filename === firstLine;
            });

            if (matchPath) {
                const index = masterList.indexOf(matchPath) + 1;
                const badge = document.createElement('div');
                badge.className = 'strict-badge';
                badge.innerText = index.toString();
                
                Object.assign(badge.style, {
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: '9999',
                    backgroundColor: sourceMode === "Magic Match" ? 'var(--interactive-accent)' : 'rgba(80, 80, 80, 0.8)',
                    color: 'var(--text-on-accent)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(2px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: '0.9'
                });
                card.appendChild(badge);
            }
        });
    }

    onunload() {
        if (this.observer) this.observer.disconnect();
        document.querySelectorAll('.strict-badge').forEach(e => e.remove());
    }
}