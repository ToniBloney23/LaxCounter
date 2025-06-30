class BallDetector {
    constructor() {
        // Check if we're on HTTPS (required for camera access)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            this.showError('HTTPS required for camera access. Please use https:// URL or enable HTTPS in GitHub Pages settings.');
            return;
        }
        
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.hitCounter = document.getElementById('hitCounter');
        this.ballIndicator = document.getElementById('ballIndicator');
        this.statusText = document.getElementById('statusText');
        
        // Check if all elements exist
        if (!this.video || !this.canvas || !this.ctx || !this.hitCounter || !this.ballIndicator || !this.statusText) {
            this.showError('Failed to initialize: Some HTML elements are missing.');
            return;
        }
        
        this.isDetecting = false;
        this.hitCount = 0;
        this.ballPositions = [];
        this.lastBallPosition = null;
        this.velocityHistory = [];
        this.sensitivity = 1.0;
        this.ballSize = 30;
        this.model = null;
        
        // Detection parameters
        this.maxPositionHistory = 10;
        this.velocityThreshold = 50; // pixels per frame
        this.directionChangeThreshold = 120; // degrees
        this.minTimeBetweenHits = 1000; // milliseconds
        this.lastHitTime = 0;
        
        // Color detection parameters
        this.targetColor = { r: 255, g: 165, b: 0 }; // Orange ball default
        this.colorTolerance = 50;
        this.isCalibrating = false;
        
        this.initializeEventListeners();
        this.initializeCamera();
    }
    
    showError(message) {
        console.error('BallDetector Error:', message);
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = '#ff0000';
            statusElement.style.fontSize = '1.2rem';
            statusElement.style.fontWeight = 'bold';
        }
        
        // Also show in a more visible way
        const container = document.querySelector('.camera-container');
        if (container) {
            container.innerHTML = `
                <div style="
                    background: #ffebee;
                    border: 2px solid #f44336;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    color: #c62828;
                    font-weight: bold;
                    margin: 20px;
                ">
                    <h3>⚠️ Error</h3>
                    <p>${message}</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Please check the console for more details.</p>
                </div>
            `;
        }
    }
    
    initializeEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.toggleDetection());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetCounter());
        document.getElementById('calibrateBtn').addEventListener('click', () => this.calibrateBall());
        
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        const sensitivityValue = document.getElementById('sensitivityValue');
        sensitivitySlider.addEventListener('input', (e) => {
            this.sensitivity = parseFloat(e.target.value);
            sensitivityValue.textContent = this.sensitivity.toFixed(1);
        });
        
        const ballSizeSlider = document.getElementById('ballSizeSlider');
        const ballSizeValue = document.getElementById('ballSizeValue');
        ballSizeSlider.addEventListener('input', (e) => {
            this.ballSize = parseInt(e.target.value);
            ballSizeValue.textContent = this.ballSize + 'px';
            this.ballIndicator.style.width = this.ballSize + 'px';
            this.ballIndicator.style.height = this.ballSize + 'px';
        });
        
        // Canvas click for color calibration
        this.canvas.addEventListener('click', (e) => {
            if (this.isCalibrating) {
                this.handleCalibrationClick(e);
            }
        });
    }
    
    async initializeCamera() {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError('Camera API not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.');
                return;
            }
            
            this.statusText.textContent = 'Requesting camera access...';
            
            const constraints = {
                video: {
                    facingMode: 'environment', // Rear camera
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.statusText.textContent = 'Camera ready. Click Start Detection.';
                this.statusText.style.color = '#4CAF50';
            });
            
            this.video.addEventListener('error', (e) => {
                console.error('Video error:', e);
                this.showError('Video playback error. Please refresh the page.');
            });
            
            // Load TensorFlow.js model for enhanced detection
            await this.loadModel();
            
        } catch (error) {
            console.error('Camera access error:', error);
            let errorMessage = 'Camera access failed. ';
            
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera permissions and refresh the page.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'Camera not supported in this browser.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Camera is being used by another application.';
            } else {
                errorMessage += `Error: ${error.message}`;
            }
            
            this.showError(errorMessage);
        }
    }
    
    async loadModel() {
        try {
            // Check if TensorFlow.js is available
            if (typeof tf === 'undefined') {
                console.warn('TensorFlow.js not loaded. Using color-based detection only.');
                this.statusText.textContent = 'Using color-based detection (AI model unavailable).';
                return;
            }
            
            if (typeof cocoSsd === 'undefined') {
                console.warn('COCO-SSD model not loaded. Using color-based detection only.');
                this.statusText.textContent = 'Using color-based detection (COCO-SSD unavailable).';
                return;
            }
            
            this.statusText.textContent = 'Loading AI model...';
            this.model = await cocoSsd.load();
            this.statusText.textContent = 'AI model loaded. Ready for detection.';
            this.statusText.style.color = '#4CAF50';
        } catch (error) {
            console.error('Model loading error:', error);
            this.statusText.textContent = 'AI model failed to load. Using color-based detection.';
            this.statusText.style.color = '#ff9800';
        }
    }
    
    toggleDetection() {
        const startBtn = document.getElementById('startBtn');
        
        if (!this.isDetecting) {
            this.isDetecting = true;
            startBtn.textContent = 'Stop Detection';
            startBtn.classList.remove('btn-primary');
            startBtn.classList.add('btn-secondary');
            this.statusText.textContent = 'Detecting ball movement...';
            this.startDetectionLoop();
        } else {
            this.isDetecting = false;
            startBtn.textContent = 'Start Detection';
            startBtn.classList.remove('btn-secondary');
            startBtn.classList.add('btn-primary');
            this.statusText.textContent = 'Detection stopped.';
            this.ballIndicator.style.display = 'none';
        }
    }
    
    startDetectionLoop() {
        if (!this.isDetecting) return;
        
        this.detectBall();
        requestAnimationFrame(() => this.startDetectionLoop());
    }
    
    async detectBall() {
        if (!this.video.videoWidth || !this.video.videoHeight) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        let ballPosition = null;
        
        // Try AI-based detection first
        if (this.model) {
            ballPosition = await this.detectBallWithAI();
        }
        
        // Fallback to color-based detection
        if (!ballPosition) {
            ballPosition = this.detectBallByColor();
        }
        
        if (ballPosition) {
            this.updateBallTracking(ballPosition);
            this.showBallIndicator(ballPosition);
        } else {
            this.ballIndicator.style.display = 'none';
        }
    }
    
    async detectBallWithAI() {
        try {
            const predictions = await this.model.detect(this.canvas);
            
            // Look for sports ball or similar round objects
            const ballPredictions = predictions.filter(pred => 
                pred.class === 'sports ball' || 
                pred.class === 'orange' ||
                pred.class === 'apple' ||
                (pred.class === 'person' && pred.score < 0.3) // Sometimes balls are misclassified
            );
            
            if (ballPredictions.length > 0) {
                const ball = ballPredictions[0];
                const [x, y, width, height] = ball.bbox;
                return {
                    x: x + width / 2,
                    y: y + height / 2,
                    confidence: ball.score
                };
            }
        } catch (error) {
            console.error('AI detection error:', error);
        }
        
        return null;
    }
    
    detectBallByColor() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let bestMatch = null;
        let bestScore = 0;
        const step = 4; // Skip pixels for performance
        
        for (let y = 0; y < this.canvas.height; y += step) {
            for (let x = 0; x < this.canvas.width; x += step) {
                const index = (y * this.canvas.width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                const colorDistance = this.calculateColorDistance(
                    { r, g, b },
                    this.targetColor
                );
                
                if (colorDistance < this.colorTolerance) {
                    const score = this.colorTolerance - colorDistance;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = { x, y, confidence: score / this.colorTolerance };
                    }
                }
            }
        }
        
        return bestMatch;
    }
    
    calculateColorDistance(color1, color2) {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }
    
    updateBallTracking(position) {
        const currentTime = Date.now();
        
        // Add position to history
        this.ballPositions.push({
            x: position.x,
            y: position.y,
            time: currentTime,
            confidence: position.confidence || 1
        });
        
        // Keep only recent positions
        if (this.ballPositions.length > this.maxPositionHistory) {
            this.ballPositions.shift();
        }
        
        // Calculate velocity and detect hits
        if (this.ballPositions.length >= 3) {
            this.calculateVelocityAndDetectHit();
        }
        
        this.lastBallPosition = position;
    }
    
    calculateVelocityAndDetectHit() {
        const positions = this.ballPositions;
        const current = positions[positions.length - 1];
        const previous = positions[positions.length - 2];
        const beforePrevious = positions[positions.length - 3];
        
        // Calculate velocities
        const velocity1 = this.calculateVelocity(beforePrevious, previous);
        const velocity2 = this.calculateVelocity(previous, current);
        
        this.velocityHistory.push(velocity2);
        if (this.velocityHistory.length > 5) {
            this.velocityHistory.shift();
        }
        
        // Detect sudden direction change (wall hit)
        const directionChange = this.calculateDirectionChange(velocity1, velocity2);
        const speedChange = Math.abs(velocity2.magnitude - velocity1.magnitude);
        
        // Hit detection logic
        const currentTime = Date.now();
        const timeSinceLastHit = currentTime - this.lastHitTime;
        
        const isSignificantDirectionChange = directionChange > this.directionChangeThreshold;
        const isSignificantSpeedChange = speedChange > this.velocityThreshold * this.sensitivity;
        const isMinTimeElapsed = timeSinceLastHit > this.minTimeBetweenHits;
        
        if ((isSignificantDirectionChange || isSignificantSpeedChange) && isMinTimeElapsed) {
            this.registerHit();
            this.lastHitTime = currentTime;
        }
    }
    
    calculateVelocity(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dt = pos2.time - pos1.time;
        
        if (dt === 0) return { x: 0, y: 0, magnitude: 0 };
        
        const vx = dx / dt * 1000; // pixels per second
        const vy = dy / dt * 1000;
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        
        return { x: vx, y: vy, magnitude };
    }
    
    calculateDirectionChange(velocity1, velocity2) {
        if (velocity1.magnitude === 0 || velocity2.magnitude === 0) return 0;
        
        const angle1 = Math.atan2(velocity1.y, velocity1.x);
        const angle2 = Math.atan2(velocity2.y, velocity2.x);
        
        let angleDiff = Math.abs(angle2 - angle1) * 180 / Math.PI;
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        
        return angleDiff;
    }
    
    registerHit() {
        this.hitCount++;
        this.hitCounter.textContent = this.hitCount;
        
        // Visual feedback
        this.hitCounter.style.animation = 'none';
        setTimeout(() => {
            this.hitCounter.style.animation = 'pulse 0.5s ease-in-out';
        }, 10);
        
        // Audio feedback (if supported)
        this.playHitSound();
        
        console.log(`Hit detected! Total hits: ${this.hitCount}`);
    }
    
    playHitSound() {
        try {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Audio not supported');
        }
    }
    
    showBallIndicator(position) {
        this.ballIndicator.style.display = 'block';
        this.ballIndicator.style.left = position.x + 'px';
        this.ballIndicator.style.top = position.y + 'px';
    }
    
    resetCounter() {
        this.hitCount = 0;
        this.hitCounter.textContent = '0';
        this.ballPositions = [];
        this.velocityHistory = [];
        this.lastHitTime = 0;
        this.statusText.textContent = 'Counter reset.';
    }
    
    calibrateBall() {
        if (!this.isCalibrating) {
            this.isCalibrating = true;
            document.getElementById('calibrateBtn').textContent = 'Click on Ball';
            this.statusText.textContent = 'Click on the ball in the video to calibrate color detection.';
        } else {
            this.isCalibrating = false;
            document.getElementById('calibrateBtn').textContent = 'Calibrate Ball';
            this.statusText.textContent = 'Calibration cancelled.';
        }
    }
    
    handleCalibrationClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) * (this.canvas.width / rect.width));
        const y = Math.floor((event.clientY - rect.top) * (this.canvas.height / rect.height));
        
        const imageData = this.ctx.getImageData(x, y, 1, 1);
        const data = imageData.data;
        
        this.targetColor = {
            r: data[0],
            g: data[1],
            b: data[2]
        };
        
        this.isCalibrating = false;
        document.getElementById('calibrateBtn').textContent = 'Calibrate Ball';
        this.statusText.textContent = `Ball color calibrated: RGB(${data[0]}, ${data[1]}, ${data[2]})`;
        
        console.log('Calibrated color:', this.targetColor);
    }
}

// Initialize the ball detector when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing Ball Detector...');
        new BallDetector();
    } catch (error) {
        console.error('Failed to initialize Ball Detector:', error);
        
        // Show error in the status text
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = 'Failed to initialize app. Please refresh the page.';
            statusElement.style.color = '#ff0000';
        }
        
        // Show detailed error in camera container
        const container = document.querySelector('.camera-container');
        if (container) {
            container.innerHTML = `
                <div style="
                    background: #ffebee;
                    border: 2px solid #f44336;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    color: #c62828;
                    font-weight: bold;
                    margin: 20px;
                ">
                    <h3>⚠️ Initialization Error</h3>
                    <p>Failed to start the ball detector.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Error: ${error.message}</p>
                    <button onclick="location.reload()" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 10px;
                    ">Refresh Page</button>
                </div>
            `;
        }
    }
});

// Add fallback for older browsers or script loading issues
window.addEventListener('load', () => {
    // Double-check that the app initialized
    setTimeout(() => {
        const statusElement = document.getElementById('statusText');
        if (statusElement && statusElement.textContent === 'Initializing camera...') {
            console.warn('App may not have initialized properly');
            statusElement.textContent = 'App loading issue detected. Please refresh the page.';
            statusElement.style.color = '#ff9800';
        }
    }, 5000); // Check after 5 seconds
});

// Add CSS animation for hit counter
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);