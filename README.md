# Ball Wall Hit Detector

A mobile-friendly web application that uses your device's camera and AI to detect when a ball hits a wall. The app tracks ball movement in real-time and counts hits based on sudden direction changes and motion analysis.

## Features

- **Real-time Camera Access**: Uses your device's rear camera for optimal ball tracking
- **AI-Powered Detection**: Leverages TensorFlow.js and COCO-SSD model for intelligent object detection
- **Color-Based Fallback**: Custom color detection system for reliable ball tracking
- **Hit Detection Algorithm**: Analyzes velocity changes and direction shifts to identify wall impacts
- **Mobile Optimized**: Responsive design works perfectly on iOS and Android browsers
- **Customizable Settings**: Adjust sensitivity and ball size for different scenarios
- **Audio Feedback**: Plays a sound when a hit is detected
- **Ball Calibration**: Click on the ball to improve color-based detection accuracy

## How to Use

1. **Open the Website**: Load `index.html` in your mobile browser
2. **Grant Camera Permission**: Allow the app to access your device's camera
3. **Position Your Device**: Point the rear camera at the area where you'll throw the ball
4. **Calibrate (Optional)**: Click "Calibrate Ball" and then tap on the ball in the video to improve detection
5. **Start Detection**: Press "Start Detection" to begin tracking
6. **Throw the Ball**: Throw a ball at a wall and watch the counter increment with each hit
7. **Adjust Settings**: Use the sliders to fine-tune sensitivity and ball size detection

## Technical Details

### Detection Methods

1. **AI Detection**: Uses TensorFlow.js COCO-SSD model to identify sports balls and round objects
2. **Color Detection**: Analyzes pixel colors to track objects matching the calibrated ball color
3. **Motion Analysis**: Tracks ball position over time to calculate velocity and direction changes

### Hit Detection Algorithm

The app detects wall hits by analyzing:
- **Direction Changes**: Sudden changes in ball trajectory (>120° by default)
- **Speed Changes**: Significant velocity variations indicating impact
- **Time Filtering**: Prevents duplicate detections with minimum time intervals
- **Confidence Scoring**: Uses detection confidence to filter false positives

### Mobile Optimizations

- **Responsive Design**: Adapts to different screen sizes and orientations
- **Touch-Friendly Controls**: Large buttons and intuitive interface
- **Performance Optimized**: Efficient processing for smooth real-time detection
- **iOS/Android Compatible**: Works with WebRTC camera APIs on modern mobile browsers

## Browser Requirements

- **Modern Mobile Browser**: Chrome, Safari, Firefox, Edge (latest versions)
- **Camera Access**: Device must have a rear-facing camera
- **WebRTC Support**: Required for camera access
- **JavaScript Enabled**: Required for all functionality

## Tips for Best Results

1. **Good Lighting**: Ensure adequate lighting for clear ball visibility
2. **Contrasting Colors**: Use a brightly colored ball against a contrasting background
3. **Stable Position**: Hold your device steady or use a tripod
4. **Clear Background**: Minimize visual clutter behind the throwing area
5. **Ball Size**: Adjust the ball size setting to match your actual ball
6. **Sensitivity**: Fine-tune sensitivity based on throwing speed and ball type

## Troubleshooting

### Camera Not Working
- Check browser permissions for camera access
- Ensure you're using HTTPS (required for camera access)
- Try refreshing the page
- Check if another app is using the camera

### Poor Detection
- Calibrate the ball color by clicking "Calibrate Ball"
- Adjust the sensitivity slider
- Ensure good lighting conditions
- Try using a more distinctly colored ball

### False Positives
- Lower the sensitivity setting
- Ensure the background is relatively static
- Calibrate with the actual ball you're using

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **AI/ML**: TensorFlow.js, COCO-SSD model
- **Camera**: WebRTC MediaDevices API
- **Graphics**: HTML5 Canvas for real-time video processing
- **Audio**: Web Audio API for hit sound feedback

## File Structure

```
├── index.html          # Main HTML file with UI structure
├── styles.css          # Responsive CSS with mobile optimizations
├── ball-detector.js    # Core JavaScript with detection algorithms
└── README.md          # This documentation file
```

## Browser Support

- ✅ Chrome Mobile (Android/iOS)
- ✅ Safari Mobile (iOS)
- ✅ Firefox Mobile
- ✅ Edge Mobile
- ⚠️ Older browsers may have limited WebRTC support

## Privacy

- All processing happens locally on your device
- No video data is transmitted or stored
- Camera access is only used for real-time detection
- No personal data is collected

## License

This project is open source and available under the MIT License.

---

**Note**: For the best experience, use this app in a well-lit environment with a distinctly colored ball. The AI model works best with standard sports balls, but the color detection system can adapt to any ball color through calibration.