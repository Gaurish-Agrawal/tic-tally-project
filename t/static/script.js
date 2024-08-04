async function startDetection() {
    const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('canvas');
    const canvasCtx = canvasElement.getContext('2d');
    const blinkCountElement = document.getElementById('blinkCount');
    const stopwatchElement = document.getElementById('stopwatch');
    const test = document.getElementById('test');

    let blinkCount = 0;
    let touretteBlinkCount = 0;
    let wasBlinking = false;
    let blinkStartTime = null;
    let blinkEndTime = null;
    let blinkDurations = [];
    let blinkTimes = [];
    let startTime = null;
    let stopwatchIntervalId;
    let typeDetected;

    function calculateEAR(eye) {
        const p1 = eye[0];
        const p2 = eye[1];
        const p3 = eye[2];
        const p4 = eye[3];
        const p5 = eye[4];
        const p6 = eye[5];
        const A = Math.hypot(p2.x - p6.x, p2.y - p6.y);
        const B = Math.hypot(p3.x - p5.x, p3.y - p5.y);
        const C = Math.hypot(p1.x - p4.x, p1.y - p4.y);
        return (A + B) / (2.0 * C);
    }

    function calculateVerticalLipToNoseProximity(lipTop, noseBottom) {
        return (lipTop.y - noseBottom.y) < 0.017;
    }

    function updateStopwatch() {
        if (startTime) {
            const now = Date.now();
            const elapsed = now - startTime;
            const hours = Math.floor(elapsed / (1000 * 60 * 60));
            const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
            stopwatchElement.innerText = `Stopwatch: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    function stopDetection() {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        blinkCountElement.innerText = `Tourette Blinks: ${touretteBlinkCount}`;

        // Redirect to final count page with the blink count as a URL parameter
        const now = Date.now();
        const elapsed = now - startTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);

        window.location.href = '/final_count/' + typeDetected + "/" + elapsedSeconds.toString();
    }

    function startStopwatch() {
        if (!startTime) {
            startTime = Date.now();
            stopwatchIntervalId = setInterval(updateStopwatch, 1000);
        }
    }

    function stopStopwatch() {
        if (startTime) {
            clearInterval(stopwatchIntervalId);
            startTime = null;
        }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            if (!startTime) {
                startStopwatch();
            }

            for (const landmarks of results.multiFaceLandmarks) {
                const leftEye = [
                    landmarks[159], landmarks[145], landmarks[153],
                    landmarks[144], landmarks[160], landmarks[161]
                ];
                const rightEye = [
                    landmarks[386], landmarks[374], landmarks[380],
                    landmarks[373], landmarks[387], landmarks[388]
                ];

                const lipTop = landmarks[0];
                const noseBottom = landmarks[19];

                if (calculateVerticalLipToNoseProximity(lipTop, noseBottom)) {
                    typeDetected = "Lower Face Twitch";
                    touretteBlinkCount++;
                    stopDetection();
                    return; // exit early as detection is done
                }

                const leftEAR = calculateEAR(leftEye);
                const rightEAR = calculateEAR(rightEye);
                const ear = (leftEAR + rightEAR) / 2;
                const now = Date.now();
                if (ear > 1.5) {
                    if (!wasBlinking) {
                        blinkCount++;
                        blinkCountElement.innerText = `Blinks: ${blinkCount}`;
                        wasBlinking = true;
                        blinkStartTime = now;
                        blinkTimes.push(now);
                    }
                } else {
                    if (wasBlinking) {
                        wasBlinking = false;
                        blinkEndTime = now;
                        const blinkDuration = blinkEndTime - blinkStartTime;

                        blinkDurations.push(blinkDuration);

                        if (blinkTimes.length > 2 && ((blinkTimes[blinkTimes.length - 1] - blinkTimes[blinkTimes.length - 2]) / 100) < 11 && ((blinkTimes[0] - blinkTimes[blinkTimes.length - 1]) / 100) < 11) {
                            touretteBlinkCount++;
                            blinkCountElement.innerText = `Tourette Blinks: ${touretteBlinkCount}`;
                            blinkTimes = [];
                        } else if (blinkTimes.length > 2) {
                            blinkTimes = [];
                        }
                        if (blinkDuration > 350) { // Prolonged blink or rapid multiple blinks
                            touretteBlinkCount++;
                            blinkCountElement.innerText = `Tourette Blinks: ${touretteBlinkCount}`;
                        }

                        if (touretteBlinkCount > 0) { // If a Tourette blink is detected, stop the detection
                            typeDetected = "Eye Twitch";
                            stopDetection();
                            return; // exit early as detection is done
                        }
                    }
                }
            }
        } else {
            stopStopwatch(); // stop stopwatch if no face is detected
        }

        canvasCtx.restore();
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    camera.start();
}