const PETITIONS = {
    anti: {
        id: '700824',
        selector: '#nyan-anti',
        countSelector: '#count-anti .count-number',
        crownSelector: '#crown-anti',
        lastCount: 0
    },
    pro: {
        id: '727360',
        selector: '#nyan-pro',
        countSelector: '#count-pro .count-number',
        crownSelector: '#crown-pro',
        lastCount: 0
    }
};

const POLL_INTERVAL = 15000; // 15 seconds
const API_BASE = 'https://petition.parliament.uk/petitions';
const ANIMATION_DURATION = 1000; // 1 second

let audioContext;
let bgmGainNode;
let bgmSource;
let isMuted = false;
let isAudioInitialized = false;

async function fetchSignatureCount(petitionId) {
    try {
        const response = await fetch(`${API_BASE}/${petitionId}/count.json`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.signature_count || 0;
    } catch (error) {
        console.error(`Failed to fetch petition ${petitionId}:`, error);
        showToast(`Failed to fetch data: ${error.message}`);
        return null;
    }
}

function updateCatPosition(petition, count, maxCount) {
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    const clampedPercentage = Math.max(0, Math.min(95, percentage)); // Leave some margin
    
    const nyanWrapper = document.querySelector(petition.selector);
    const oldPosition = parseFloat(nyanWrapper.style.transform?.match(/translateX\(([\d.]+)%\)/)?.[1] || 0);
    
    if (count > petition.lastCount && petition.lastCount > 0) {
        nyanWrapper.classList.add('moving');
        
        if (isAudioInitialized && !isMuted && bgmGainNode) {
            bgmGainNode.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.1);
            bgmGainNode.gain.exponentialRampToValueAtTime(1, audioContext.currentTime + 1.1);
        }
        
        setTimeout(() => {
            nyanWrapper.classList.remove('moving');
        }, ANIMATION_DURATION);
    }
    
    nyanWrapper.style.transform = `translateX(${clampedPercentage}%)`;
    
    const countElement = document.querySelector(petition.countSelector);
    if (countElement) {
        countElement.textContent = count.toLocaleString();
    }
    
    petition.lastCount = count;
}

function updateLeaderCrown(antiCount, proCount) {
    const antiCrown = document.querySelector(PETITIONS.anti.crownSelector);
    const proCrown = document.querySelector(PETITIONS.pro.crownSelector);
    
    if (antiCount > proCount) {
        antiCrown.classList.add('active');
        proCrown.classList.remove('active');
    } else if (proCount > antiCount) {
        proCrown.classList.add('active');
        antiCrown.classList.remove('active');
    } else {
        antiCrown.classList.remove('active');
        proCrown.classList.remove('active');
    }
}

async function updateRace() {
    const updateStatus = document.getElementById('update-status');
    updateStatus.textContent = 'Updating...';
    
    const [antiCount, proCount] = await Promise.all([
        fetchSignatureCount(PETITIONS.anti.id),
        fetchSignatureCount(PETITIONS.pro.id)
    ]);
    
    if (antiCount !== null && proCount !== null) {
        const maxCount = Math.max(antiCount, proCount);
        
        updateCatPosition(PETITIONS.anti, antiCount, maxCount);
        updateCatPosition(PETITIONS.pro, proCount, maxCount);
        updateLeaderCrown(antiCount, proCount);
        
        updateStatus.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } else {
        updateStatus.textContent = 'Update failed';
    }
}

function showToast(message) {
    const toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

async function initAudio() {
    if (isAudioInitialized) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        bgmGainNode = audioContext.createGain();
        bgmGainNode.connect(audioContext.destination);
        
        const audio = document.getElementById('bgm');
        if (audio) {
            const track = audioContext.createMediaElementSource(audio);
            track.connect(bgmGainNode);
            
            if (!isMuted) {
                audio.play().catch(e => console.log('Audio play failed:', e));
            }
        }
        
        isAudioInitialized = true;
    } catch (error) {
        console.error('Audio initialization failed:', error);
    }
}

function toggleMute() {
    isMuted = !isMuted;
    const muteButton = document.getElementById('mute-toggle');
    const audio = document.getElementById('bgm');
    
    if (isMuted) {
        muteButton.classList.add('muted');
        if (audio) audio.pause();
    } else {
        muteButton.classList.remove('muted');
        if (audio && isAudioInitialized) {
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (!isMuted) {
            document.getElementById('bgm')?.pause();
        }
    } else {
        updateRace();
        if (!isMuted && isAudioInitialized) {
            document.getElementById('bgm')?.play().catch(e => console.log('Audio play failed:', e));
        }
    }
}

function initializeApp() {
    // Add Nyan Cat SVG as background
    const nyanCats = document.querySelectorAll('.nyan-cat');
    nyanCats.forEach(cat => {
        cat.style.backgroundImage = 'url(assets/nyan-cat.svg)';
    });
    
    // Set up event listeners
    document.getElementById('mute-toggle').addEventListener('click', () => {
        if (!isAudioInitialized) {
            initAudio();
        }
        toggleMute();
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start initial update
    updateRace();
    
    // Set up polling interval
    setInterval(updateRace, POLL_INTERVAL);
    
    // Initialize audio on first user interaction
    document.addEventListener('click', () => {
        if (!isAudioInitialized && !isMuted) {
            initAudio();
        }
    }, { once: true });
}

// Check for reduced motion preference
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}