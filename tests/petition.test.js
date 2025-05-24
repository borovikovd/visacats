/**
 * @jest-environment jsdom
 */

// Mock the entire main.js module
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock timers
let mockTimeoutId = 1;
const mockSetTimeout = jest.fn((callback, delay) => {
    return mockTimeoutId++;
});
const mockClearTimeout = jest.fn();
global.setTimeout = mockSetTimeout;
global.clearTimeout = mockClearTimeout;

// Mock Web Audio API
const mockAudioContext = {
    createGain: jest.fn(() => ({
        connect: jest.fn(),
        gain: { 
            value: 1,
            setValueAtTime: jest.fn(),
            linearRampToValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn()
        }
    })),
    createOscillator: jest.fn(() => ({
        connect: jest.fn(),
        frequency: { 
            value: 440,
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn()
        },
        type: 'sine',
        start: jest.fn(),
        stop: jest.fn(),
        onended: null,
        disconnect: jest.fn()
    })),
    createBiquadFilter: jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        type: 'lowpass',
        frequency: { value: 2000 },
        Q: { value: 1 }
    })),
    destination: {},
    currentTime: 0,
    state: 'running',
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    suspend: jest.fn().mockResolvedValue(undefined)
};

global.AudioContext = jest.fn(() => mockAudioContext);
global.webkitAudioContext = jest.fn(() => mockAudioContext);

// Mock window.matchMedia
global.matchMedia = jest.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
}));

// Mock AbortController
global.AbortController = jest.fn(() => ({
    signal: { aborted: false },
    abort: jest.fn()
}));

// Import after mocks are set up
let PetitionRaceApp, CONFIG, MELODY_PATTERNS, RHYTHM_CLICKS;

beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockTimeoutId = 1;
    
    // Set up DOM
    document.body.innerHTML = `
        <div id="update-status"></div>
        <div id="error-toast" class="toast"></div>
        <div id="sr-announcements"></div>
        <div id="audio-status">
            <span class="audio-icon">🔊</span> Click anywhere to toggle music
        </div>
        <div id="nyan-anti" class="nyan-wrapper">
            <div class="rainbow-trail"></div>
        </div>
        <div id="nyan-pro" class="nyan-wrapper">
            <div class="rainbow-trail"></div>
        </div>
        <div id="count-anti">
            <span class="count-number">0</span>
        </div>
        <div id="count-pro">
            <span class="count-number">0</span>
        </div>
        <div id="crown-anti" class="crown"></div>
        <div id="crown-pro" class="crown"></div>
    `;

    // Mock document.readyState to prevent auto-init
    Object.defineProperty(document, 'readyState', {
        writable: true,
        configurable: true,
        value: 'loading'
    });
    
    // Import the actual implementation
    jest.isolateModules(() => {
        const mainModule = require('../main.js');
        PetitionRaceApp = mainModule.PetitionRaceApp;
        CONFIG = mainModule.CONFIG;
        MELODY_PATTERNS = mainModule.MELODY_PATTERNS;
        RHYTHM_CLICKS = mainModule.RHYTHM_CLICKS;
    });
});

describe('PetitionRaceApp', () => {
    let app;

    beforeEach(() => {
        app = new PetitionRaceApp();
    });

    describe('Initialization', () => {
        test('constructor initializes properties correctly', () => {
            expect(app.petitionData).toBeInstanceOf(Map);
            expect(app.audioContext).toBeNull();
            expect(app.bgmGainNode).toBeNull();
            expect(app.melodyInterval).toBeNull();
            expect(app.pollInterval).toBeNull();
            expect(app.nextNoteTime).toBe(0);
            expect(app.isPlaying).toBe(false);
            expect(app.isMuted).toBe(true);
            expect(app.measureCount).toBe(0);
            expect(app.domCache).toBeInstanceOf(Map);
            expect(app.failedRequests).toBeInstanceOf(Map);
        });

        test('init method sets up event listeners and starts polling', async () => {
            const updateRaceSpy = jest.spyOn(app, 'updateRace').mockResolvedValue();
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            const setupEventListenersSpy = jest.spyOn(app, 'setupEventListeners').mockImplementation();

            await app.init();

            expect(setupEventListenersSpy).toHaveBeenCalled();
            expect(updateRaceSpy).toHaveBeenCalled();
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), CONFIG.POLL_INTERVAL);
            
            // Check cat positioning
            const cats = document.querySelectorAll('.nyan-wrapper');
            expect(cats[0].style.left).toBe('70%');
            expect(cats[1].style.left).toBe('70%');
        });

        test('destructor cleans up resources', () => {
            app.pollInterval = setInterval(() => {}, 1000);
            app.melodyInterval = setInterval(() => {}, 100);
            app.audioContext = mockAudioContext;
            app.domCache.set('test', document.createElement('div'));
            app.petitionData.set('test', { count: 100 });
            app.failedRequests.set('test', 1);

            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            app.destructor();

            expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
            expect(mockAudioContext.close).toHaveBeenCalled();
            expect(app.domCache.size).toBe(0);
            expect(app.petitionData.size).toBe(0);
            expect(app.failedRequests.size).toBe(0);
        });
    });

    describe('Audio Control', () => {
        test('pauseAudio suspends audio context', () => {
            app.audioContext = mockAudioContext;
            mockAudioContext.state = 'running';

            app.pauseAudio();

            expect(mockAudioContext.suspend).toHaveBeenCalled();
        });

        test('resumeAudio resumes suspended audio context', () => {
            app.audioContext = mockAudioContext;
            mockAudioContext.state = 'suspended';

            app.resumeAudio();

            expect(mockAudioContext.resume).toHaveBeenCalled();
        });

        test('pauseAudio does nothing if audio not running', () => {
            app.audioContext = mockAudioContext;
            mockAudioContext.state = 'suspended';

            app.pauseAudio();

            expect(mockAudioContext.suspend).not.toHaveBeenCalled();
        });
    });

    describe('Petition Data Fetching', () => {
        test('fetchWithRetry handles timeout', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

            const abortSpy = jest.fn();
            global.AbortController = jest.fn(() => ({
                signal: { aborted: false },
                abort: abortSpy
            }));

            const promise = app.fetchWithRetry('https://test.com', 1);
            
            // Trigger the timeout
            const timeoutCallback = mockSetTimeout.mock.calls[0][0];
            timeoutCallback();

            await expect(promise).rejects.toThrow();
            expect(abortSpy).toHaveBeenCalled();
        });

        test('fetchWithRetry clears timeout on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: 'test' })
            });

            await app.fetchWithRetry('https://test.com');

            expect(mockClearTimeout).toHaveBeenCalled();
        });

        test('fetchSignatureCount returns valid count on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ 
                    data: { 
                        attributes: { 
                            signature_count: 12345,
                            state: 'open'
                        } 
                    } 
                })
            });

            const count = await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(count).toBe(12345);
            expect(app.failedRequests.has('anti-immigration')).toBe(false);
        });

        test('fetchSignatureCount returns cached value on 429', async () => {
            app.petitionData.set('anti-immigration', { count: 5000 });
            mockFetch.mockResolvedValue({
                ok: false,
                status: 429
            });

            const count = await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(count).toBe(5000);
        });

        test('fetchSignatureCount returns 0 for rejected petitions', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ 
                    data: { 
                        attributes: { 
                            state: 'rejected',
                            signature_count: 12345 
                        } 
                    } 
                })
            });

            const count = await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(count).toBe(0);
        });

        test('fetchSignatureCount handles malformed response', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ invalid: 'response' })
            });

            const count = await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(count).toBe(0);
        });

        test('updateRace handles partial failures', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ 
                        data: { attributes: { signature_count: 1000, state: 'open' } } 
                    })
                })
                .mockRejectedValueOnce(new Error('Network error'));

            const showToastSpy = jest.spyOn(app, 'showToast');
            await app.updateRace();

            expect(app.petitionData.get('anti-immigration').count).toBe(1000);
            expect(showToastSpy).not.toHaveBeenCalled(); // Partial success doesn't show error
        });
    });

    describe('UI Updates', () => {
        test('getElement caches DOM queries', () => {
            const element = document.querySelector('#update-status');
            const result1 = app.getElement('#update-status');
            const result2 = app.getElement('#update-status');

            expect(result1).toBe(element);
            expect(result2).toBe(element);
            expect(app.domCache.size).toBe(1);
        });

        test('updateDisplay updates all UI components', () => {
            app.petitionData.set('anti-immigration', { count: 5000, prevCount: 4000 });
            app.petitionData.set('pro-immigration', { count: 10000, prevCount: 9000 });

            const updateCatPositionsSpy = jest.spyOn(app, 'updateCatPositions');
            const updateCountersSpy = jest.spyOn(app, 'updateCounters');
            const updateLeaderCrownSpy = jest.spyOn(app, 'updateLeaderCrown');

            app.updateDisplay();

            expect(updateCatPositionsSpy).toHaveBeenCalled();
            expect(updateCountersSpy).toHaveBeenCalled();
            expect(updateLeaderCrownSpy).toHaveBeenCalled();
        });

        test('updateCatPositions handles equal counts', () => {
            app.petitionData.set('anti-immigration', { count: 5000, prevCount: 4500 });
            app.petitionData.set('pro-immigration', { count: 5000, prevCount: 4500 });

            app.updateCatPositions();

            const antiCat = document.querySelector('#nyan-anti');
            const proCat = document.querySelector('#nyan-pro');
            
            expect(antiCat.style.left).toBe('40%');
            expect(proCat.style.left).toBe('40%');
        });

        test('updateCatPositions handles zero counts', () => {
            app.petitionData.set('anti-immigration', { count: 0, prevCount: 0 });
            app.petitionData.set('pro-immigration', { count: 0, prevCount: 0 });

            app.updateCatPositions();

            const antiCat = document.querySelector('#nyan-anti');
            const proCat = document.querySelector('#nyan-pro');
            
            expect(antiCat.style.left).toBe('0%');
            expect(proCat.style.left).toBe('0%');
        });

        test('updateCounters handles missing counter elements', () => {
            document.querySelector('#count-anti').remove();
            
            app.petitionData.set('anti-immigration', { count: 12345, prevCount: 10000 });
            app.petitionData.set('pro-immigration', { count: 67890, prevCount: 67890 });

            // Should not throw
            expect(() => app.updateCounters()).not.toThrow();
        });

        test('animateCounterChange removes animation after completion', () => {
            jest.useFakeTimers();
            const countEl = document.querySelector('#count-anti .count-number');
            
            app.animateCounterChange(countEl, 100);
            
            expect(countEl.style.animation).toBe('counter-pulse 0.5s ease-out');
            
            jest.advanceTimersByTime(500);
            
            expect(countEl.style.animation).toBe('');
            jest.useRealTimers();
        });

        test('updateStatus shows time since last update', () => {
            const statusEl = document.querySelector('#update-status');
            app.updateStatus();

            expect(statusEl.textContent).toContain('Last updated:');
        });
    });

    describe('Audio System', () => {
        test('initAudio handles WebKit audio context', async () => {
            global.AudioContext = undefined;
            global.webkitAudioContext = jest.fn(() => mockAudioContext);

            await app.initAudio();

            expect(global.webkitAudioContext).toHaveBeenCalled();
            expect(app.audioContext).toBe(mockAudioContext);
        });

        test('initAudio handles audio initialization errors', async () => {
            global.AudioContext = jest.fn(() => {
                throw new Error('Audio not supported');
            });
            console.error = jest.fn();

            await app.initAudio();

            expect(console.error).toHaveBeenCalledWith('Audio initialization failed:', expect.any(Error));
            expect(app.isAudioInitialized).toBe(false);
        });

        test('toggleAudio handles audio context errors', async () => {
            app.isAudioInitialized = false;
            jest.spyOn(app, 'initAudio').mockRejectedValue(new Error('Audio error'));
            
            await app.toggleAudio();

            expect(app.isAudioInitialized).toBe(false);
        });

        test('scheduleMelody handles missing audio context', () => {
            app.isAudioInitialized = false;
            
            // Should not throw
            expect(() => app.scheduleMelody()).not.toThrow();
        });

        test('scheduleNotes varies patterns based on measure count', () => {
            app.audioContext = mockAudioContext;
            app.isAudioInitialized = true;
            const playPianoNoteSpy = jest.spyOn(app, 'playPianoNote').mockImplementation();
            const playBellChimeSpy = jest.spyOn(app, 'playBellChime').mockImplementation();

            // Test variation pattern (measure 2)
            app.measureCount = 1;
            app.scheduleNotes(0);
            expect(playPianoNoteSpy).toHaveBeenCalledTimes(MELODY_PATTERNS.variation.length);

            // Test bridge pattern (measure 12)
            playPianoNoteSpy.mockClear();
            app.measureCount = 11;
            app.scheduleNotes(0);
            expect(playPianoNoteSpy).toHaveBeenCalledTimes(MELODY_PATTERNS.bridge.length);

            // Test bell chime on measures 3, 7, 11
            app.measureCount = 2;
            app.scheduleNotes(0);
            expect(playBellChimeSpy).toHaveBeenCalled();
        });

        test('playNote skips when frequency is 0', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();

            app.playNote(1.0, 0, 0.5);

            expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
        });

        test('playNote adds vibrato for non-square waves', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();

            app.playNote(1.0, 440, 0.5, 'sine');

            expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2); // Main + vibrato
        });

        test('playPianoNote handles onended cleanup', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();
            app.isAudioInitialized = true;

            app.playPianoNote(1.0, 440, 0.5);

            // Get the first oscillator and trigger its onended
            const osc = mockAudioContext.createOscillator();
            const onended = mockAudioContext.createOscillator.mock.results[0].value.onended;
            
            expect(typeof onended).toBe('function');
            
            // Trigger cleanup
            onended();

            expect(osc.disconnect).toHaveBeenCalled();
        });

        test('playBellChime creates multiple bell sounds', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();

            app.playBellChime(1.0);

            // 3 frequencies × 2 oscillators (main + harmonic) = 6
            expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(6);
        });

        test('toggleMute updates UI when unmuting', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();
            app.isMuted = true;

            app.toggleMute();

            expect(app.isMuted).toBe(false);
            expect(app.bgmGainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, 0);
            
            const audioIcon = document.querySelector('.audio-icon');
            expect(audioIcon.textContent).toBe('🔊');
            expect(document.body.classList.contains('audio-playing')).toBe(true);
        });
    });

    describe('Event Handlers', () => {
        test('handleVisibilityChange updates race when visible', () => {
            const updateRaceSpy = jest.spyOn(app, 'updateRace').mockResolvedValue();
            
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                get: () => false
            });

            app.handleVisibilityChange();

            expect(updateRaceSpy).toHaveBeenCalled();
        });

        test('handleVisibilityChange skips update when hidden', () => {
            const updateRaceSpy = jest.spyOn(app, 'updateRace');
            
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                get: () => true
            });

            app.handleVisibilityChange();

            expect(updateRaceSpy).not.toHaveBeenCalled();
        });

        test('keyboard shortcuts work with different keys', () => {
            app.setupEventListeners();
            app.isAudioInitialized = true;
            const toggleMuteSpy = jest.spyOn(app, 'toggleMute').mockImplementation();

            // Test 'M' key
            let keyEvent = new KeyboardEvent('keydown', { key: 'M' });
            document.dispatchEvent(keyEvent);
            expect(toggleMuteSpy).toHaveBeenCalledTimes(1);

            // Test space key
            keyEvent = new KeyboardEvent('keydown', { key: ' ' });
            document.dispatchEvent(keyEvent);
            expect(toggleMuteSpy).toHaveBeenCalledTimes(2);
        });

        test('click handler toggles mute when audio already initialized', async () => {
            app.setupEventListeners();
            app.isAudioInitialized = true;
            
            const toggleMuteSpy = jest.spyOn(app, 'toggleMute').mockImplementation();

            const div = document.createElement('div');
            div.closest = jest.fn(() => null);
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: div, writable: true });
            document.dispatchEvent(clickEvent);

            expect(toggleMuteSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error Handling', () => {
        test('showToast handles missing toast element', () => {
            document.querySelector('#error-toast').remove();
            
            // Should not throw
            expect(() => app.showToast('Test message')).not.toThrow();
        });

        test('announceToScreenReader handles missing element', () => {
            document.querySelector('#sr-announcements').remove();
            
            // Should not throw
            expect(() => app.announceToScreenReader('Test')).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        test('formatNumber handles negative numbers', () => {
            expect(app.formatNumber(-1234)).toBe('-1,234');
        });

        test('updateLeaderCrown handles missing crown elements', () => {
            document.querySelector('#crown-anti').remove();
            
            app.petitionData.set('anti-immigration', { count: 15000 });
            app.petitionData.set('pro-immigration', { count: 10000 });
            
            // Should not throw
            expect(() => app.updateLeaderCrown()).not.toThrow();
        });

        test('init handles missing DOM elements gracefully', async () => {
            // Remove some elements
            document.querySelector('#nyan-anti').remove();
            
            const updateRaceSpy = jest.spyOn(app, 'updateRace').mockResolvedValue();

            // Should not throw
            await expect(app.init()).resolves.not.toThrow();
            
            expect(updateRaceSpy).toHaveBeenCalled();
        });
    });

    describe('Integration Tests', () => {
        test('full audio lifecycle', async () => {
            // Initialize audio
            await app.initAudio();
            expect(app.isAudioInitialized).toBe(true);

            // Start melody
            app.startMelody();
            expect(app.melodyInterval).not.toBeNull();

            // Toggle mute
            app.toggleMute();
            expect(app.isMuted).toBe(true);

            // Pause audio
            app.pauseAudio();
            expect(mockAudioContext.suspend).toHaveBeenCalled();

            // Resume audio
            mockAudioContext.state = 'suspended';
            app.resumeAudio();
            expect(mockAudioContext.resume).toHaveBeenCalled();

            // Cleanup
            app.cleanup();
            expect(app.melodyInterval).toBeNull();
        });

        test('race update with volume ducking', async () => {
            app.isAudioInitialized = true;
            app.isMuted = false;
            app.bgmGainNode = mockAudioContext.createGain();
            
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ 
                        data: { attributes: { signature_count: 1000, state: 'open' } } 
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ 
                        data: { attributes: { signature_count: 2000, state: 'open' } } 
                    })
                });

            await app.updateRace();

            // Check volume ducking was applied
            const gain = app.bgmGainNode.gain;
            expect(gain.setValueAtTime).toHaveBeenCalledWith(0.025, 0);
            expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.1, 0.3);
        });
    });
});

// Check for code in global scope
describe('Global scope code', () => {
    test('handles prefers-reduced-motion', () => {
        // Test with reduced motion preference
        global.matchMedia = jest.fn(() => ({
            matches: true,
            media: '(prefers-reduced-motion: reduce)'
        }));

        jest.isolateModules(() => {
            require('../main.js');
        });

        expect(document.documentElement.style.getPropertyValue('--animation-duration')).toBe('0.01ms');
    });

    test('initializes app when DOM is ready', () => {
        Object.defineProperty(document, 'readyState', {
            writable: true,
            configurable: true,
            value: 'complete'
        });

        const initSpy = jest.fn();
        jest.isolateModules(() => {
            const module = require('../main.js');
            // Override the init method
            module.PetitionRaceApp.prototype.init = initSpy;
        });

        // Since readyState is complete, init should be called
        expect(initSpy).toHaveBeenCalled();
    });
});

// Export for coverage
module.exports = { PetitionRaceApp, CONFIG, MELODY_PATTERNS };