const { Plugin, PluginSettingTab, Setting, Modal, TFolder, TFile, Notice, MarkdownRenderer, Platform } = require('obsidian');

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];

const FALLBACK_LOCALE = {
  "pluginName": "Shuffle Lab",
  "commandName": "New session",
  "noticeNoDirectory": "Please set your main directory in Shuffle Lab settings",
  "noticeSelectTopic": "Please select a folder",
  "noticeTopicNotFound": "Folder not found",
  "noticeNoImages": "No image files found in the selected folder",
  "noticeLogCleared": "Session log cleared",
  "noticeNoLog": "No log file found",
  "noticePromptDeleted": "Prompt file deleted",
  "settingsHeading": "Shuffle Lab",
  "mainDirectoryName": "Main directory",
  "mainDirectoryDesc": "Root folder containing subfolders with reference images",
  "folderPlaceholder": "\u2014 Select a folder \u2014",
  "sessionHeading": "New session",
  "noFoldersFound": "No folders found. Add subfolders inside your main directory.",
  "folderName": "Folder",
  "folderDesc": "Choose a folder for this session",
  "numImagesName": "Number of images",
  "numImagesDesc": "Images to include in the session pool",
  "noImagesWarning": "This folder has no images",
  "loopName": "Loop images",
  "loopDesc": "Repeat shuffled images indefinitely until session ends or stops",
  "durationName": "Duration per image",
  "durationDesc": "How long each image is displayed",
  "customDurationName": "Custom duration",
  "customDurationDesc": "Enter duration in seconds",
  "totalTimeName": "Total session time",
  "totalTimeDesc": "Calculated from images \u00d7 duration",
  "loggingName": "Session logging",
  "loggingDesc": "Log shown images to prioritize unseen ones next session",
  "clearLogName": "Clear session log",
  "clearLogDesc": "Delete the log file for the selected topic",
  "clearLogBtn": "Clear",
  "promptFileName": "Prompt file",
  "promptFileDesc": "Intro slide shown before the session starts",
  "editBtn": "Edit",
  "deleteBtn": "Delete",
  "createBtn": "Create",
  "startBtn": "Start Session",
  "durationPresets": {
    "30s": "30s",
    "60s": "60s",
    "2min": "2 min",
    "5min": "5 min",
    "custom": "Custom"
  },
  "introStartBtn": "Start",
  "endOfDeckTitle": "No more images left",
  "endOfDeckHint": "Press \u25b6 to finish or \u25c0 to review",
  "sessionCompleteTitle": "Session Complete",
  "sessionCompleteHint": "Press \u25b6 or ESC to exit",
  "failedToLoad": "(failed to load)",
  "failedToLoadName": "Failed to load: {0}",
  "sessionLogTitle": "# Session Log",
  "sessionLogHeader": "Shown in last session:",
  "promptTemplate": "# Insert your prompt title here\n\nWrite your prompt instructions here.\n\n---\n# Notes\n\nAnything you write below the divider won't show up in the intro slide\n",
  "languageName": "Language",
  "languageDesc": "Choose interface language",
  "languageFilesName": "Language files",
  "languageFilesDesc": "Add or edit translation files",
  "openFolderBtn": "Open folder",
  "noticeLanguageChanged": "Language changed. Reload Obsidian or the plugin for it to take effect."
};

const DEFAULT_SETTINGS = {
    mainDirectory: '',
    folder: '',
    numPictures: 5,
    durationPerImage: 30,
    loop: true,
    language: 'en',
};

module.exports = class VisualConceptLab extends Plugin {
    async onload() {
        await this.loadSettings();
        await this.loadLocale();
        await this.cacheAvailableLanguages();
        this.addSettingTab(new DrawingSessionSettingTab(this.app, this));
        this.addRibbonIcon('shuffle', this.t('pluginName'), () => {
            this.openSetupModal();
        });
        this.addCommand({
            id: 'open-session-setup',
            name: this.t('commandName'),
            callback: () => this.openSetupModal(),
        });

        this.app.vault.on('rename', (file, oldPath) => {
            if (!(file instanceof TFolder)) return;
            if (this.settings.folder === oldPath) {
                this.settings.folder = file.path;
                this.saveSettings();
            }
        });
    }

    openSetupModal() {
        if (!this.settings.mainDirectory) {
            new Notice(this.t('noticeNoDirectory'));
            return;
        }
        new SessionSetupModal(this.app, this).open();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadLocale() {
        const lang = this.settings.language || 'en';
        try {
            const adapter = this.app.vault.adapter;
            const filePath = this.app.vault.configDir + '/plugins/shuffle-lab/lang/' + lang + '.json';
            if (await adapter.exists(filePath)) {
                this.locale = JSON.parse(await adapter.read(filePath));
                return;
            }
        } catch (e) {}

        this.locale = Object.assign({}, FALLBACK_LOCALE);
    }

    async cacheAvailableLanguages() {
        try {
            const adapter = this.app.vault.adapter;
            const langDir = this.app.vault.configDir + '/plugins/shuffle-lab/lang';
            const result = await adapter.list(langDir);
            const found = result.files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', '').split('/').pop());
            if (found.length > 0) {
                this._cachedLanguages = found.map(code => [code, code]);
                this.settings.availableLanguages = found;
                await this.saveSettings();
                return;
            }
        } catch (e) {}

        if (this.settings.availableLanguages) {
            this._cachedLanguages = this.settings.availableLanguages.map(code => [code, code]);
        } else {
            this._cachedLanguages = [['en', 'English']];
        }
    }

    getAvailableLanguages() {
        return this._cachedLanguages || [['en', 'English']];
    }

    openLanguageFolder() {
        try {
            const { shell } = require('electron');
            const basePath = this.app.vault.adapter.getBasePath();
            const langDir = basePath + '/' + this.app.vault.configDir + '/plugins/shuffle-lab/lang';
            shell.openPath(langDir);
        } catch (e) {
            new Notice('Cannot open folder on this device');
        }
    }

    t(key, ...args) {
        const parts = key.split('.');
        let value = this.locale;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return key;
            }
        }
        if (typeof value === 'string') {
            if (args.length > 0) {
                return value.replace(/{(\d+)}/g, (match, num) => args[num] !== undefined ? args[num] : match);
            }
            return value;
        }
        return key;
    }
};

class DrawingSessionSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName(this.plugin.t('mainDirectoryName'))
            .setDesc(this.plugin.t('mainDirectoryDesc'))
            .addDropdown(dropdown => {
                const folders = this.getFolders();
                folders.forEach(([value, label]) => dropdown.addOption(value, label));
                dropdown.setValue(this.plugin.settings.mainDirectory);
                dropdown.onChange(async value => {
                    this.plugin.settings.mainDirectory = value;
                    await this.plugin.saveSettings();
                });
            });

        if (Platform.isDesktop) {
            const langSetting = new Setting(containerEl)
                .setName(this.plugin.t('languageName'))
                .setDesc(this.plugin.t('languageDesc'))
                .addDropdown(dropdown => {
                    const langs = this.plugin.getAvailableLanguages();
                    langs.forEach(([value, label]) => dropdown.addOption(value, label));
                    dropdown.setValue(this.plugin.settings.language || 'en');
                    dropdown.onChange(async value => {
                        const changed = value !== this.plugin.settings.language;
                        this.plugin.settings.language = value;
                        await this.plugin.saveSettings();
                        langWarningEl.classList.toggle('shuffle-lab-is-hidden', !changed);
                    });
                });

            const langWarningEl = langSetting.descEl.createEl('div', {
                text: this.plugin.t('noticeLanguageChanged'),
                cls: 'shuffle-lab-lang-warning shuffle-lab-is-hidden'
            });

            new Setting(containerEl)
                .setName(this.plugin.t('languageFilesName'))
                .setDesc(this.plugin.t('languageFilesDesc'))
                .addButton(button => button
                    .setButtonText(this.plugin.t('openFolderBtn'))
                    .onClick(() => this.plugin.openLanguageFolder()));
        }

    }

    getFolders() {
        const folders = [['', this.plugin.t('folderPlaceholder')]];
        this.app.vault.getAllLoadedFiles().forEach(file => {
            if (file instanceof TFolder && file.path !== '/') {
                folders.push([file.path, file.path]);
            }
        });
        return folders.sort((a, b) => a[0].localeCompare(b[0]));
    }
}

class SessionSetupModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.selectedFolder = plugin.settings.folder || null;
        this.numPictures = plugin.settings.numPictures;
        this.durationPerImage = plugin.settings.durationPerImage;
        this.loop = plugin.settings.loop;
        this.enableLogging = true;
        this.sliderComponent = null;
    }

    onOpen() {
        this.render();
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('session-setup-modal');

        contentEl.createEl('h2', { text: this.plugin.t('sessionHeading') });

        const folders = this.getFolders();

        if (folders.length === 0) {
            contentEl.createEl('p', {
                text: this.plugin.t('noFoldersFound'),
                cls: 'setting-item-description',
            });
            return;
        }

        new Setting(contentEl)
            .setName(this.plugin.t('folderName'))
            .setDesc(this.plugin.t('folderDesc'))
            .addDropdown(dropdown => {
                folders.forEach(t => dropdown.addOption(t.path, t.name));
                const current = this.selectedFolder && folders.some(t => t.path === this.selectedFolder)
                    ? this.selectedFolder : folders[0].path;
                this.selectedFolder = current;
                dropdown.setValue(current);
                dropdown.onChange(value => {
                    this.selectedFolder = value;
                    this.updateSliderMax();
                    this.updatePromptBtn();
                });
            });

        new Setting(contentEl)
            .setName(this.plugin.t('numImagesName'))
            .setDesc(this.plugin.t('numImagesDesc'))
            .addSlider(slider => {
                this.sliderComponent = slider;
                const max = Math.max(1, this.countImagesInTopic(this.selectedFolder));
                slider.setLimits(1, max, 1);
                if (this.numPictures > max) this.numPictures = max;
                slider.setValue(this.numPictures);
                slider.setDynamicTooltip();
                slider.onChange(value => {
                    this.numPictures = value;
                    this.updateTotalTime();
                });
            });

        this.warningEl = contentEl.createEl('div', {
            cls: 'setting-item-description',
            text: this.plugin.t('noImagesWarning')
        });
        this.warningEl.classList.add('shuffle-lab-warning');
        this.warningEl.classList.toggle('shuffle-lab-is-hidden', this.countImagesInTopic(this.selectedFolder) !== 0);

        new Setting(contentEl)
            .setName(this.plugin.t('loopName'))
            .setDesc(this.plugin.t('loopDesc'))
            .addToggle(toggle => {
                toggle.setValue(this.loop);
                toggle.onChange(value => {
                    this.loop = value;
                });
            });

        const DURATION_PRESETS = [
            { label: '30s', value: 30, localeKey: '30s' },
            { label: '60s', value: 60, localeKey: '60s' },
            { label: '2 min', value: 120, localeKey: '2min' },
            { label: '5 min', value: 300, localeKey: '5min' },
            { label: 'Custom', value: -1, localeKey: 'custom' },
        ];

        const matchedPreset = DURATION_PRESETS.find(p => p.value === this.durationPerImage);

        new Setting(contentEl)
            .setName(this.plugin.t('durationName'))
            .setDesc(this.plugin.t('durationDesc'))
            .addDropdown(dropdown => {
                DURATION_PRESETS.forEach(p => dropdown.addOption(String(p.value), this.plugin.t('durationPresets.' + p.localeKey)));
                dropdown.setValue(matchedPreset ? String(matchedPreset.value) : '-1');
                dropdown.onChange(value => {
                    const num = parseInt(value);
                if (num === -1) {
                        customDurationSetting.classList.remove('shuffle-lab-is-hidden');
                    } else {
                        this.durationPerImage = num;
                        customDurationSetting.classList.add('shuffle-lab-is-hidden');
                    }
                });
            });

        const customDurationSetting = new Setting(contentEl)
            .setName(this.plugin.t('customDurationName'))
            .setDesc(this.plugin.t('customDurationDesc'))
            .addText(text => {
                text.setValue(String(this.durationPerImage));
                text.onChange(value => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.durationPerImage = num;
                        this.updateTotalTime();
                    }
                });
            }).settingEl;

        customDurationSetting.classList.toggle('shuffle-lab-is-hidden', !!matchedPreset);

        this.totalTimeSetting = new Setting(contentEl)
            .setName(this.plugin.t('totalTimeName'))
            .setDesc(this.plugin.t('totalTimeDesc'));
        this.totalTimeEl = this.totalTimeSetting.controlEl.createEl('span', { cls: 'drawing-session-total-time' });
        this.updateTotalTime();

        new Setting(contentEl)
            .setName(this.plugin.t('loggingName'))
            .setDesc(this.plugin.t('loggingDesc'))
            .addToggle(toggle => {
                toggle.setValue(this.enableLogging);
                toggle.onChange(value => { this.enableLogging = value; });
            });

        new Setting(contentEl)
            .setName(this.plugin.t('clearLogName'))
            .setDesc(this.plugin.t('clearLogDesc'))
            .addButton(button => button
                .setButtonText(this.plugin.t('clearLogBtn'))
                .onClick(() => this.clearLog()));

        const promptSetting = new Setting(contentEl)
            .setName(this.plugin.t('promptFileName'))
            .setDesc(this.plugin.t('promptFileDesc'))
            .addButton(button => {
                this.promptBtn = button;
                button.onClick(() => this.promptFileAction());
            })
            .addButton(button => {
                this.deletePromptBtn = button;
                button.setButtonText(this.plugin.t('deleteBtn'));
                button.onClick(() => this.deletePromptFile());
            });
        this.updatePromptBtn();

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(this.plugin.t('startBtn'))
                .setCta()
                .onClick(() => this.startSession()));
    }

    getFolders() {
        const mainDir = this.app.vault.getAbstractFileByPath(this.plugin.settings.mainDirectory);
        if (!(mainDir instanceof TFolder)) return [];
        return mainDir.children.filter(child => child instanceof TFolder);
    }

    countImagesInTopic(folderPath) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) return 0;
        let count = 0;
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                count += this.countImagesRecursive(child);
            } else if (child instanceof TFile && IMAGE_EXTENSIONS.includes(child.extension.toLowerCase())) {
                count++;
            }
        }
        return count;
    }

    countImagesRecursive(folder) {
        let count = 0;
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                count += this.countImagesRecursive(child);
            } else if (child instanceof TFile && IMAGE_EXTENSIONS.includes(child.extension.toLowerCase())) {
                count++;
            }
        }
        return count;
    }

    updateSliderMax() {
        if (!this.sliderComponent) return;
        const count = this.countImagesInTopic(this.selectedFolder);
        const max = Math.max(1, count);
        this.sliderComponent.setLimits(1, max, 1);
        if (this.numPictures > max) {
            this.numPictures = max;
            this.sliderComponent.setValue(max);
        }
        this.warningEl.classList.toggle('shuffle-lab-is-hidden', count !== 0);
        this.updateTotalTime();
    }

    updateTotalTime() {
        if (!this.totalTimeEl) return;
        const totalSeconds = this.numPictures * this.durationPerImage;
        this.totalTimeEl.textContent = formatTimeLong(totalSeconds);
    }

    startSession() {
        if (!this.selectedFolder) {
            new Notice(this.plugin.t('noticeSelectTopic'));
            return;
        }
        this.plugin.settings.folder = this.selectedFolder;
        this.plugin.settings.numPictures = this.numPictures;
        this.plugin.settings.durationPerImage = this.durationPerImage;
        this.plugin.settings.loop = this.loop;
        this.plugin.saveSettings();
        this.close();
        new SlideshowModal(this.app, this.plugin, this.selectedFolder, this.numPictures, this.durationPerImage, this.loop, this.enableLogging).open();
    }

    async clearLog() {
        if (!this.selectedFolder) return;
        const filePath = this.selectedFolder + '/_session_log.md';
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            await this.app.vault.delete(file);
            new Notice(this.plugin.t('noticeLogCleared'));
        } else {
            new Notice(this.plugin.t('noticeNoLog'));
        }
    }

    updatePromptBtn() {
        if (!this.promptBtn) return;
        if (!this.selectedFolder) {
            this.promptBtn.setButtonText('—');
            this.promptBtn.setDisabled(true);
            if (this.deletePromptBtn) this.deletePromptBtn.buttonEl.style.display = 'none';
            return;
        }
        const filePath = this.selectedFolder + '/_prompt.md';
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            this.promptBtn.setButtonText(this.plugin.t('editBtn'));
            this.promptBtn.setDisabled(false);
            if (this.deletePromptBtn) {
                this.deletePromptBtn.setDisabled(false);
                this.deletePromptBtn.setButtonText(this.plugin.t('deleteBtn'));
                this.deletePromptBtn.buttonEl.style.display = '';
            }
        } else {
            this.promptBtn.setButtonText(this.plugin.t('createBtn'));
            this.promptBtn.setDisabled(false);
            if (this.deletePromptBtn) this.deletePromptBtn.buttonEl.style.display = 'none';
        }
    }

    async deletePromptFile() {
        if (!this.selectedFolder) return;
        const filePath = this.selectedFolder + '/_prompt.md';
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            await this.app.vault.delete(file);
            new Notice(this.plugin.t('noticePromptDeleted'));
            this.updatePromptBtn();
        }
    }

    async promptFileAction() {
        if (!this.selectedFolder) return;
        const filePath = this.selectedFolder + '/_prompt.md';
        let file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            const template = this.plugin.t('promptTemplate');
            file = await this.app.vault.create(filePath, template);
        }
        const leaf = this.app.workspace.getLeaf();
        await leaf.openFile(file);
        this.close();
    }
}

class SlideshowModal extends Modal {
    constructor(app, plugin, sessionFolder, numPictures, durationPerImage, loop, enableLogging) {
        super(app);
        this.plugin = plugin;
        this.sessionFolder = sessionFolder;
        this.numPictures = numPictures;
        this.durationPerImage = durationPerImage;
        this.loop = loop;
        this.enableLogging = enableLogging;
        this.imageFiles = [];
        this.currentIndex = 0;
        this.sessionTimeRemaining = numPictures * durationPerImage;
        this.imageTimeRemaining = durationPerImage;
        this.isPaused = false;
        this.sessionEnded = false;
        this.showingEndOfDeck = false;
        this.shownImageNames = [];
        this.sessionInterval = null;
        this.imageInterval = null;

        this.scope.register([], 'Escape', (e) => { this.stopSession(); return false; });
    }

    async onOpen() {
        const folder = this.app.vault.getAbstractFileByPath(this.sessionFolder);
        if (!(folder instanceof TFolder)) {
            new Notice(this.plugin.t('noticeTopicNotFound'));
            this.close();
            return;
        }

        const allImages = [];
        this.collectImages(folder, allImages);

        if (allImages.length === 0) {
            new Notice(this.plugin.t('noticeNoImages'));
            this.close();
            return;
        }

        if (this.enableLogging) {
            const log = await this.readSessionLog();
            const newImages = shuffleArray(allImages.filter(f => !log.includes(f.name)));
            const oldImages = shuffleArray(allImages.filter(f => log.includes(f.name)));
            this.imageFiles = [...newImages.slice(0, this.numPictures)];
            if (this.imageFiles.length < this.numPictures) {
                this.imageFiles.push(...oldImages.slice(0, this.numPictures - this.imageFiles.length));
            }
        } else {
            this.imageFiles = shuffleArray(pickRandom(allImages, this.numPictures));
        }

        this.renderUI();

        try {
            if (this.modalEl.requestFullscreen) {
                await this.modalEl.requestFullscreen();
            }
        } catch (e) {
            // Fullscreen not available; modal fills viewport via CSS
        }

        await this.showIntroSlide();
        await this.showCountdown();
        this.scope.register([], 'ArrowLeft', () => { this.prevImage(); return false; });
        this.scope.register([], 'ArrowRight', () => { this.nextImage(); return false; });
        await this.showImage(0);
        this.startTimers();

        this.updateTimeDisplay();
    }

    onClose() {
        this.stopTimers();
        if (this.enableLogging) {
            this.writeSessionLog().catch(e => console.error('Failed to write session log:', e));
        }
        if (this.imageEl && this.imageEl.dataset.blobUrl) {
            URL.revokeObjectURL(this.imageEl.dataset.blobUrl);
        }
    }

    async showIntroSlide() {
        const folder = this.app.vault.getAbstractFileByPath(this.sessionFolder);
        if (!(folder instanceof TFolder)) return false;
        const targetName = '_prompt';
        const mdFile = folder.children.find(
            child => child instanceof TFile && child.name === targetName + '.md'
        );
        if (!mdFile) return false;

        const content = await this.app.vault.read(mdFile);
        const slideContent = content.split('\n---\n')[0];

        const introEl = this.contentEl.createDiv({ cls: 'drawing-session-intro' });
        const introContent = introEl.createDiv({ cls: 'drawing-session-intro-content' });
        await MarkdownRenderer.render(this.app, slideContent, introContent, this.sessionFolder, this);

        const len = introContent.textContent.length;
        let fontSize = '18px';
        if (len < 50) fontSize = '36px';
        else if (len < 150) fontSize = '28px';
        else if (len < 400) fontSize = '22px';
        introContent.style.fontSize = fontSize;

        if (this.controlsEl) this.controlsEl.style.display = 'none';
        if (this.timeDisplayEl) this.timeDisplayEl.style.display = 'none';
        if (this.imageEl) this.imageEl.style.display = 'none';

        const bottomBar = introEl.createDiv({ cls: 'drawing-session-intro-bottom' });
            const startBtn = bottomBar.createEl('button', { cls: 'mod-cta', text: this.plugin.t('introStartBtn') });

        return new Promise(resolve => {
            const dismiss = () => {
                if (this.controlsEl) this.controlsEl.style.display = '';
                if (this.timeDisplayEl) this.timeDisplayEl.style.display = '';
                if (this.imageEl) this.imageEl.style.display = '';
                introEl.remove();
                resolve(true);
            };
            startBtn.addEventListener('click', dismiss);
            this.scope.register([], ' ', () => { dismiss(); return false; });
            this.scope.register([], 'Enter', () => { dismiss(); return false; });
        });
    }

    showCountdown() {
        if (this.imageEl) this.imageEl.style.display = 'none';
        const countdownEl = this.contentEl.createDiv({ cls: 'drawing-session-countdown' });

        return new Promise(resolve => {
            let count = 5;
            countdownEl.textContent = String(count);

            const interval = window.setInterval(() => {
                count--;
                if (count <= 0) {
                    clearInterval(interval);
                    countdownEl.style.opacity = '0';
                    setTimeout(() => {
                        countdownEl.remove();
                        resolve();
                    }, 300);
                } else {
                    countdownEl.textContent = String(count);
                }
            }, 1000);
        });
    }

    collectImages(folder, result) {
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                this.collectImages(child, result);
            } else if (child instanceof TFile && IMAGE_EXTENSIONS.includes(child.extension.toLowerCase())) {
                result.push(child);
            }
        }
    }

    async readSessionLog() {
        const filePath = this.sessionFolder + '/_session_log.md';
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            try {
                const content = await this.app.vault.read(file);
                const names = [];
                for (const line of content.split('\n')) {
                    const m = line.match(/^- (.+)$/);
                    if (m) names.push(m[1]);
                }
                return names;
            } catch (e) {}
        }
        return [];
    }

    async writeSessionLog() {
        const lines = [this.plugin.t('sessionLogTitle'), '', this.plugin.t('sessionLogHeader')];
        for (const name of this.shownImageNames) {
            lines.push('- ' + name);
        }
        const content = lines.join('\n') + '\n';
        const filePath = this.sessionFolder + '/_session_log.md';
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(filePath, content);
        }
    }

    renderUI() {
        const { contentEl, modalEl } = this;

        modalEl.addClass('shuffle-lab-modal');

        contentEl.empty();
        contentEl.classList.add('drawing-session-modal');

        const topBar = contentEl.createDiv({ cls: 'drawing-session-topbar' });
        this.timeDisplayEl = topBar.createSpan({ cls: 'drawing-session-time' });
        this.counterDisplayEl = topBar.createSpan({ cls: 'drawing-session-counter' });

        this.imageContainerEl = contentEl.createDiv({ cls: 'drawing-session-image-container' });
        this.imageEl = this.imageContainerEl.createEl('img', { cls: 'drawing-session-image' });
        this.imageEl.addEventListener('error', () => {
            this.imageEl.alt = this.plugin.t('failedToLoad');
        });

        this.controlsEl = contentEl.createDiv({ cls: 'drawing-session-controls' });
        const controls = this.controlsEl;

        this.prevBtn = controls.createEl('button', { cls: 'drawing-session-btn', text: '\u25C0' });
        this.prevBtn.addEventListener('click', () => this.prevImage());

        this.pauseBtn = controls.createEl('button', { cls: 'drawing-session-btn', text: '\u23F8' });
        this.pauseBtn.addEventListener('click', () => this.togglePause());

        this.stopBtn = controls.createEl('button', { cls: 'drawing-session-btn', text: '\u23F9' });
        this.stopBtn.addEventListener('click', () => this.stopSession());

        this.nextBtn = controls.createEl('button', { cls: 'drawing-session-btn', text: '\u25B6' });
        this.nextBtn.addEventListener('click', () => this.nextImage());

        this.endOfDeckEl = contentEl.createDiv({ cls: 'drawing-session-endofdeck' });
        this.endOfDeckEl.createEl('div', { cls: 'drawing-session-endofdeck-icon', text: '\u2713' });
        this.endOfDeckEl.createEl('h2', { cls: 'drawing-session-endofdeck-title', text: this.plugin.t('endOfDeckTitle') });
        this.endOfDeckEl.createEl('p', { cls: 'drawing-session-endofdeck-hint', text: this.plugin.t('endOfDeckHint') });
        this.endOfDeckEl.style.display = 'none';

        this.scope.register([], ' ', (e) => { e.preventDefault(); this.togglePause(); return false; });
    }

    async showImage(index) {
        if (this.imageFiles.length === 0) return;

        this.showingEndOfDeck = false;
        this.endOfDeckEl.style.display = 'none';
        this.imageContainerEl.style.display = '';
        if (this.imageEl) this.imageEl.style.display = '';

        this.currentIndex = index;

        const file = this.imageFiles[this.currentIndex];
        if (!this.shownImageNames.includes(file.name)) {
            this.shownImageNames.push(file.name);
        }
        try {
            const data = await this.app.vault.readBinary(file);
            const mime = file.extension === 'svg' ? 'image/svg+xml' : 'image/' + file.extension;
            const blob = new Blob([data], { type: mime });
            const url = URL.createObjectURL(blob);
            if (this.imageEl.dataset.blobUrl) {
                URL.revokeObjectURL(this.imageEl.dataset.blobUrl);
            }
            this.imageEl.src = url;
            this.imageEl.dataset.blobUrl = url;
            this.imageEl.alt = file.name;
        } catch (e) {
            console.error('Failed to load image:', file.path, e);
            this.imageEl.src = '';
            this.imageEl.alt = this.plugin.t('failedToLoadName', file.name);
        }

        this.imageTimeRemaining = this.durationPerImage;
        this.updateNavState();
        this.updateTimeDisplay();
    }

    startTimers() {
        this.sessionInterval = window.setInterval(() => {
            if (this.isPaused) return;
            this.sessionTimeRemaining--;
            this.updateTimeDisplay();
            if (this.sessionTimeRemaining <= 0) {
                this.sessionComplete();
            }
        }, 1000);

        this.imageInterval = window.setInterval(() => {
            if (this.isPaused) return;
            this.imageTimeRemaining--;
            if (this.imageTimeRemaining <= 0) {
                this.nextImage();
            }
        }, 1000);
    }

    updateNavState() {
        if (this.sessionEnded) {
            this.prevBtn.style.display = 'none';
            this.nextBtn.style.display = '';
            return;
        }
        if (this.showingEndOfDeck) {
            this.prevBtn.style.display = '';
            this.nextBtn.style.display = '';
            return;
        }
        this.prevBtn.style.display = '';
        this.nextBtn.style.display = '';
    }

    stopTimers() {
        if (this.sessionInterval !== null) {
            clearInterval(this.sessionInterval);
            this.sessionInterval = null;
        }
        if (this.imageInterval !== null) {
            clearInterval(this.imageInterval);
            this.imageInterval = null;
        }
    }

    showEndOfDeck() {
        this.showingEndOfDeck = true;
        this.endOfDeckEl.style.display = '';
        this.imageTimeRemaining = this.durationPerImage;
        this.updateNavState();
    }

    nextImage() {
        if (this.sessionEnded) {
            this.stopSession();
            return;
        }
        if (this.showingEndOfDeck) {
            this.sessionComplete();
            return;
        }
        const next = this.currentIndex + 1;
        if (next >= this.imageFiles.length) {
            if (this.loop) {
                this.imageFiles = shuffleArray(this.imageFiles);
                this.showImage(0);
            } else {
                this.showEndOfDeck();
            }
        } else {
            this.showImage(next);
        }
    }

    prevImage() {
        if (this.sessionEnded) return;
        if (this.showingEndOfDeck) {
            this.showImage(this.imageFiles.length - 1);
            return;
        }
        const prev = this.currentIndex - 1;
        if (prev >= 0) {
            this.showImage(prev);
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseBtn.textContent = this.isPaused ? '\u25B6' : '\u23F8';
    }

    stopSession() {
        this.stopTimers();
        this.close();
    }

    sessionComplete() {
        this.stopTimers();
        this.isPaused = false;
        this.sessionEnded = true;
        this.showingEndOfDeck = false;
        if (this.endOfDeckEl) this.endOfDeckEl.style.display = 'none';
        if (this.pauseBtn) this.pauseBtn.style.display = 'none';
        if (this.stopBtn) this.stopBtn.style.display = 'none';
        this.updateNavState();

        this.sessionTimeRemaining = 0;
        this.updateTimeDisplay();

        const endEl = this.contentEl.createDiv({ cls: 'drawing-session-end' });
        endEl.createEl('div', { cls: 'drawing-session-end-icon', text: '\u2713' });
        endEl.createEl('h2', { cls: 'drawing-session-end-title', text: this.plugin.t('sessionCompleteTitle') });
        endEl.createEl('p', { cls: 'drawing-session-end-hint', text: this.plugin.t('sessionCompleteHint') });
    }

    updateTimeDisplay() {
        if (this.timeDisplayEl) {
            this.timeDisplayEl.textContent = '\u23F1 ' + formatTimeShort(this.sessionTimeRemaining);
        }
        if (this.counterDisplayEl) {
            this.counterDisplayEl.textContent = (this.currentIndex + 1) + ' / ' + this.imageFiles.length;
        }
    }
}

function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function pickRandom(arr, n) {
    const shuffled = shuffleArray(arr);
    return shuffled.slice(0, Math.min(n, shuffled.length));
}

function formatTimeShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function formatTimeLong(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(h + 'h');
    if (m > 0 || h > 0) parts.push(m + 'm');
    parts.push(s + 's');
    return parts.join(' ');
}
