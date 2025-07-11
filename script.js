import * as THREE from 'three';

// --- DOM Elements ---
const fileInput = document.getElementById('file-input');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');

const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const testsContainer = document.getElementById('tests-container');

const logContainers = {
    display: document.getElementById('log-display'),
    edit: document.getElementById('log-edit'),
    '3d': document.getElementById('log-3d'),
    ai: document.getElementById('log-ai'),
};

// --- State ---
let currentImageDataUrl = null;
let threeAnimationId = null; // To stop previous animation render loops

// --- Utility Functions ---
function log(containerKey, message, type = 'info') {
    const container = logContainers[containerKey];
    if (!container) return;
    const entry = document.createElement('span');
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function clearLogs() {
    for (const key in logContainers) {
        logContainers[key].innerHTML = '';
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
    document.getElementById('scene-container').innerHTML = '';
    // Clear AI description
    document.getElementById('ai-description-output').textContent = '';
}

// --- Core Logic ---
async function handleImage(imageDataUrl) {
    currentImageDataUrl = imageDataUrl;
    
    // Show image preview and tests
    imagePreview.src = imageDataUrl;
    imagePreviewContainer.classList.remove('hidden');
    testsContainer.classList.remove('hidden');

    // Reset previous results
    clearLogs();
    clearOutputs();

    // Run all tests
    runCanvasDisplayTest();
    runCanvasEditTest();
    run3DSceneTest();
    runAIProcessingTest();
}

// --- Event Listeners ---
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        promptInput.value = ''; // Clear other input
        const reader = new FileReader();
        reader.onload = (event) => {
            handleImage(event.target.result);
        };
        reader.readAsDataURL(file);
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
    generateBtn.textContent = 'Generating...';

    try {
        const result = await websim.imageGen({ prompt });
        // We need to fetch the image and convert to DataURL to avoid CORS issues on canvas/webgl
        const response = await fetch(result.url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = (event) => {
            handleImage(event.target.result);
        };
        reader.readAsDataURL(blob);

    } catch (error) {
        console.error('Image generation failed:', error);
        alert('Failed to generate image. Please try again.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
    }
});

// --- Test Case 1: Display on Canvas ---
function runCanvasDisplayTest() {
    const key = 'display';
    log(key, 'Starting canvas display test...');
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
        log(key, 'Image object loaded successfully in memory.');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        log(key, 'Image drawn to canvas.', 'success');
    };
    img.onerror = () => log(key, 'Failed to load image object.', 'fail');
    img.src = currentImageDataUrl;
    log(key, 'Image source set. Waiting for load event...');
}

// --- Test Case 2: Edit on Canvas ---
function runCanvasEditTest() {
    const key = 'edit';
    log(key, 'Starting canvas edit test...');
    const canvas = document.getElementById('edit-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    const img = new Image();
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
    };
    img.onerror = () => log(key, 'Failed to load image for editing.', 'fail');
    img.src = currentImageDataUrl;
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
function run3DSceneTest() {
    const key = '3d';
    log(key, 'Starting 3D scene test...');
    const container = document.getElementById('scene-container');

    const scene = new THREE.Scene();
    log(key, 'Scene created.');

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 1.5;
    log(key, 'Perspective camera created.');
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    log(key, 'WebGL renderer initialized and attached to DOM.');
    
    const loader = new THREE.TextureLoader();
    loader.load(currentImageDataUrl, (texture) => {
        log(key, 'Texture loaded successfully.');
        texture.colorSpace = THREE.SRGBColorSpace;
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        log(key, 'Box geometry and material created.');

        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        log(key, 'Mesh (cube) created and added to scene.');

        function animate() {
            threeAnimationId = requestAnimationFrame(animate);
            cube.rotation.x += 0.005;
            cube.rotation.y += 0.005;
            renderer.render(scene, camera);
        }
        animate();
        log(key, 'Animation loop started.', 'success');
    }, undefined, () => {
        log(key, 'Failed to load texture.', 'fail');
    });
    log(key, 'Texture loader initiated.');
}


// --- Test Case 4: AI Processing ---
async function runAIProcessingTest() {
    const key = 'ai';
    const outputDiv = document.getElementById('ai-description-output');
    log(key, 'Starting AI image processing test...');
    
    outputDiv.textContent = 'Asking the AI to describe the image...';
    log(key, 'Sending image to vision model...', 'wait');

    try {
        const completion = await websim.chat.completions.create({
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe what you see in this image in one sentence.' },
                    { type: 'image_url', image_url: { url: currentImageDataUrl } },
                ],
            }],
        });
        
        const description = completion.content;
        outputDiv.textContent = `"${description}"`;
        log(key, 'AI response received successfully.');
        log(key, `Description: ${description}`, 'success');

    } catch (error) {
        console.error('AI processing failed:', error);
        outputDiv.textContent = 'Could not get AI description.';
        log(key, 'Failed to get a response from the AI.', 'fail');
    }
}

