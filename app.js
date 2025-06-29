const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const repCounterElement = document.getElementById('rep-counter');

let repCount = 0;
let state = 'READY'; // READY, THROWING, CATCHING
let lastHandPos = null;

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Draw landmarks
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // --- Rep Counting Logic ---
        const landmarks = results.poseLandmarks;

        const shoulder = landmarks[12]; // Right shoulder
        const elbow = landmarks[14];    // Right elbow
        const wrist = landmarks[16];    // Right wrist

        if (shoulder && elbow && wrist) {
            const elbowAngle = calculateAngle(shoulder, elbow, wrist);

            // Velocity of the wrist
            const wristPos = { x: wrist.x, y: wrist.y };
            let wristVelocity = { x: 0, y: 0 };
            if (lastHandPos) {
                wristVelocity.x = wristPos.x - lastHandPos.x;
                wristVelocity.y = wristPos.y - lastHandPos.y;
            }
            lastHandPos = wristPos;

            // State machine for rep counting
            const throwThreshold = 0.03; // Velocity threshold to detect a throw

            switch (state) {
                case 'READY':
                    if (wristVelocity.x > throwThreshold && elbowAngle > 100) { // Moving away from body (assuming user faces left)
                        state = 'THROWING';
                    }
                    break;
                case 'THROWING':
                    if (wristVelocity.x < -throwThreshold) { // Moving back towards body
                        state = 'CATCHING';
                    }
                    break;
                case 'CATCHING':
                    // Check if wrist is back to a ready position (e.g., close to shoulder)
                    const distanceToShoulder = Math.sqrt(Math.pow(wrist.x - shoulder.x, 2) + Math.pow(wrist.y - shoulder.y, 2));
                    if (distanceToShoulder < 0.2) { 
                        repCount++;
                        repCounterElement.innerText = repCount;
                        state = 'READY';
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
