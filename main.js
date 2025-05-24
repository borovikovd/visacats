// Constants
const CONFIG = {
    PETITIONS: {
        anti: {
            id: '700824',
            name: 'anti-immigration',
            selector: '#nyan-anti',
            countSelector: '#count-anti .count-number',
            crownSelector: '#crown-anti'
        },
        pro: {
            id: '727360',
            name: 'pro-immigration',
            selector: '#nyan-pro',
            countSelector: '#count-pro .count-number',
            crownSelector: '#crown-pro'
        }
    },
    API_BASE: 'https://petition.parliament.uk/petitions',
    POLL_INTERVAL: 15000,
    ANIMATION_DURATION: 1000,
    MAX_POSITION_PERCENT: 80,
    AUDIO: {
        SCHEDULE_AHEAD_TIME: 0.1,
        LOOKAHEAD_MS: 25,
        MELODY_LOOP_TIME: 2000, // Stately imperial march tempo
        NOTE_DURATION: 0.15,    // Shorter, peppier notes
        VOLUME: 0.1,            // Slightly louder for comedy effect
        VOLUME_DIP: 0.25
    },
    TOAST_DURATION: 5000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// Imperial British Empire themed melody with Nyan Cat energy
const MELODY_PATTERNS = {
    main: [
        // "Rule Britannia" inspired opening with Nyan bounce
        { freq: 523, time: 0, dur: 0.3 },        // C5 (strong imperial start)
        { freq: 659, time: 0.3, dur: 0.15 },     // E5 (rising majesty)
        { freq: 784, time: 0.45, dur: 0.15 },    // G5 (triumphant)
        { freq: 1047, time: 0.6, dur: 0.4 },     // C6 (imperial fanfare!)
        { freq: 784, time: 1.0, dur: 0.2 },      // G5 (march-like)
        { freq: 659, time: 1.2, dur: 0.2 },      // E5
        { freq: 523, time: 1.4, dur: 0.2 },      // C5 (resolute ending)
    ],
    variation: [
        // "God Save the Queen" motif with playful twist
        { freq: 784, time: 0, dur: 0.3 },        // G5 (stately)
        { freq: 784, time: 0.3, dur: 0.3 },      // G5 (repeat - ceremonial)
        { freq: 880, time: 0.6, dur: 0.3 },      // A5
        { freq: 784, time: 0.9, dur: 0.2 },      // G5
        { freq: 698, time: 1.1, dur: 0.2 },      // F5
        { freq: 659, time: 1.3, dur: 0.3 },      // E5 (resolution)
    ],
    bridge: [
        // Majestic imperial march bridge
        { freq: 1047, time: 0, dur: 0.2 },       // C6 (fanfare)
        { freq: 1175, time: 0.2, dur: 0.2 },     // D6 
        { freq: 1319, time: 0.4, dur: 0.4 },     // E6 (triumphant peak)
        { freq: 1175, time: 0.8, dur: 0.2 },     // D6
        { freq: 1047, time: 1.0, dur: 0.2 },     // C6
        { freq: 880, time: 1.2, dur: 0.2 },      // A5
        { freq: 784, time: 1.4, dur: 0.2 },      // G5 (march ending)
    ],
    harmony: [
        // Imperial C Major progression (I-IV-V-I) - strong and regal
        { freq: 330, time: 0, dur: 0.5 },       // E4 (3rd of C Major)
        { freq: 349, time: 0.5, dur: 0.5 },     // F4 (root of F Major)
        { freq: 392, time: 1.0, dur: 0.5 },     // G4 (root of G Major - dominant)
        { freq: 330, time: 1.5, dur: 0.5 },     // E4 (return to tonic)
    ],
    bass: [
        // Powerful imperial bass line - ceremonial march feel
        { freq: 131, time: 0, dur: 0.5 },       // C3 (I - strong tonic)
        { freq: 175, time: 0.5, dur: 0.5 },     // F3 (IV - subdominant)
        { freq: 196, time: 1.0, dur: 0.5 },     // G3 (V - dominant power)
        { freq: 131, time: 1.5, dur: 0.5 },     // C3 (I - imperial resolution)
    ]
};

// Imperial march rhythm - more ceremonial
const RHYTHM_CLICKS = [
    { time: 0, vol: 0.12 },      // BOOM (beat 1 - imperial strong)
    { time: 0.5, vol: 0.06 },    // tap (beat 2)
    { time: 1.0, vol: 0.10 },    // BOOM (beat 3 - march)
    { time: 1.5, vol: 0.06 },    // tap (beat 4)
    { time: 1.75, vol: 0.04 },   // grace note (military flair)
];

// Application state
class PetitionRaceApp {
    constructor() {
        this.petitionData = new Map();
        this.audioContext = null;
        this.bgmGainNode = null;
        this.melodyInterval = null;
        this.pollInterval = null;
        this.nextNoteTime = 0;
        this.isMuted = false;
        this.isAudioInitialized = false;
        this.shouldAutoplay = true;
        this.domCache = new Map();
        this.failedRequests = new Map();
        this.currentPattern = 0; // Track which pattern to play
        this.measureCount = 0;  // Track measures for variation
    }

    // Cache DOM queries
    getElement(selector) {
        if (!this.domCache.has(selector)) {
            this.domCache.set(selector, document.querySelector(selector));
        }
        return this.domCache.get(selector);
    }
    
    cleanup() {
        // Clean up intervals
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.melodyInterval) {
            clearInterval(this.melodyInterval);
            this.melodyInterval = null;
        }
        
        // Clean up audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        // Clear caches
        this.domCache.clear();
        this.petitionData.clear();
        this.failedRequests.clear();
    }
    
    pauseAudio() {
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }
    
    resumeAudio() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    async fetchWithRetry(url, attempts = CONFIG.RETRY_ATTEMPTS) {
        for (let i = 0; i < attempts; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response; // Return response, don't parse JSON here
            } catch (error) {
                console.warn(`Fetch attempt ${i + 1} failed:`, error.message);
                if (i === attempts - 1) {
                    throw new Error(`Failed to fetch after ${attempts} attempts: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
            }
        }
    }

    async fetchSignatureCount(petitionConfig) {
        const cacheKey = petitionConfig.id;
        const lastFailure = this.failedRequests.get(cacheKey);
        
        // Skip if recently failed
        if (lastFailure && Date.now() - lastFailure < CONFIG.POLL_INTERVAL * 2) {
            return null;
        }

        try {
            const response = await this.fetchWithRetry(
                `${CONFIG.API_BASE}/${petitionConfig.id}/count.json`
            );
            const data = await response.json();
            this.failedRequests.delete(cacheKey);
            return data.signature_count || 0;
        } catch (error) {
            console.error(`Failed to fetch petition ${petitionConfig.id}:`, error);
            this.failedRequests.set(cacheKey, Date.now());
            this.showToast(`Failed to fetch ${petitionConfig.name} data: ${error.message}`);
            return null;
        }
    }

    updateCatPosition(petitionConfig, count, maxCount, antiCount, proCount) {
        const data = this.petitionData.get(petitionConfig.name) || { lastCount: 0 };
        
        const nyanWrapper = this.getElement(petitionConfig.selector);
        if (!nyanWrapper) return;

        // Calculate position based on relative performance
        // Higher count = further ahead
        const totalSignatures = antiCount + proCount;
        const thisPercentage = totalSignatures > 0 ? (count / totalSignatures) : 0.5;
        
        // Map to track positions: 50% to 80%
        const MIN_POSITION = 50;
        const MAX_POSITION = 80;
        const basePosition = MIN_POSITION + (thisPercentage * (MAX_POSITION - MIN_POSITION));
        
        // Add some movement when count increases for visual feedback
        let finalPosition = basePosition;
        const countIncreased = count > data.lastCount && data.lastCount > 0;
        
        if (countIncreased) {
            // Add a small forward bounce for visual feedback
            finalPosition += 2;
            
            // Only show rainbow trail if THIS cat's count increased
            nyanWrapper.classList.add('moving');
            this.duckAudioVolume();
            
            // Add a little hop animation
            nyanWrapper.style.transform = `translateY(-50%) scaleY(1.1)`;
            
            setTimeout(() => {
                nyanWrapper.classList.remove('moving');
                nyanWrapper.style.transform = `translateY(-50%)`;
                // Return to calculated position after animation
                nyanWrapper.style.left = `${basePosition}%`;
            }, CONFIG.ANIMATION_DURATION);
        }
        
        // Ensure we don't exceed track bounds
        finalPosition = Math.min(Math.max(finalPosition, MIN_POSITION), CONFIG.MAX_POSITION_PERCENT);
        
        // Update position
        nyanWrapper.style.left = `${finalPosition}%`;
        
        // Announce position changes to screen readers
        this.announceToScreenReader(`${petitionConfig.name} petition: ${count.toLocaleString()} signatures`);
        
        // Update count display with some flair
        const countElement = this.getElement(petitionConfig.countSelector);
        if (countElement) {
            const formattedCount = count.toLocaleString();
            const oldCount = parseInt(countElement.textContent.replace(/,/g, '')) || 0;
            
            if (count > oldCount && oldCount > 0) {
                // Calculate the increase
                const increase = count - oldCount;
                
                // Add animation class
                countElement.style.animation = 'counter-pulse 0.6s ease-out';
                
                // Flash with color based on petition type
                const flashColor = petitionConfig.name === 'anti-immigration' ? 
                    'var(--accent-red)' : 'var(--accent-blue)';
                
                countElement.style.color = flashColor;
                countElement.style.textShadow = `0 0 20px ${flashColor}, 0 0 40px ${flashColor}`;
                
                // Add floating number effect
                const changeIndicator = document.createElement('span');
                changeIndicator.className = 'count-change';
                changeIndicator.textContent = `+${increase.toLocaleString()}`;
                changeIndicator.style.cssText = `
                    position: absolute;
                    top: -10px;
                    right: -40px;
                    font-size: 0.8em;
                    color: var(--rainbow-4);
                    font-weight: bold;
                    animation: float-up 1s ease-out;
                    pointer-events: none;
                    text-shadow: 0 0 10px currentColor;
                `;
                countElement.parentElement.style.position = 'relative';
                countElement.parentElement.appendChild(changeIndicator);
                
                // Remove elements after animation
                setTimeout(() => {
                    countElement.style.animation = '';
                    countElement.style.color = '';
                    countElement.style.textShadow = '0 0 5px currentColor';
                    changeIndicator.remove();
                }, 1000);
            }
            countElement.textContent = formattedCount;
        }
        
        // Store updated data
        this.petitionData.set(petitionConfig.name, { ...data, lastCount: count });
    }

    duckAudioVolume() {
        if (!this.isAudioInitialized || this.isMuted || !this.bgmGainNode) return;
        
        const currentTime = this.audioContext.currentTime;
        this.bgmGainNode.gain.exponentialRampToValueAtTime(
            CONFIG.AUDIO.VOLUME_DIP, 
            currentTime + 0.1
        );
        this.bgmGainNode.gain.exponentialRampToValueAtTime(
            1, 
            currentTime + 1.1
        );
    }

    updateLeaderCrown(antiCount, proCount) {
        const antiCrown = this.getElement(CONFIG.PETITIONS.anti.crownSelector);
        const proCrown = this.getElement(CONFIG.PETITIONS.pro.crownSelector);
        
        if (!antiCrown || !proCrown) return;

        // Remove all crowns first
        [antiCrown, proCrown].forEach(crown => crown.classList.remove('active'));
        
        // Add crown to leader
        if (antiCount > proCount) {
            antiCrown.classList.add('active');
        } else if (proCount > antiCount) {
            proCrown.classList.add('active');
        }
    }

    async updateRace() {
        const updateStatus = this.getElement('#update-status');
        if (updateStatus) {
            updateStatus.textContent = 'Updating...';
        }
        
        const [antiCount, proCount] = await Promise.all([
            this.fetchSignatureCount(CONFIG.PETITIONS.anti),
            this.fetchSignatureCount(CONFIG.PETITIONS.pro)
        ]);
        
        if (antiCount !== null && proCount !== null) {
            const maxCount = Math.max(antiCount, proCount);
            
            this.updateCatPosition(CONFIG.PETITIONS.anti, antiCount, maxCount, antiCount, proCount);
            this.updateCatPosition(CONFIG.PETITIONS.pro, proCount, maxCount, antiCount, proCount);
            this.updateLeaderCrown(antiCount, proCount);
            
            if (updateStatus) {
                updateStatus.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
        } else if (updateStatus) {
            updateStatus.textContent = 'Update failed - retrying...';
        }
    }

    showToast(message) {
        const toast = this.getElement('#error-toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, CONFIG.TOAST_DURATION);
    }

    async initAudio() {
        if (this.isAudioInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.bgmGainNode = this.audioContext.createGain();
            this.bgmGainNode.connect(this.audioContext.destination);
            
            this.isAudioInitialized = true;
            
            // Start playing if not muted
            if (!this.isMuted) {
                this.startMelody();
            }
        } catch (error) {
            console.error('Audio initialization failed:', error);
            this.showToast('Audio initialization failed - music disabled');
        }
    }

    startMelody() {
        if (this.melodyInterval) {
            clearInterval(this.melodyInterval);
            this.melodyInterval = null;
        }
        
        this.nextNoteTime = this.audioContext.currentTime;
        this.scheduleMelody();
        this.melodyInterval = setInterval(
            () => this.scheduleMelody(), 
            CONFIG.AUDIO.LOOKAHEAD_MS
        );
    }

    scheduleMelody() {
        if (!this.isAudioInitialized) return;
        
        const scheduleAheadTime = CONFIG.AUDIO.SCHEDULE_AHEAD_TIME;
        
        while (this.nextNoteTime < this.audioContext.currentTime + scheduleAheadTime) {
            this.scheduleNotes(this.nextNoteTime);
            this.nextNoteTime += CONFIG.AUDIO.MELODY_LOOP_TIME / 1000;
        }
    }

    scheduleNotes(startTime) {
        // More interesting pattern progression to avoid repetitiveness
        this.measureCount++;
        const cycle = this.measureCount % 16; // 16-measure cycle for more variety
        
        let melodyPattern;
        let rhythmIntensity = 1.0;
        
        if (cycle < 2) {
            // Start with main melody
            melodyPattern = MELODY_PATTERNS.main;
        } else if (cycle < 4) {
            // Quick variation
            melodyPattern = MELODY_PATTERNS.variation;
            rhythmIntensity = 1.2;
        } else if (cycle < 6) {
            // Back to main but quieter
            melodyPattern = MELODY_PATTERNS.main;
            rhythmIntensity = 0.7;
        } else if (cycle < 8) {
            // Variation with more energy
            melodyPattern = MELODY_PATTERNS.variation;
            rhythmIntensity = 1.4;
        } else if (cycle < 10) {
            // Main again
            melodyPattern = MELODY_PATTERNS.main;
        } else if (cycle < 12) {
            // Variation
            melodyPattern = MELODY_PATTERNS.variation;
            rhythmIntensity = 0.8;
        } else if (cycle < 14) {
            // Bridge pattern for musical development
            melodyPattern = MELODY_PATTERNS.bridge;
            rhythmIntensity = 0.6;
        } else {
            // Big finish variation
            melodyPattern = MELODY_PATTERNS.variation;
            rhythmIntensity = 1.5;
        }
        
        // Dynamic volume based on cycle position
        let volume = CONFIG.AUDIO.VOLUME * 0.9;
        if (cycle >= 6 && cycle < 8) {
            volume *= 1.1; // Slightly louder for energy burst
        } else if (cycle >= 12 && cycle < 14) {
            volume *= 0.8; // Quieter for contrast
        }
        
        // Play main melody with bouncy piano sound
        melodyPattern.forEach(note => {
            this.playPianoNote(startTime + note.time, note.freq, note.dur, volume);
        });
        
        // Add circus-style rhythm with varying intensity
        RHYTHM_CLICKS.forEach(click => {
            this.playClick(startTime + click.time, click.vol * rhythmIntensity);
        });
        
        // Add a "meow" sound effect at the end of the full sequence
        if (this.measureCount % 16 === 15) {
            this.playMeow(startTime + 0.7);
        }
    }
    
    playNote(time, frequency, duration, waveform = 'sine', volume = CONFIG.AUDIO.VOLUME) {
        // Skip if frequency is 0 (rest)
        if (frequency === 0) return;
        
        const oscillator = this.audioContext.createOscillator();
        const noteGain = this.audioContext.createGain();
        
        oscillator.type = waveform;
        oscillator.frequency.value = frequency;
        
        // Add subtle vibrato only for non-square waves
        if (waveform !== 'square') {
            const vibrato = this.audioContext.createOscillator();
            vibrato.frequency.value = 4; // 4Hz vibrato (English style)
            const vibratoGain = this.audioContext.createGain();
            vibratoGain.gain.value = frequency * 0.005; // 0.5% pitch variation (subtle)
            vibrato.connect(vibratoGain);
            vibratoGain.connect(oscillator.frequency);
            vibrato.start(time);
            vibrato.stop(time + duration);
        }
        
        oscillator.connect(noteGain);
        noteGain.connect(this.bgmGainNode);
        
        // Smooth envelope
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(volume, time + 0.02);
        noteGain.gain.setValueAtTime(volume, time + duration - 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        oscillator.start(time);
        oscillator.stop(time + duration + 0.01);
    }
    
    playPianoNote(time, frequency, duration, volume = CONFIG.AUDIO.VOLUME) {
        // Skip if frequency is 0 (rest) or audio not initialized
        if (frequency === 0 || !this.isAudioInitialized) return;
        
        // Create multiple oscillators for warm, pleasant piano sound
        const fundamentalGain = this.audioContext.createGain();
        fundamentalGain.connect(this.bgmGainNode);
        
        // Add a subtle low-pass filter for warmth
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        filter.Q.value = 0.5;
        filter.connect(fundamentalGain);
        
        // Fundamental frequency
        const osc1 = this.audioContext.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = frequency;
        osc1.connect(filter);
        
        // Second harmonic (octave) - much quieter for softness
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = frequency * 2;
        const harm2Gain = this.audioContext.createGain();
        harm2Gain.gain.value = 0.15;
        osc2.connect(harm2Gain);
        harm2Gain.connect(filter);
        
        // Add slight detuning for warmth
        const osc3 = this.audioContext.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = frequency * 1.002;
        const detuneGain = this.audioContext.createGain();
        detuneGain.gain.value = 0.1;
        osc3.connect(detuneGain);
        detuneGain.connect(filter);
        
        // Gentle piano envelope
        fundamentalGain.gain.setValueAtTime(0, time);
        fundamentalGain.gain.linearRampToValueAtTime(volume * 0.8, time + 0.01);
        fundamentalGain.gain.exponentialRampToValueAtTime(volume * 0.5, time + 0.2);
        fundamentalGain.gain.exponentialRampToValueAtTime(volume * 0.3, time + duration * 0.7);
        fundamentalGain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.3);
        
        // Start all oscillators
        osc1.start(time);
        osc2.start(time);
        osc3.start(time);
        
        // Stop all oscillators and clean up - IMPORTANT for memory management
        const stopTime = time + duration + 0.5;
        osc1.stop(stopTime);
        osc2.stop(stopTime);
        osc3.stop(stopTime);
        
        // Properly disconnect nodes after use to prevent memory leaks
        osc1.onended = () => {
            osc1.disconnect();
            osc2.disconnect();
            osc3.disconnect();
            harm2Gain.disconnect();
            detuneGain.disconnect();
            filter.disconnect();
            fundamentalGain.disconnect();
        };
    }
    
    playClick(time, volume) {
        const oscillator = this.audioContext.createOscillator();
        const noteGain = this.audioContext.createGain();
        
        // Use noise-like sound for click
        oscillator.type = 'square';
        oscillator.frequency.value = 200 + Math.random() * 100;
        
        oscillator.connect(noteGain);
        noteGain.connect(this.bgmGainNode);
        
        // Very short envelope for click
        noteGain.gain.setValueAtTime(volume, time);
        noteGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        
        oscillator.start(time);
        oscillator.stop(time + 0.05);
    }
    
    playBellChime(time) {
        // Bell chime in F# Major to match the melody key
        const bellFreqs = [740, 932, 1109]; // F#5, A#5, C#6 - F# major triad
        
        bellFreqs.forEach((freq, index) => {
            const oscillator = this.audioContext.createOscillator();
            const noteGain = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = freq;
            
            // Add harmonics for bell-like quality
            const harmonic = this.audioContext.createOscillator();
            harmonic.type = 'sine';
            harmonic.frequency.value = freq * 2;
            const harmonicGain = this.audioContext.createGain();
            harmonicGain.gain.value = 0.3;
            
            oscillator.connect(noteGain);
            harmonic.connect(harmonicGain);
            harmonicGain.connect(noteGain);
            noteGain.connect(this.bgmGainNode);
            
            const startTime = time + (index * 0.1); // Slight arpeggio
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(CONFIG.AUDIO.VOLUME * 0.15, startTime + 0.01);
            noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
            
            oscillator.start(startTime);
            harmonic.start(startTime);
            oscillator.stop(startTime + 0.8);
            harmonic.stop(startTime + 0.8);
        });
    }
    
    playMeow(time) {
        // Synthesized "meow" sound effect
        const meow = this.audioContext.createOscillator();
        const meowGain = this.audioContext.createGain();
        
        meow.type = 'sine';
        // Quick frequency sweep for "meow"
        meow.frequency.setValueAtTime(800, time);
        meow.frequency.exponentialRampToValueAtTime(1200, time + 0.1);
        meow.frequency.exponentialRampToValueAtTime(600, time + 0.2);
        
        meow.connect(meowGain);
        meowGain.connect(this.bgmGainNode);
        
        meowGain.gain.setValueAtTime(0, time);
        meowGain.gain.linearRampToValueAtTime(CONFIG.AUDIO.VOLUME * 0.5, time + 0.05);
        meowGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        meow.start(time);
        meow.stop(time + 0.2);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        // Update audio status display
        const audioStatus = this.getElement('#audio-status');
        if (audioStatus) {
            const icon = audioStatus.querySelector('.audio-icon');
            if (icon) {
                icon.textContent = this.isMuted ? '🔇' : '🔊';
            }
            audioStatus.classList.toggle('muted', this.isMuted);
        }
        
        // Update body class
        document.body.classList.toggle('audio-playing', !this.isMuted);
        
        // Control volume
        if (this.bgmGainNode) {
            this.bgmGainNode.gain.setValueAtTime(
                this.isMuted ? 0 : 1, 
                this.audioContext.currentTime
            );
        }
    }

    handleVisibilityChange() {
        if (!document.hidden) {
            this.updateRace();
        }
    }

    setupEventListeners() {
        // Click anywhere to toggle audio
        document.addEventListener('click', async (e) => {
            // Ignore clicks on links
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            // Initialize audio on first click
            if (!this.isAudioInitialized) {
                this.isMuted = false; // Start unmuted on first click
                await this.initAudio();
                // Update UI to show playing state
                this.toggleMute();
                this.toggleMute(); // Toggle twice to end up in playing state
            } else {
                // Toggle mute state on subsequent clicks
                this.toggleMute();
            }
        });

        // Visibility change
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'm' || e.key === 'M' || e.key === ' ') {
                e.preventDefault();
                if (this.isAudioInitialized) {
                    this.toggleMute();
                }
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    cleanup() {
        if (this.melodyInterval) {
            clearInterval(this.melodyInterval);
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
    
    announceToScreenReader(message) {
        const announcer = this.getElement('#sr-announcements');
        if (announcer) {
            announcer.textContent = message;
            // Clear after a moment to ensure it can be announced again
            setTimeout(() => {
                announcer.textContent = '';
            }, 1000);
        }
    }

    async init() {
        // Add Nyan Cat image as background
        const nyanCats = document.querySelectorAll('.nyan-cat');
        nyanCats.forEach(cat => {
            cat.style.backgroundImage = 'url(assets/nyan.webp)';
        });
        
        // Position cats near finish line (around 70%)
        document.querySelectorAll('.nyan-wrapper').forEach(wrapper => {
            wrapper.style.left = '70%';
        });
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start initial update
        await this.updateRace();
        
        // Set up polling
        this.pollInterval = setInterval(() => this.updateRace(), CONFIG.POLL_INTERVAL);
        
        // Don't try autoplay - wait for user interaction
    }
}

// Initialize app when DOM is ready
const app = new PetitionRaceApp();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Check for reduced motion preference
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');
}