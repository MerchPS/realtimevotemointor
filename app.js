// Configuration
const CONFIG = {
    UPDATE_INTERVAL: 10000, // 10 seconds
    SUBMISSIONS: [
        { id: "24087", name: "xxknjt" },
        { id: "24084", name: "boo" },
        { id: "24081", name: "JustDani" },
        { id: "24078", name: "SonMV" },
        { id: "24075", name: "KekeLawar" },
        { id: "24066", name: "searchforemma" },
        { id: "24072", name: "YaraYay" },
        { id: "24069", name: "Wasawho" }
    ],
    BASE_URL: "https://motionimefest.id/contest/newcomer-streamer-of-the-year/submission"
};

// State
let state = {
    isTracking: false,
    updateInterval: null,
    lastVotes: {},
    sessionDelta: {},
    history: {
        labels: [],
        data: {}
    },
    lastUpdateTime: null,
    nextUpdateTime: null
};

// Initialize state
CONFIG.SUBMISSIONS.forEach(sub => {
    state.lastVotes[sub.id] = null;
    state.sessionDelta[sub.id] = 0;
    state.history.data[sub.id] = [];
});

// DOM Elements
const elements = {
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    statusText: document.getElementById('statusText'),
    leaderText: document.getElementById('leaderText'),
    lastUpdate: document.getElementById('lastUpdate'),
    nextUpdate: document.getElementById('nextUpdate'),
    submissionsGrid: document.getElementById('submissionsGrid'),
    logContainer: document.getElementById('logContainer')
};

// Utility Functions
function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message"> ${message}</span>
    `;
    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

function updateStatus(message, type = 'info') {
    elements.statusText.textContent = message;
    const colors = {
        info: '#60a5fa',
        success: '#4ade80',
        error: '#f87171',
        warning: '#fbbf24'
    };
    elements.statusText.style.color = colors[type] || colors.info;
}

function formatNumber(num) {
    return num?.toLocaleString() || '0';
}

// Data Fetching
async function fetchSubmissionData(sub) {
    const url = `${CONFIG.BASE_URL}/${sub.id}/?cid=23816&cm=1&_=${Date.now()}`;
    
    try {
        const response = await fetch(url, { 
            cache: "no-store",
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        const voteMatch = html.match(/([\d,.]+)\s*Votes/i);
        const viewMatch = html.match(/([\d,.]+)\s*Views/i);
        
        const votes = voteMatch ? parseInt(voteMatch[1].replace(/[,.]/g, "")) : null;
        const views = viewMatch ? parseInt(viewMatch[1].replace(/[,.]/g, "")) : null;
        
        return {
            ...sub,
            votes,
            views,
            success: true,
            timestamp: Date.now()
        };
    } catch (error) {
        log(`❌ ${sub.name}: ${error.message}`);
        return {
            ...sub,
            error: error.message,
            success: false
        };
    }
}

async function fetchAllData() {
    if (!state.isTracking) return;
    
    updateStatus('Fetching data...', 'info');
    
    try {
        const startTime = Date.now();
        const results = await Promise.allSettled(
            CONFIG.SUBMISSIONS.map(fetchSubmissionData)
        );
        
        const successfulResults = results
            .filter(result => result.status === 'fulfilled' && result.value.success)
            .map(result => result.value);
        
        if (successfulResults.length === 0) {
            throw new Error('All requests failed');
        }
        
        processData(successfulResults);
        
        const fetchTime = Date.now() - startTime;
        log(`✅ Updated ${successfulResults.length}/${CONFIG.SUBMISSIONS.length} submissions (${fetchTime}ms)`);
        updateStatus('Live - Auto Updating', 'success');
        
    } catch (error) {
        log(`❌ Fetch failed: ${error.message}`);
        updateStatus('Fetch Failed', 'error');
    }
}

function processData(results) {
    const now = Date.now();
    let leader = null;
    let maxVotes = -1;
    
    // Update UI for each submission
    results.forEach(result => {
        if (result.success && result.votes !== null) {
            updateSubmissionCard(result, now);
            
            // Track leader
            if (result.votes > maxVotes) {
                maxVotes = result.votes;
                leader = result;
            }
        }
    });
    
    // Update leader
    if (leader) {
        elements.leaderText.textContent = `${leader.name} (${formatNumber(leader.votes)} votes)`;
        
        // Highlight leader card
        CONFIG.SUBMISSIONS.forEach(sub => {
            const card = document.getElementById(`card-${sub.id}`);
            if (card) {
                card.classList.toggle('leader', sub.id === leader.id);
            }
        });
    }
    
    // Update timestamps
    state.lastUpdateTime = now;
    state.nextUpdateTime = now + CONFIG.UPDATE_INTERVAL;
    elements.lastUpdate.textContent = new Date(now).toLocaleTimeString();
    updateNextUpdateTime();
}

function updateSubmissionCard(sub, currentTime) {
    const card = document.getElementById(`card-${sub.id}`);
    if (!card) return;
    
    // Remove loading state
    card.classList.remove('loading');
    
    // Update votes and views
    const votesEl = card.querySelector('.votes .stat-value');
    const viewsEl = card.querySelector('.views .stat-value');
    const deltaEl = card.querySelector('.delta');
    const rateEl = card.querySelector('.rate');
    
    if (votesEl) votesEl.textContent = formatNumber(sub.votes);
    if (viewsEl) viewsEl.textContent = formatNumber(sub.views);
    
    // Calculate and display delta
    let delta = 0;
    if (state.lastVotes[sub.id] !== null) {
        delta = sub.votes - state.lastVotes[sub.id];
    }
    
    if (deltaEl) {
        if (delta > 0) {
            deltaEl.textContent = `+${delta}`;
            deltaEl.className = 'delta positive';
        } else if (delta < 0) {
            deltaEl.textContent = `${delta}`;
            deltaEl.className = 'delta negative';
        } else {
            deltaEl.textContent = '0';
            deltaEl.className = 'delta';
        }
    }
    
    // Calculate and display rate
    if (rateEl && delta > 0 && state.lastUpdateTime) {
        const elapsedSeconds = (currentTime - state.lastUpdateTime) / 1000;
        const rate = elapsedSeconds > 0 ? (delta / elapsedSeconds).toFixed(2) : '0.00';
        rateEl.textContent = `${rate} votes/sec`;
    }
    
    // Update session delta
    if (delta > 0) {
        state.sessionDelta[sub.id] += delta;
    }
    
    // Store current votes for next comparison
    state.lastVotes[sub.id] = sub.votes;
    
    // Add to history for chart
    state.history.labels.push(new Date(currentTime).toLocaleTimeString());
    CONFIG.SUBMISSIONS.forEach(s => {
        if (!state.history.data[s.id]) state.history.data[s.id] = [];
        state.history.data[s.id].push(s.id === sub.id ? sub.votes : (state.lastVotes[s.id] || 0));
    });
    
    // Keep history manageable
    if (state.history.labels.length > 20) {
        state.history.labels.shift();
        CONFIG.SUBMISSIONS.forEach(s => {
            state.history.data[s.id].shift();
        });
    }
    
    // Update chart
    updateChart();
}

// Chart Management
let chart = null;

function initializeChart() {
    const ctx = document.getElementById('votesChart').getContext('2d');
    const colors = [
        '#60a5fa', '#f87171', '#4ade80', '#fbbf24', 
        '#c084fc', '#fb923c', '#2dd4bf', '#f472b6'
    ];
    
    const datasets = CONFIG.SUBMISSIONS.map((sub, index) => ({
        label: sub.name,
        data: state.history.data[sub.id],
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + '20',
        tension: 0.4,
        pointRadius: 2,
        borderWidth: 2,
        fill: false
    }));
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: state.history.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Votes'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#f8fafc',
                        boxWidth: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#f1f5f9',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            }
        }
    });
}

function updateChart() {
    if (!chart) return;
    
    chart.data.labels = state.history.labels;
    CONFIG.SUBMISSIONS.forEach((sub, index) => {
        chart.data.datasets[index].data = state.history.data[sub.id];
    });
    
    chart.update('none');
}

// UI Management
function createSubmissionCards() {
    elements.submissionsGrid.innerHTML = CONFIG.SUBMISSIONS.map(sub => `
        <div class="submission-card loading" id="card-${sub.id}">
            <div class="card-header">
                <div class="submission-name">${sub.name}</div>
                <div class="submission-id">${sub.id}</div>
            </div>
            <div class="stats-grid">
                <div class="stat votes">
                    <div class="stat-label">Votes</div>
                    <div class="stat-value">—</div>
                </div>
                <div class="stat views">
                    <div class="stat-label">Views</div>
                    <div class="stat-value">—</div>
                </div>
            </div>
            <div class="delta-section">
                <div class="delta">—</div>
                <div class="rate">— votes/sec</div>
            </div>
        </div>
    `).join('');
}

function updateNextUpdateTime() {
    if (!state.nextUpdateTime) return;
    
    const updateNextTime = () => {
        const now = Date.now();
        const timeLeft = Math.max(0, state.nextUpdateTime - now);
        const secondsLeft = Math.ceil(timeLeft / 1000);
        
        elements.nextUpdate.textContent = `${secondsLeft}s`;
        
        if (timeLeft > 0) {
            requestAnimationFrame(updateNextTime);
        }
    };
    
    updateNextTime();
}

// Control Functions
function startTracking() {
    if (state.isTracking) return;
    
    state.isTracking = true;
    elements.startBtn.disabled = true;
    elements.stopBtn.disabled = false;
    
    log('🚀 Starting auto-update...');
    updateStatus('Starting...', 'info');
    
    // Initial fetch
    fetchAllData();
    
    // Set up interval
    state.updateInterval = setInterval(fetchAllData, CONFIG.UPDATE_INTERVAL);
}

function stopTracking() {
    state.isTracking = false;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
    
    if (state.updateInterval) {
        clearInterval(state.updateInterval);
        state.updateInterval = null;
    }
    
    log('⏹ Auto-update stopped');
    updateStatus('Stopped', 'warning');
    elements.nextUpdate.textContent = '-';
}

function manualRefresh() {
    log('🔄 Manual refresh requested');
    fetchAllData();
}

// Event Listeners
function initializeEventListeners() {
    elements.startBtn.addEventListener('click', startTracking);
    elements.stopBtn.addEventListener('click', stopTracking);
    elements.refreshBtn.addEventListener('click', manualRefresh);
}

// Initialize Application
function initializeApp() {
    log('🎯 Live Vote Tracker Initialized');
    log('Ready to fetch data from motionimefest.id');
    
    createSubmissionCards();
    initializeChart();
    initializeEventListeners();
    
    // Auto-start after 2 seconds
    setTimeout(startTracking, 2000);
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
