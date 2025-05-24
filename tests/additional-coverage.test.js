/**
 * @jest-environment jsdom
 */

// Additional tests to reach 85% coverage

// Mock setup
const mockFetch = jest.fn();
global.fetch = mockFetch;

let mockTimeoutId = 1;
global.setTimeout = jest.fn((callback, delay) => mockTimeoutId++);
global.clearTimeout = jest.fn();

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

global.matchMedia = jest.fn(() => ({
    matches: false,
    media: '',
    addListener: jest.fn(),
    removeListener: jest.fn(),
}));

global.AbortController = jest.fn(() => ({
    signal: { aborted: false },
    abort: jest.fn()
}));

// Set up DOM
beforeEach(() => {
    jest.clearAllMocks();
    mockTimeoutId = 1;
    
    document.body.innerHTML = `
        <html>
        <head></head>
        <body>
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
        </body>
        </html>
    `;

    // Mock documentElement.style
    document.documentElement.style.setProperty = jest.fn();
    document.documentElement.style.getPropertyValue = jest.fn(() => '');

    Object.defineProperty(document, 'readyState', {
        writable: true,
        configurable: true,
        value: 'loading'
    });
});

let PetitionRaceApp, CONFIG, MELODY_PATTERNS;

beforeEach(() => {
    jest.isolateModules(() => {
        const mainModule = require('../main.js');
        PetitionRaceApp = mainModule.PetitionRaceApp;
        CONFIG = mainModule.CONFIG;
        MELODY_PATTERNS = mainModule.MELODY_PATTERNS;
    });
});

describe('Additional Coverage Tests', () => {
    let app;

    beforeEach(() => {
        app = new PetitionRaceApp();
    });

    describe('Destructor edge cases', () => {
        test('destructor handles closed audio context', () => {
            app.audioContext = { ...mockAudioContext, state: 'closed' };
            app.audioContext.close = jest.fn();
            
            app.destructor();
            
            expect(app.audioContext.close).not.toHaveBeenCalled();
        });

        test('destructor handles null intervals', () => {
            app.pollInterval = null;
            app.melodyInterval = null;
            
            expect(() => app.destructor()).not.toThrow();
        });
    });

    describe('Network edge cases', () => {
        test('fetchWithRetry throws on final attempt', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            await expect(app.fetchWithRetry('https://test.com', 1))
                .rejects.toThrow('Failed to fetch after 1 attempts');
        });

        test('fetchSignatureCount handles network timeout', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));
            console.error = jest.fn();
            
            // Set up abort controller to be called
            const abortSpy = jest.fn();
            global.AbortController = jest.fn(() => ({
                signal: { aborted: false },
                abort: abortSpy
            }));

            const promise = app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            
            // Trigger timeout
            const timeoutCallback = global.setTimeout.mock.calls[0][0];
            timeoutCallback();
            
            const result = await promise;
            expect(result).toBe(null);
            expect(console.error).toHaveBeenCalled();
        });

        test('fetchSignatureCount handles 500 error', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });
            console.error = jest.fn();
            
            const result = await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(result).toBe(null);
        });

        test('fetchSignatureCount tracks failed requests', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            console.error = jest.fn();
            
            // First failure
            await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(app.failedRequests.get('anti-immigration')).toBe(1);
            
            // Second failure
            await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
            expect(app.failedRequests.get('anti-immigration')).toBe(2);
        });
    });

    describe('UI edge cases', () => {
        test('updateDisplay handles missing petition data', () => {
            app.petitionData.clear();
            
            expect(() => app.updateDisplay()).not.toThrow();
        });

        test('updateCatPositions calculates correct positions for various ratios', () => {
            // Test when anti is winning
            app.petitionData.set('anti-immigration', { count: 8000, prevCount: 7000 });
            app.petitionData.set('pro-immigration', { count: 2000, prevCount: 1000 });
            
            app.updateCatPositions();
            
            const antiCat = document.querySelector('#nyan-anti');
            const proCat = document.querySelector('#nyan-pro');
            
            expect(antiCat.style.left).toBe('80%');
            expect(proCat.style.left).toBe('20%');
        });

        test('updateCatPositions handles very large numbers', () => {
            app.petitionData.set('anti-immigration', { count: 1000000, prevCount: 999999 });
            app.petitionData.set('pro-immigration', { count: 500000, prevCount: 499999 });
            
            app.updateCatPositions();
            
            const antiCat = document.querySelector('#nyan-anti');
            expect(antiCat.style.left).toBe('80%');
        });

        test('rainbow trail timing edge case', () => {
            jest.useFakeTimers();
            
            app.petitionData.set('anti-immigration', { count: 5000, prevCount: 4000 });
            app.petitionData.set('pro-immigration', { count: 5000, prevCount: 5000 });
            
            app.updateCatPositions();
            
            const antiCat = document.querySelector('#nyan-anti');
            expect(antiCat.classList.contains('moving')).toBe(true);
            
            // Fast-forward to remove moving class
            jest.advanceTimersByTime(3000);
            
            expect(antiCat.classList.contains('moving')).toBe(false);
            
            jest.useRealTimers();
        });

        test('updateLeaderCrown handles very close counts', () => {
            app.petitionData.set('anti-immigration', { count: 10001 });
            app.petitionData.set('pro-immigration', { count: 10000 });
            
            app.updateLeaderCrown();
            
            const antiCrown = document.querySelector('#crown-anti');
            const proCrown = document.querySelector('#crown-pro');
            
            expect(antiCrown.classList.contains('active')).toBe(true);
            expect(proCrown.classList.contains('active')).toBe(false);
        });
    });

    describe('Audio edge cases', () => {
        test('scheduleNotes handles all measure patterns', () => {
            app.audioContext = mockAudioContext;
            app.isAudioInitialized = true;
            const playPianoNoteSpy = jest.spyOn(app, 'playPianoNote').mockImplementation();
            
            // Test measure 4-5 (quiet main)
            app.measureCount = 4;
            app.scheduleNotes(0);
            
            // Test measure 6-7 (energetic variation)
            app.measureCount = 6;
            app.scheduleNotes(0);
            
            // Test measure 8-9 (main again)
            app.measureCount = 8;
            app.scheduleNotes(0);
            
            // Test measure 10-11 (quiet variation)
            app.measureCount = 10;
            app.scheduleNotes(0);
            
            // Test measure 14-15 (big finish)
            app.measureCount = 14;
            app.scheduleNotes(0);
            
            expect(playPianoNoteSpy).toHaveBeenCalled();
        });

        test('playNote does not add vibrato for square waves', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();
            
            mockAudioContext.createOscillator.mockClear();
            app.playNote(1.0, 440, 0.5, 'square');
            
            // Only one oscillator for square wave (no vibrato)
            expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
        });

        test('playPianoNote skips when frequency is 0', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();
            app.isAudioInitialized = true;
            
            mockAudioContext.createOscillator.mockClear();
            app.playPianoNote(1.0, 0, 0.5);
            
            expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
        });

        test('playMeow creates proper meow sound', () => {
            app.audioContext = mockAudioContext;
            app.bgmGainNode = mockAudioContext.createGain();
            
            mockAudioContext.createOscillator.mockClear();
            app.playMeow(1.0);
            
            const osc = mockAudioContext.createOscillator();
            expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(800, 1.0);
            expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(1200, 1.1);
            expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(600, 1.2);
            expect(osc.start).toHaveBeenCalledWith(1.0);
            expect(osc.stop).toHaveBeenCalledWith(1.2);
        });

        test('volume ducking when muted does nothing', async () => {
            app.isAudioInitialized = true;
            app.isMuted = true;
            app.bgmGainNode = mockAudioContext.createGain();
            
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ 
                    data: { attributes: { signature_count: 1000, state: 'open' } } 
                })
            });
            
            await app.updateRace();
            
            expect(app.bgmGainNode.gain.setValueAtTime).not.toHaveBeenCalled();
        });
    });

    describe('Event handler edge cases', () => {
        test('click on nested element inside link is ignored', async () => {
            app.setupEventListeners();
            app.isAudioInitialized = true;
            
            const toggleMuteSpy = jest.spyOn(app, 'toggleMute');
            
            const link = document.createElement('a');
            const span = document.createElement('span');
            link.appendChild(span);
            
            // Mock closest method
            span.closest = jest.fn((selector) => selector === 'a' ? link : null);
            span.tagName = 'SPAN';
            
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: span, writable: true });
            
            document.dispatchEvent(clickEvent);
            
            expect(toggleMuteSpy).not.toHaveBeenCalled();
        });

        test('toggleAudio error path', async () => {
            app.isAudioInitialized = false;
            app.initAudio = jest.fn().mockRejectedValue(new Error('Audio init failed'));
            
            await app.toggleAudio();
            
            expect(app.isAudioInitialized).toBe(false);
            expect(app.isMuted).toBe(false);
        });
    });

    describe('Screen reader announcements', () => {
        test('announceToScreenReader with leader info', () => {
            const srElement = document.querySelector('#sr-announcements');
            app.petitionData.set('anti-immigration', { count: 5000 });
            app.petitionData.set('pro-immigration', { count: 10000 });
            
            const antiData = app.petitionData.get('anti-immigration');
            const proData = app.petitionData.get('pro-immigration');
            const leader = proData.count > antiData.count ? 'Pro-immigration' : 'Anti-immigration';
            const leaderCount = Math.max(proData.count, antiData.count);
            
            app.announceToScreenReader(`${leader} petition is leading with ${app.formatNumber(leaderCount)} signatures`);
            
            expect(srElement.textContent).toContain('Pro-immigration petition is leading with 10,000 signatures');
        });
    });

    describe('DOM readyState conditions', () => {
        test('app initializes when DOMContentLoaded fires and readyState is loading', () => {
            Object.defineProperty(document, 'readyState', {
                writable: true,
                configurable: true,
                value: 'loading'
            });

            let domContentLoadedHandler;
            const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
                .mockImplementation((event, handler) => {
                    if (event === 'DOMContentLoaded') {
                        domContentLoadedHandler = handler;
                    }
                });

            jest.isolateModules(() => {
                require('../main.js');
            });

            expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
            
            // Simulate DOMContentLoaded
            if (domContentLoadedHandler) {
                domContentLoadedHandler();
            }
        });
    });
});

// Test helper functions coverage
describe('Helper function coverage', () => {
    test('formatNumber edge cases', () => {
        const app = new PetitionRaceApp();
        
        expect(app.formatNumber(0)).toBe('0');
        expect(app.formatNumber(999)).toBe('999');
        expect(app.formatNumber(1000)).toBe('1,000');
        expect(app.formatNumber(-1000)).toBe('-1,000');
        expect(app.formatNumber(1000000)).toBe('1,000,000');
    });

    test('getElement with various selectors', () => {
        const app = new PetitionRaceApp();
        
        expect(app.getElement('.non-existent')).toBeNull();
        expect(app.getElement('#update-status')).toBeTruthy();
        expect(app.getElement('div')).toBeTruthy();
    });
});

describe('More edge case coverage', () => {
    let app;

    beforeEach(() => {
        app = new PetitionRaceApp();
    });

    test('updateRace with no successful fetches', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));
        const showToastSpy = jest.spyOn(app, 'showToast');
        
        await app.updateRace();
        
        expect(showToastSpy).toHaveBeenCalledWith('Unable to fetch petition data. Retrying...');
    });

    test('fetchSignatureCount with missing data attributes', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ 
                data: { 
                    // Missing attributes
                } 
            })
        });
        
        const result = await app.fetchSignatureCount({ id: '700824', name: 'anti-immigration' });
        expect(result).toBe(0);
    });

    test('updateCatPositions removes moving class after timeout', () => {
        jest.useFakeTimers();
        
        app.petitionData.set('anti-immigration', { count: 6000, prevCount: 5000 });
        app.petitionData.set('pro-immigration', { count: 4000, prevCount: 3000 });
        
        app.updateCatPositions();
        
        const antiCat = document.querySelector('#nyan-anti');
        const proCat = document.querySelector('#nyan-pro');
        
        expect(antiCat.classList.contains('moving')).toBe(true);
        expect(proCat.classList.contains('moving')).toBe(true);
        
        jest.advanceTimersByTime(3000);
        
        expect(antiCat.classList.contains('moving')).toBe(false);
        expect(proCat.classList.contains('moving')).toBe(false);
        
        jest.useRealTimers();
    });

    test('cleanup handles null audioContext', () => {
        app.audioContext = null;
        
        expect(() => app.cleanup()).not.toThrow();
    });

    test('toggleAudio with successful initialization', async () => {
        app.isAudioInitialized = false;
        app.isMuted = true;
        
        await app.toggleAudio();
        
        expect(app.isAudioInitialized).toBe(true);
        expect(app.isMuted).toBe(false);
    });

    test('keyboard event preventDefault behavior', () => {
        app.setupEventListeners();
        app.isAudioInitialized = true;
        
        const keyEvent = new KeyboardEvent('keydown', { key: ' ' });
        keyEvent.preventDefault = jest.fn();
        
        document.dispatchEvent(keyEvent);
        
        expect(keyEvent.preventDefault).toHaveBeenCalled();
    });

    test('scheduleNotes adds harmony and bass', () => {
        app.audioContext = mockAudioContext;
        app.isAudioInitialized = true;
        const playNoteSpy = jest.spyOn(app, 'playNote').mockImplementation();
        
        app.measureCount = 0;
        app.scheduleNotes(0);
        
        // Check that harmony and bass patterns are played
        const harmonyCalls = playNoteSpy.mock.calls.filter(call => 
            MELODY_PATTERNS.harmony.some(note => note.freq === call[1])
        );
        const bassCalls = playNoteSpy.mock.calls.filter(call => 
            MELODY_PATTERNS.bass.some(note => note.freq === call[1])
        );
        
        expect(harmonyCalls.length).toBeGreaterThan(0);
        expect(bassCalls.length).toBeGreaterThan(0);
    });

    test('updateDisplay with animation and new data', () => {
        app.isAudioInitialized = true;
        app.isMuted = false;
        app.bgmGainNode = mockAudioContext.createGain();
        
        // Set up data that triggers all branches
        app.petitionData.set('anti-immigration', { count: 7000, prevCount: 5000 });
        app.petitionData.set('pro-immigration', { count: 3000, prevCount: 2000 });
        
        app.updateDisplay();
        
        // Check volume ducking
        expect(app.bgmGainNode.gain.setValueAtTime).toHaveBeenCalled();
    });

    test('onended cleanup for all oscillators in playPianoNote', () => {
        app.audioContext = mockAudioContext;
        app.bgmGainNode = mockAudioContext.createGain();
        app.isAudioInitialized = true;
        
        // Clear previous mocks
        mockAudioContext.createOscillator.mockClear();
        mockAudioContext.createGain.mockClear();
        
        app.playPianoNote(1.0, 440, 0.5);
        
        // Get all created oscillators
        const oscillators = mockAudioContext.createOscillator.mock.results.map(r => r.value);
        
        // Trigger onended for the first oscillator
        const onended = oscillators[0].onended;
        onended();
        
        // Check all oscillators were disconnected
        oscillators.forEach(osc => {
            expect(osc.disconnect).toHaveBeenCalled();
        });
    });

    test('destructor with all resources present', () => {
        // Set up all resources
        app.pollInterval = setInterval(() => {}, 1000);
        app.melodyInterval = setInterval(() => {}, 100);
        app.audioContext = mockAudioContext;
        app.domCache.set('test1', document.createElement('div'));
        app.domCache.set('test2', document.createElement('span'));
        app.petitionData.set('test1', { count: 100 });
        app.petitionData.set('test2', { count: 200 });
        app.failedRequests.set('test1', 1);
        app.failedRequests.set('test2', 2);

        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        app.destructor();

        expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
        expect(mockAudioContext.close).toHaveBeenCalled();
        expect(app.domCache.size).toBe(0);
        expect(app.petitionData.size).toBe(0);
        expect(app.failedRequests.size).toBe(0);
        expect(app.pollInterval).toBeNull();
        expect(app.melodyInterval).toBeNull();
    });

    test('click handler with audio initialization success', async () => {
        app.setupEventListeners();
        app.isAudioInitialized = false;
        
        const initAudioSpy = jest.spyOn(app, 'initAudio').mockResolvedValue();
        const toggleMuteSpy = jest.spyOn(app, 'toggleMute').mockImplementation(() => {
            app.isMuted = !app.isMuted;
        });

        const div = document.createElement('div');
        div.closest = jest.fn(() => null);
        const clickEvent = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(clickEvent, 'target', { value: div, writable: true });
        
        const clickHandler = document.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
        await clickHandler(clickEvent);

        expect(initAudioSpy).toHaveBeenCalled();
        expect(toggleMuteSpy).toHaveBeenCalledTimes(2);
        expect(app.isMuted).toBe(false);
    });

    test('keyboard shortcuts without audio initialization', () => {
        app.setupEventListeners();
        app.isAudioInitialized = false;
        const toggleMuteSpy = jest.spyOn(app, 'toggleMute');

        const keyEvent = new KeyboardEvent('keydown', { key: 'm' });
        keyEvent.preventDefault = jest.fn();
        document.dispatchEvent(keyEvent);

        expect(keyEvent.preventDefault).toHaveBeenCalled();
        expect(toggleMuteSpy).not.toHaveBeenCalled();
    });

    test('beforeunload event calls cleanup', () => {
        app.setupEventListeners();
        const cleanupSpy = jest.spyOn(app, 'cleanup').mockImplementation();

        const beforeUnloadHandler = window.addEventListener.mock.calls.find(call => call[0] === 'beforeunload')[1];
        beforeUnloadHandler();

        expect(cleanupSpy).toHaveBeenCalled();
    });

    test('updateCounters with changed counts for both petitions', () => {
        app.petitionData.set('anti-immigration', { count: 5432, prevCount: 5000 });
        app.petitionData.set('pro-immigration', { count: 8765, prevCount: 8000 });

        const animateSpy = jest.spyOn(app, 'animateCounterChange');
        app.updateCounters();

        const antiCount = document.querySelector('#count-anti .count-number');
        const proCount = document.querySelector('#count-pro .count-number');
        
        expect(antiCount.textContent).toBe('5,432');
        expect(proCount.textContent).toBe('8,765');
        expect(animateSpy).toHaveBeenCalledTimes(2);
        expect(animateSpy).toHaveBeenCalledWith(antiCount, 432);
        expect(animateSpy).toHaveBeenCalledWith(proCount, 765);
    });

    test('scheduleNotes covers all volume variations', () => {
        app.audioContext = mockAudioContext;
        app.isAudioInitialized = true;
        const playPianoNoteSpy = jest.spyOn(app, 'playPianoNote').mockImplementation();

        // Test louder volume (measure 6-7)
        app.measureCount = 6;
        app.scheduleNotes(0);
        const loudVolume = playPianoNoteSpy.mock.calls[0][3];
        
        // Test quieter volume (measure 12-13)
        playPianoNoteSpy.mockClear();
        app.measureCount = 12;
        app.scheduleNotes(0);
        const quietVolume = playPianoNoteSpy.mock.calls[0][3];

        expect(loudVolume).toBeGreaterThan(quietVolume);
    });
});