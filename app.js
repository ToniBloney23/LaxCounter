const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const repCounterElement = document.getElementById('rep-counter');
const progressBarElement = document.getElementById('progress-bar');
const rpmElement = document.getElementById('rpm');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const startOverlay = document.getElementById('start-overlay');
const consistencyElement = document.getElementById('consistency');

let repCount = 0;
const repGoal = 50;
let state = 'READY'; // READY, THROWING, CATCHING
let lastWristPos = null;
let stateChangeTime = Date.now();
let sessionActive = false;
let sessionStartTime = 0;
let firstRepTime = 0;
let audioCtx = null;
let repTimes = [];
let lastRepTime = 0;

const stateColors = {
    'READY': '#00FF00',
    'THROWING': '#FFFF00',
    'CATCHING': '#00FFFF'
};

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Draw landmarks with state-based colors
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: stateColors[state], lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // Draw stick tip marker
        const elbow = results.poseLandmarks[14]; // Right elbow
        const wrist = results.poseLandmarks[16]; // Right wrist
        if (elbow && wrist) {
            const vectorX = wrist.x - elbow.x;
            const vectorY = wrist.y - elbow.y;
            const mag = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
            const unitX = vectorX / mag;
            const unitY = vectorY / mag;

            // Estimate stick length as 1.5x forearm length
            const stickLength = mag * 1.5;

            const stickTipX = wrist.x + unitX * stickLength;
            const stickTipY = wrist.y + unitY * stickLength;

            canvasCtx.beginPath();
            canvasCtx.arc(stickTipX * canvasElement.width, stickTipY * canvasElement.height, 10, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'red';
            canvasCtx.fill();
        }

        // --- Rep Counting Logic ---
        const landmarks = results.poseLandmarks;

        const shoulder = landmarks[12]; // Right shoulder
        const elbow = landmarks[14];    // Right elbow
        const wrist = landmarks[16];    // Right wrist

        // Timeout to reset state
        if (!sessionActive) return;

        // Timeout to reset state
        if (Date.now() - stateChangeTime > 2000) { // 2 second timeout
            state = 'READY';
        }

        if (shoulder && elbow && wrist) {
            const elbowAngle = calculateAngle(shoulder, elbow, wrist);

            // Velocity of the wrist (including depth)
            const wristPos = { x: wrist.x, y: wrist.y, z: wrist.z };
            let wristVelocity = { x: 0, y: 0, z: 0 };
            if (lastWristPos) {
                wristVelocity.x = wristPos.x - lastWristPos.x;
                wristVelocity.y = wristPos.y - lastWristPos.y;
                wristVelocity.z = wristPos.z - lastWristPos.z;
            }
            lastWristPos = wristPos;

            // State machine for rep counting
            const throwVelocityThreshold = 0.02;
            const minThrowAngle = 120; // Arm should be fairly extended
            const minCatchAngle = 80;  // Arm should be bent

            switch (state) {
                case 'READY':
                    // A throw starts with a clear forward motion and arm extension.
                    if (wristVelocity.x > throwVelocityThreshold && wristVelocity.z < -throwVelocityThreshold && elbowAngle > minThrowAngle) {
                        state = 'THROWING';
                        stateChangeTime = Date.now();
                    }
                    break;
                case 'THROWING':
                    // A catch is a clear motion back towards the body.
                    if (wristVelocity.x < -throwVelocityThreshold) {
                        state = 'CATCHING';
                        stateChangeTime = Date.now();
                    }
                    break;
                case 'CATCHING':
                    // To complete a rep, the arm must return to a bent, ready position.
                    const distanceToShoulder = Math.sqrt(Math.pow(wrist.x - shoulder.x, 2) + Math.pow(wrist.y - shoulder.y, 2));
                    if (distanceToShoulder < 0.3 && elbowAngle < minCatchAngle) {
                        const now = Date.now();
                        if (lastRepTime > 0) {
                            const repDuration = now - lastRepTime;
                            repTimes.push(repDuration);
                        }
                        lastRepTime = now;

                        if (repCount === 0) {
                            firstRepTime = now;
                        }
                        repCount++;
                        repCounterElement.innerText = repCount;
                        updateProgressBar();
                        updateRPM();
                        updateConsistency();
                        playSound();
                        state = 'READY';
                        stateChangeTime = now;
                    }
                    break;
            }
        }
    }
    canvasCtx.restore();
}

function calculateAngle(a, b, c) {
    // Law of cosines to find the angle at point b
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
        angle = 360 - angle;
    }

    return angle;
}

function updateProgressBar() {
    const progress = Math.min(repCount / repGoal, 1);
    progressBarElement.style.width = `${progress * 100}%`;
}

function updateRPM() {
    if (repCount < 2) return;
    const elapsedTime = (Date.now() - firstRepTime) / 60000; // in minutes
    const rpm = Math.round(repCount / elapsedTime);
    rpmElement.innerText = `RPM: ${rpm}`;
}

startBtn.onclick = () => {
    sessionActive = true;
    sessionStartTime = Date.now();
    console.log('Session started');
};

pauseBtn.onclick = () => {
    sessionActive = false;
    console.log('Session paused');
};

resetBtn.onclick = () => {
    sessionActive = false;
    repCount = 0;
    firstRepTime = 0;
    repCounterElement.innerText = '0';
    rpmElement.innerText = 'RPM: 0';
    consistencyElement.innerText = 'Consistency: 100%';
    repTimes = [];
    lastRepTime = 0;
    updateProgressBar();
    state = 'READY';
    console.log('Session reset');
};

function updateConsistency() {
    if (repTimes.length < 2) return;

    const mean = repTimes.reduce((a, b) => a + b, 0) / repTimes.length;
    const stdDev = Math.sqrt(
        repTimes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / repTimes.length
    );

    // Lower stdDev is better. Map to a 0-100% score.
    const consistency = Math.max(0, 100 - (stdDev / 5)); // Arbitrary scaling factor
    consistencyElement.innerText = `Consistency: ${Math.round(consistency)}%`;
}

function playSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

startOverlay.onclick = () => {
    startOverlay.style.display = 'none';
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
};

const pose = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();
