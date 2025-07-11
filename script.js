import * as THREE from 'three';

// --- DOM Elements ---
const fileInput = document.getElementById('file-input');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');

const dbUploadBtn = document.getElementById('db-upload-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const testsContainer = document.getElementById('tests-container');
const downloadBtns = document.querySelectorAll('.download-btn');

const logContainers = {
    display: document.getElementById('log-display'),
    edit: document.getElementById('log-edit'),
    '3d': document.getElementById('log-3d'),
    ai: document.getElementById('log-ai'),
    db: document.getElementById('log-db'),
};

// --- State ---
let currentImage = {
    blob: null,
    url: null,
};
let threeAnimationId = null; // To stop previous animation render loops
const sceneState = {
    renderer: null,
    scene: null,
    camera: null,
    description: '',
};

// --- Utility Functions ---
function log(containerKey, message, type = 'info') {
    const container = logContainers[containerKey];
    if (!container) return;
    // Clear initial message if it exists
    if (container.querySelector('i')) {
        container.innerHTML = '';
    }
    const entry = document.createElement('span');
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function enableDbUploadButton() {
    if (currentImage.blob) {
        dbUploadBtn.disabled = false;
    }
}

function clearLogs() {
    for (const key in logContainers) {
        // This check prevents the 'Cannot set properties of null' error if an element is missing.
        if (logContainers[key]) { 
            logContainers[key].innerHTML = '';
            if (key === 'db') {
                logContainers[key].innerHTML = '<i>Logs for database upload will appear here...</i>';
            }
        }
    }
}

function clearOutputs() {
    // Clear canvases
    ['display-canvas', 'edit-canvas'].forEach(id => {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    // Clear 3D scene
    if (threeAnimationId) {
        cancelAnimationFrame(threeAnimationId);
        threeAnimationId = null;
    }
    const sceneContainer = document.getElementById('scene-container');
    if(sceneContainer) sceneContainer.innerHTML = '';
    
    // Clear AI description
    const aiOutput = document.getElementById('ai-description-output');
    if(aiOutput) aiOutput.textContent = '';

    // Disable download buttons and db upload button
    downloadBtns.forEach(btn => btn.disabled = true);
    dbUploadBtn.disabled = true;
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// --- Core Logic ---
async function runAllTests(imageUrl, imageDataUrl) {
    log('db', 'Running all tests with the uploaded image...');
    
    // Run all tests with the new URL
    runCanvasDisplayTest(imageUrl);
    runCanvasEditTest(imageUrl);
    run3DSceneTest(imageUrl);
    runAIProcessingTest(imageDataUrl); // Pass data URL to AI test
}

// --- Event Listeners ---
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        promptInput.value = ''; // Clear other input
        
        // Hide test container until user clicks upload
        testsContainer.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        imagePreview.src = URL.createObjectURL(file);

        currentImage.blob = file;
        currentImage.url = null;
        enableDbUploadButton();
    }
});

generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value;
    if (!prompt) {
        alert('Please enter a prompt for the AI.');
        return;
    }

    fileInput.value = ''; // Clear other input
    generateBtn.disabled = true;
    promptInput.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const result = await websim.imageGen({ prompt });
        const response = await fetch(result.url);
        const blob = await response.blob();
        
        currentImage.blob = blob;
        currentImage.url = null;

        imagePreviewContainer.classList.remove('hidden');
        testsContainer.classList.add('hidden'); // Hide tests until upload
        imagePreview.src = URL.createObjectURL(blob);
        
        enableDbUploadButton();

    } catch (error) {
        console.error('Image generation failed:', error);
        alert('Failed to generate image. Please try again.');
    } finally {
        generateBtn.disabled = false;
        promptInput.disabled = false;
        generateBtn.textContent = 'Generate';
    }
});

dbUploadBtn.addEventListener('click', async () => {
    if (currentImage.blob) {
        await processAndRunTests(currentImage.blob);
    } else {
        alert("No image selected or generated to upload.");
    }
});

testsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('download-btn')) {
        const example = e.target.dataset.example;
        handleDownload(example);
    }
});

// --- Download Handler ---
function handleDownload(example) {
    const link = document.createElement('a');
    
    switch(example) {
        case 'display': {
            const canvas = document.getElementById('display-canvas');
            link.href = canvas.toDataURL('image/png');
            link.download = 'canvas-display.png';
            break;
        }
        case 'edit': {
            const canvas = document.getElementById('edit-canvas');
            link.href = canvas.toDataURL('image/png');
            link.download = 'canvas-edit.png';
            break;
        }
        case '3d': {
            if (sceneState.renderer) {
                // Ensure the latest frame is rendered before capture
                sceneState.renderer.render(sceneState.scene, sceneState.camera);
                link.href = sceneState.renderer.domElement.toDataURL('image/png');
                link.download = '3d-scene.png';
            }
            break;
        }
        case 'ai': {
            if (sceneState.description) {
                const blob = new Blob([sceneState.description], { type: 'text/plain' });
                link.href = URL.createObjectURL(blob);
                link.download = 'ai-description.txt';
            }
            break;
        }
    }
    
    if (link.href) {
        link.click();
        if (link.href.startsWith('blob:')) {
            URL.revokeObjectURL(link.href); // Clean up blob URL
        }
    }
}

// --- Test Case 1: Display on Canvas ---
function runCanvasDisplayTest(imageUrl) {
    const key = 'display';
    log(key, 'Starting canvas display test...');
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Allow cross-origin image loading
    img.onload = () => {
        log(key, 'Image object loaded successfully in memory.');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        log(key, 'Image drawn to canvas.', 'success');
        document.querySelector('.download-btn[data-example="display"]').disabled = false;
    };
    img.onerror = () => log(key, 'Failed to load image object.', 'fail');
    img.src = imageUrl;
    log(key, 'Image source set. Waiting for load event...');
}

// --- Test Case 2: Edit on Canvas ---
function runCanvasEditTest(imageUrl) {
    const key = 'edit';
    log(key, 'Starting canvas edit test...');
    const canvas = document.getElementById('edit-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    const img = new Image();
    img.crossOrigin = "Anonymous"; // Allow cross-origin image loading
    img.onload = () => {
        log(key, 'Image loaded and drawn as background.');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.onmousedown = (e) => { isDrawing = true; draw(e); };
        canvas.onmouseup = () => { isDrawing = false; ctx.beginPath(); };
        canvas.onmousemove = draw;
        
        log(key, 'Drawing event listeners attached.', 'success');
        log(key, 'Test setup complete. Try drawing on the image!', 'info');
        document.querySelector('.download-btn[data-example="edit"]').disabled = false;
    };
    img.onerror = () => log(key, 'Failed to load image for editing.', 'fail');
    img.src = imageUrl;
    log(key, 'Image source set. Waiting for load...');

    function draw(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ff0000';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }
}

// --- Test Case 3: 3D Scene ---
function run3DSceneTest(imageUrl) {
    const key = '3d';
    log(key, 'Starting 3D scene test...');
    const container = document.getElementById('scene-container');

    const scene = new THREE.Scene();
    sceneState.scene = scene; // Store in state
    log(key, 'Scene created.');

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 1.5;
    sceneState.camera = camera; // Store in state
    log(key, 'Perspective camera created.');
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    sceneState.renderer = renderer; // Store in state
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    log(key, 'WebGL renderer initialized and attached to DOM.');
    
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("Anonymous"); // Allow cross-origin texture loading
    loader.load(imageUrl, (texture) => {
        log(key, 'Texture loaded successfully.');
        texture.colorSpace = THREE.SRGBColorSpace;
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        log(key, 'Box geometry and material created.');

        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        log(key, 'Mesh (cube) created and added to scene.');

        // Stop previous animation loop if it exists
        if (threeAnimationId) {
            cancelAnimationFrame(threeAnimationId);
        }

        function animate() {
            threeAnimationId = requestAnimationFrame(animate);
            cube.rotation.x += 0.005;
            cube.rotation.y += 0.005;
            renderer.render(scene, camera);
        }
        animate();
        log(key, 'Animation loop started.', 'success');
        document.querySelector('.download-btn[data-example="3d"]').disabled = false;
    }, undefined, () => {
        log(key, 'Failed to load texture.', 'fail');
    });
    log(key, 'Texture loader initiated.');
}

// --- Test Case 4: AI Processing ---
async function runAIProcessingTest(imageDataUrl) {
    const key = 'ai';
    const outputDiv = document.getElementById('ai-description-output');
    log(key, 'Starting AI image processing test...');
    
    outputDiv.textContent = 'Asking the AI to describe the image...';
    log(key, 'Sending image to vision model...', 'wait');
    sceneState.description = ''; // Reset description

    try {
        const completion = await websim.chat.completions.create({
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe what you see in this image in one sentence.' },
                    { type: 'image_url', image_url: { url: imageDataUrl } },
                ],
            }],
        });
        
        const description = completion.content;
        sceneState.description = description; // Store state
        outputDiv.textContent = `"${description}"`;
        log(key, 'AI response received successfully.');
        log(key, `Description: ${description}`, 'success');
        document.querySelector('.download-btn[data-example="ai"]').disabled = false;

    } catch (error) {
        console.error('AI processing failed:', error);
        outputDiv.textContent = 'Could not get AI description.';
        log(key, `Failed to get a response from the AI. Error: ${error.message}`, 'fail');
    }
}

async function processAndRunTests(imageBlob) {
    clearOutputs();
    clearLogs();
    
    dbUploadBtn.disabled = true;
    dbUploadBtn.textContent = 'Uploading...';
    
    // Show tests container immediately
    testsContainer.classList.remove('hidden');

    const dbLogKey = 'db';
    log(dbLogKey, 'Starting database upload...', 'wait');

    try {
        const url = await websim.upload(imageBlob);
        log(dbLogKey, `Upload successful. URL: ${url}`, 'success');
        
        currentImage.url = url;

        // Use the new URL to run tests
        log(dbLogKey, 'Converting image to data URL for AI test...', 'wait');
        const dataUrl = await blobToDataURL(imageBlob);
        log(dbLogKey, 'Data URL created successfully.', 'success');
        
        await runAllTests(url, dataUrl);

    } catch (error) {
        console.error('Database upload or testing failed:', error);
        log(dbLogKey, `Processing failed: ${error.message}`, 'fail');
        alert('Failed to upload image and run tests.');
    } finally {
        dbUploadBtn.textContent = 'Upload Current Image & Run Tests';
        enableDbUploadButton();
    }
}