
function detectFormat(input, selectedFormat) {
    if (selectedFormat !== 'auto') {
        return selectedFormat;
    }

    const trimmed = input.trim();

    if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
        try {
            atob(trimmed);
            return 'base64';
        } catch (e) {}
    }

    if (/^[0-9a-fA-F\s]+$/.test(trimmed.replace(/\s/g, ''))) {
        return 'hex';
    }

    if (/^[0-9\s]+$/.test(trimmed.replace(/\s/g, ''))) {
        return 'decimal';
    }

    if (/^[0-7\s]+$/.test(trimmed.replace(/\s/g, ''))) {
        return 'octal';
    }

    if (/^[01\s]+$/.test(trimmed.replace(/\s/g, ''))) {
        return 'binary';
    }

    return 'ascii';
}

function decodeInput(input, format) {
    const trimmed = input.trim();

    switch (format) {
        case 'base64':
            try {
                const binary = atob(trimmed);
                return Array.from(binary).map(c => c.charCodeAt(0));
            } catch (e) {
                throw new Error('Invalid base64 input');
            }

        case 'hex':
            const hexStr = trimmed.replace(/\s/g, '');
            if (hexStr.length % 2 !== 0) {
                throw new Error('Hex string must have even length');
            }
            const hexBytes = [];
            for (let i = 0; i < hexStr.length; i += 2) {
                hexBytes.push(parseInt(hexStr.substr(i, 2), 16));
            }
            return hexBytes;

        case 'decimal':
            const decStr = trimmed.replace(/\s+/g, ' ').trim();
            return decStr.split(/\s+/).map(n => parseInt(n, 10));

        case 'octal':
            const octStr = trimmed.replace(/\s+/g, ' ').trim();
            return octStr.split(/\s+/).map(n => parseInt(n, 8));

        case 'binary':
            const binStr = trimmed.replace(/\s+/g, ' ').trim();
            return binStr.split(/\s+/).map(n => parseInt(n, 2));

        case 'ascii':
        default:
            return Array.from(trimmed).map(c => c.charCodeAt(0));
    }
}

function bytesToBitString(bytes) {
    return bytes.map(b => b.toString(2).padStart(8, '0')).join('');
}

function bitStringToBytes(bitString) {
    const bytes = [];
    for (let i = 0; i < bitString.length; i += 8) {
        if (i + 8 <= bitString.length) {
            bytes.push(parseInt(bitString.substr(i, 8), 2));
        }
    }
    return bytes;
}

function rotateBitString(bitString, n) {
    n = n % bitString.length;
    if (n === 0) return bitString;
    return bitString.substr(n) + bitString.substr(0, n);
}

function getFactorPairs(n) {
    const factors = [];
    const sqrt = Math.sqrt(n);
    for (let i = 1; i <= sqrt; i++) {
        if (n % i === 0) {
            factors.push({ rows: i, cols: n / i });
            if (i !== n / i) {
                factors.push({ rows: n / i, cols: i });
            }
        }
    }
    return factors.sort((a, b) => a.rows - b.rows);
}

// Read bits from RowsxCols matrix in different modes
// Standard: top-left to bottom-right (row by row)
// Spin right: read columns from bottom to top (left to right)
// Spin left: read columns from right to left (top to bottom)
function readMatrixBits(bitString, mode, rows, cols) {
    const bitCount = bitString.length;

    if (rows * cols !== bitCount) {
        throw new Error(`Matrix dimensions ${rows}x${cols} = ${rows * cols} do not match bit count ${bitCount}`);
    }

    const matrix = [];

    for (let row = 0; row < rows; row++) {
        matrix[row] = [];
        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            matrix[row][col] = bitString[index];
        }
    }

    let result = '';

    if (mode === 'standard') {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                result += matrix[row][col];
            }
        }
    } else if (mode === 'spin-right') {
        for (let col = 0; col < cols; col++) {
            for (let row = rows - 1; row >= 0; row--) {
                result += matrix[row][col];
            }
        }
    } else if (mode === 'spin-left') {
        for (let col = cols - 1; col >= 0; col--) {
            for (let row = 0; row < rows; row++) {
                result += matrix[row][col];
            }
        }
    }

    return result;
}

function repeatingKeyXOR(data, key) {
    if (key.length === 0) {
        throw new Error('XOR key cannot be empty');
    }
    return data.map((byte, index) => byte ^ key[index % key.length]);
}

// { keyByteToXoredBytes: Map(keyByte -> Set(xoredByte)), xoredByteToPlaintext: Map(xoredByte -> [plaintextChars]) }
function buildCache(key) {
    const keyByteToXoredBytes = new Map(); // keyByte -> Set(xoredPlaintextByte)
    const xoredByteToPlaintext = new Map(); // xoredPlaintextByte -> [plaintextChars]
    const commonChars = [];

    // A-Z
    for (let i = 65; i <= 90; i++) commonChars.push(i);
    // a-z
    for (let i = 97; i <= 122; i++) commonChars.push(i);
    // 0-9
    for (let i = 48; i <= 57; i++) commonChars.push(i);

    const collisionBytes = new Set();

    for (let keyIndex = 0; keyIndex < key.length; keyIndex++) {
        const keyByte = key[keyIndex];

        if (!keyByteToXoredBytes.has(keyByte)) {
            keyByteToXoredBytes.set(keyByte, new Set());
        }

        for (const charCode of commonChars) {
            const xorResult = charCode ^ keyByte;

            keyByteToXoredBytes.get(keyByte).add(xorResult);

            if (!xoredByteToPlaintext.has(xorResult)) {
                xoredByteToPlaintext.set(xorResult, []);
            }

            const existing = xoredByteToPlaintext.get(xorResult);
            if (!existing.includes(charCode)) {
                existing.push(charCode);
                if (existing.length > 1) {
                    collisionBytes.add(xorResult);
                }
            }
        }
    }

    return {
        keyByteToXoredBytes,
        xoredByteToPlaintext,
        collisions: Array.from(collisionBytes)
    };
}

// Rotated then XORed
// Try different rotations, XOR, then check byte-aligned bytes
// Note: matrixMode is already applied to ciphertextBytes before calling this function
function analyzeRotatedThenXORed(ciphertextBytes, key, cache, matrixMode = 'standard') {
    let bitString = bytesToBitString(ciphertextBytes);
    const results = [];

    for (let rotation = 0; rotation < 8; rotation++) {
        const rotatedBits = rotateBitString(bitString, rotation);
        const rotatedBytes = bitStringToBytes(rotatedBits);
        const xoredBytes = repeatingKeyXOR(rotatedBytes, key);

        let matchCount = 0;
        let totalBytes = xoredBytes.length;
        const matchingBytes = [];

        for (let i = 0; i < xoredBytes.length; i++) {
            const byte = xoredBytes[i];
            const keyByte = key[i % key.length];
            const xoredBytesSet = cache.keyByteToXoredBytes.get(keyByte);

            // After XORing ciphertext with key, we get plaintext bytes
            // Check if this plaintext byte, when XORed with the key byte, produces a value in our cache
            // This means: if (plaintextByte ^ keyByte) is in the cache, then plaintextByte is a common ASCII char
            const expectedXoredByte = byte ^ keyByte;
            if (xoredBytesSet && xoredBytesSet.has(expectedXoredByte)) {
                matchCount++;
                matchingBytes.push({
                    index: i,
                    byte: byte,
                    candidates: cache.xoredByteToPlaintext.get(expectedXoredByte) || []
                });
            }
        }

        results.push({
            rotation: rotation,
            matchCount: matchCount,
            totalBytes: totalBytes,
            matchPercentage: totalBytes > 0 ? (matchCount / totalBytes * 100).toFixed(2) : 0,
            matchingBytes: matchingBytes,
            xoredBytes: xoredBytes,
            rotatedBytes: rotatedBytes
        });
    }

    return results;
}

// XORed then rotated
// XOR first, then try different rotations and check byte-aligned bytes
// Note: matrixMode is already applied to ciphertextBytes before calling this function
function analyzeXORedThenRotated(ciphertextBytes, key, cache, matrixMode = 'standard') {
    const xoredBytes = repeatingKeyXOR(ciphertextBytes, key);
    let bitString = bytesToBitString(xoredBytes);

    const results = [];

    for (let rotation = 0; rotation < 8; rotation++) {
        const rotatedBits = rotateBitString(bitString, rotation);
        const rotatedBytes = bitStringToBytes(rotatedBits);

        let matchCount = 0;
        let totalBytes = rotatedBytes.length;
        const matchingBytes = [];

        for (let i = 0; i < rotatedBytes.length; i++) {
            const byte = rotatedBytes[i];
            const keyByte = key[i % key.length];
            const xoredBytesSet = cache.keyByteToXoredBytes.get(keyByte);

            // After XORing ciphertext with key, we get plaintext bytes
            // Check if this plaintext byte, when XORed with the key byte, produces a value in our cache
            // This means: if (plaintextByte ^ keyByte) is in the cache, then plaintextByte is a common ASCII char
            const expectedXoredByte = byte ^ keyByte;
            if (xoredBytesSet && xoredBytesSet.has(expectedXoredByte)) {
                matchCount++;
                matchingBytes.push({
                    index: i,
                    byte: byte,
                    candidates: cache.xoredByteToPlaintext.get(expectedXoredByte) || []
                });
            }
        }

        results.push({
            rotation: rotation,
            matchCount: matchCount,
            totalBytes: totalBytes,
            matchPercentage: totalBytes > 0 ? (matchCount / totalBytes * 100).toFixed(2) : 0,
            matchingBytes: matchingBytes,
            rotatedBytes: rotatedBytes
        });
    }

    return results;
}

function renderRotationAnalysis(scenario1Results, scenario2Results, cache) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    const container = document.createElement('div');

    const scenario1Div = document.createElement('div');
    scenario1Div.className = 'scenario-section';
    const scenario1Title = document.createElement('h3');
    scenario1Title.textContent = 'Scenario 1: Rotated then XORed';
    scenario1Div.appendChild(scenario1Title);

    const scenario1Table = document.createElement('table');
    scenario1Table.className = 'results-table';
    const scenario1Header = document.createElement('tr');
    scenario1Header.innerHTML = '<th>Rotation</th><th>Matches</th><th>Total Bytes</th><th>Match %</th><th>View</th>';
    scenario1Table.appendChild(scenario1Header);

    scenario1Results.forEach(result => {
        const row = document.createElement('tr');
        if (parseFloat(result.matchPercentage) > 10) {
            row.classList.add('high-match');
        }
        row.innerHTML = `
            <td>${result.rotation} bits</td>
            <td>${result.matchCount}</td>
            <td>${result.totalBytes}</td>
            <td>${result.matchPercentage}%</td>
            <td><button class="view-btn" data-scenario="1" data-rotation="${result.rotation}">View</button></td>
        `;
        scenario1Table.appendChild(row);
    });

    scenario1Div.appendChild(scenario1Table);
    container.appendChild(scenario1Div);

    const scenario2Div = document.createElement('div');
    scenario2Div.className = 'scenario-section';
    const scenario2Title = document.createElement('h3');
    scenario2Title.textContent = 'Scenario 2: XORed then Rotated';
    scenario2Div.appendChild(scenario2Title);

    const scenario2Table = document.createElement('table');
    scenario2Table.className = 'results-table';
    const scenario2Header = document.createElement('tr');
    scenario2Header.innerHTML = '<th>Rotation</th><th>Matches</th><th>Total Bytes</th><th>Match %</th><th>View</th>';
    scenario2Table.appendChild(scenario2Header);

    scenario2Results.forEach(result => {
        const row = document.createElement('tr');
        if (parseFloat(result.matchPercentage) > 10) {
            row.classList.add('high-match');
        }
        row.innerHTML = `
            <td>${result.rotation} bits</td>
            <td>${result.matchCount}</td>
            <td>${result.totalBytes}</td>
            <td>${result.matchPercentage}%</td>
            <td><button class="view-btn" data-scenario="2" data-rotation="${result.rotation}">View</button></td>
        `;
        scenario2Table.appendChild(row);
    });

    scenario2Div.appendChild(scenario2Table);
    container.appendChild(scenario2Div);

    outputDiv.appendChild(container);

    window.rotationResults = {
        scenario1: scenario1Results,
        scenario2: scenario2Results,
        cache: cache
    };

    outputDiv.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const scenario = parseInt(e.target.dataset.scenario);
            const rotation = parseInt(e.target.dataset.rotation);
            viewRotationResult(scenario, rotation);
        });
    });
}

function viewRotationResult(scenario, rotation) {
    const results = window.rotationResults;
    let result;
    let bytes;
    let title;

    if (scenario === 1) {
        result = results.scenario1[rotation];
        bytes = result.xoredBytes;
        title = `Scenario 1: Rotated ${rotation} bits then XORed`;
    } else {
        result = results.scenario2[rotation];
        bytes = result.rotatedBytes;
        title = `Scenario 2: XORed then rotated ${rotation} bits`;
    }

    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Analysis';
    backBtn.className = 'back-btn';
    backBtn.addEventListener('click', () => {
        renderRotationAnalysis(results.scenario1, results.scenario2, results.cache);
    });
    outputDiv.appendChild(backBtn);

    const titleDiv = document.createElement('h3');
    titleDiv.textContent = title;
    outputDiv.appendChild(titleDiv);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-box';
    infoDiv.textContent = `Match Count: ${result.matchCount} / ${result.totalBytes} (${result.matchPercentage}%)`;
    outputDiv.appendChild(infoDiv);

    const container = document.createElement('div');
    container.className = 'byte-display';
    container.style.fontFamily = 'Courier New, monospace';
    container.style.whiteSpace = 'pre-wrap';

    bytes.forEach((byte, index) => {
        const match = result.matchingBytes.find(m => m.index === index);
        const span = document.createElement('span');
        const binary = byte.toString(2).padStart(8, '0');
        span.textContent = binary;
        span.className = 'byte-span';

        if (match) {
            span.classList.add('highlight');
            span.dataset.byteValue = byte;
            span.dataset.candidates = JSON.stringify(match.candidates);
        }

        if (index < bytes.length - 1) {
            span.textContent += ' ';
        }

        container.appendChild(span);
    });

    outputDiv.appendChild(container);

    container.querySelectorAll('.highlight').forEach(span => {
        span.addEventListener('mouseenter', (e) => {
            showPopover(e.target, results.cache);
        });
        span.addEventListener('mouseleave', () => {
            hidePopover();
        });
    });
}

function showPopover(element, cache) {
    const popover = document.getElementById('popover');
    const byteValue = parseInt(element.dataset.byteValue);
    const candidates = JSON.parse(element.dataset.candidates || '[]');

    if (candidates.length === 0) {
        return;
    }

    let content = '<div class="popover-title">Byte: 0x' + byteValue.toString(16).padStart(2, '0').toUpperCase() + ' (' + byteValue + ')</div>';
    content += '<div class="popover-content">';
    content += '<strong>Possible plaintext characters:</strong><br>';

    const charDisplays = candidates.map(charCode => {
        const char = String.fromCharCode(charCode);
        const display = char === ' ' ? '(space)' : char;
        return `${display} (${charCode})`;
    });

    content += charDisplays.join(', ');
    content += '</div>';

    popover.innerHTML = content;
    popover.classList.remove('hidden');

    setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        let top = rect.top - popoverRect.height - 10;
        let left = rect.left;

        if (top < 10) {
            top = rect.bottom + 10;
        }

        if (top + popoverRect.height > viewportHeight - 10) {
            top = rect.top - popoverRect.height - 10;
            if (top < 10) {
                top = 10;
            }
        }

        if (left + popoverRect.width > viewportWidth - 10) {
            left = viewportWidth - popoverRect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }

        popover.style.position = 'fixed';
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }, 0);
}

function hidePopover() {
    const popover = document.getElementById('popover');
    popover.classList.add('hidden');
}

function process() {
    try {
        const ciphertextInput = document.getElementById('ciphertext').value;
        const keyInput = document.getElementById('xor-key').value;
        const ciphertextFormat = document.getElementById('ciphertext-format').value;
        const keyFormat = document.getElementById('key-format').value;

        if (!ciphertextInput.trim() || !keyInput.trim()) {
            alert('Please enter both ciphertext and XOR key');
            return;
        }

        const detectedCiphertextFormat = detectFormat(ciphertextInput, ciphertextFormat);
        const detectedKeyFormat = detectFormat(keyInput, keyFormat);

        let ciphertext = decodeInput(ciphertextInput, detectedCiphertextFormat);
        const key = decodeInput(keyInput, detectedKeyFormat);

        const matrixDimensions = document.getElementById('matrix-dimensions').value;
        const matrixMode = document.getElementById('matrix-mode').value;

        if (matrixDimensions !== 'none') {
            let originalBitString = bytesToBitString(ciphertext);
            console.log(`Original ciphertext: ${ciphertext.length} bytes = ${originalBitString.length} bits`);

            try {
                const [rows, cols] = matrixDimensions.split('x').map(Number);

                originalBitString = readMatrixBits(originalBitString, matrixMode, rows, cols);
                console.log(`Matrix ${rows}x${cols} with mode ${matrixMode} applied successfully. New bit count: ${originalBitString.length}`);

                ciphertext = bitStringToBytes(originalBitString);
                console.log(`After matrix transformation: ${ciphertext.length} bytes`);
            } catch (e) {
                console.log(`Note: Matrix transformation not applied. Error: ${e.message}`);
                alert(`Matrix transformation error: ${e.message}`);
            }
        }

        const cache = buildCache(key);
        const collisionWarning = document.getElementById('collision-warning');
        if (cache.collisions.length > 0) {
            collisionWarning.textContent = `Warning: Found ${cache.collisions.length} collision(s) in cache. Some bytes map to multiple plaintext characters.`;
            collisionWarning.classList.remove('hidden');
        } else {
            collisionWarning.classList.add('hidden');
        }

        const cacheInfo = document.getElementById('cache-info');
        const bitCount = ciphertext.length * 8;
        let matrixInfo = '';
        if (matrixDimensions !== 'none') {
            const [rows, cols] = matrixDimensions.split('x').map(Number);
            matrixInfo = ` Matrix: ${rows}x${cols}. Mode: ${matrixMode}.`;
        }
        cacheInfo.textContent = `Cache built from ${key.length} key byte(s). Key bytes map to ${cache.keyByteToXoredBytes.size} unique XOR result sets.${matrixInfo}`;
        cacheInfo.classList.remove('hidden');

        const scenario1Results = analyzeRotatedThenXORed(ciphertext, key, cache, matrixMode);
        const scenario2Results = analyzeXORedThenRotated(ciphertext, key, cache, matrixMode);

        renderRotationAnalysis(scenario1Results, scenario2Results, cache);

    } catch (error) {
        alert('Error: ' + error.message);
        console.error(error);
    }
}

function updateMatrixDimensions() {
    try {
        const ciphertextInput = document.getElementById('ciphertext').value;
        const ciphertextFormat = document.getElementById('ciphertext-format').value;

        if (!ciphertextInput.trim()) {
            const matrixDimensionsSelect = document.getElementById('matrix-dimensions');
            matrixDimensionsSelect.innerHTML = '<option value="none">No matrix transformation</option>';
            return;
        }

        const detectedFormat = detectFormat(ciphertextInput, ciphertextFormat);
        const ciphertext = decodeInput(ciphertextInput, detectedFormat);

        const originalBitCount = ciphertext.length * 8;
        const factorPairs = getFactorPairs(originalBitCount);
        const matrixDimensionsSelect = document.getElementById('matrix-dimensions');

        matrixDimensionsSelect.innerHTML = '<option value="none">No matrix transformation</option>';

        factorPairs.forEach(({ rows, cols }) => {
            const option = document.createElement('option');
            option.value = `${rows}x${cols}`;
            option.textContent = `${rows}x${cols} (${rows * cols} bits)`;
            matrixDimensionsSelect.appendChild(option);
        });
    } catch (error) {
        const matrixDimensionsSelect = document.getElementById('matrix-dimensions');
        matrixDimensionsSelect.innerHTML = '<option value="none">No matrix transformation (invalid input)</option>';
    }
}

async function runAutoMode() {
    const autoBtn = document.getElementById('auto-mode-btn');
    const outputDiv = document.getElementById('output');

    try {
        const ciphertextInput = document.getElementById('ciphertext').value;
        const keyInput = document.getElementById('xor-key').value;
        const ciphertextFormat = document.getElementById('ciphertext-format').value;
        const keyFormat = document.getElementById('key-format').value;

        if (!ciphertextInput.trim() || !keyInput.trim()) {
            alert('Please enter both ciphertext and XOR key');
            return;
        }

        autoBtn.disabled = true;
        autoBtn.textContent = '⏳ Analyzing...';
        outputDiv.innerHTML = '<div style="text-align: center; padding: 20px;"><p>Analyzing all configurations...</p><p>This may take a moment...</p></div>';

        const detectedCiphertextFormat = detectFormat(ciphertextInput, ciphertextFormat);
        const detectedKeyFormat = detectFormat(keyInput, keyFormat);

        const originalCiphertext = decodeInput(ciphertextInput, detectedCiphertextFormat);
        const key = decodeInput(keyInput, detectedKeyFormat);

        const cache = buildCache(key);

        const originalBitCount = originalCiphertext.length * 8;
        const factorPairs = getFactorPairs(originalBitCount);

        const allConfigs = [{ dimensions: 'none', rows: null, cols: null }];
        factorPairs.forEach(({ rows, cols }) => {
            allConfigs.push({ dimensions: `${rows}x${cols}`, rows, cols });
        });

        const matrixModes = ['standard', 'spin-right', 'spin-left'];
        const scenarios = ['rotated-then-xored', 'xored-then-rotated'];
        const rotations = [0, 1, 2, 3, 4, 5, 6, 7];

        const results = [];

        for (const config of allConfigs) {
            for (const matrixMode of matrixModes) {
                for (const scenario of scenarios) {
                    for (const rotation of rotations) {
                        try {
                            let ciphertext = [...originalCiphertext];

                            if (config.dimensions !== 'none') {
                                let bitString = bytesToBitString(ciphertext);
                                bitString = readMatrixBits(bitString, matrixMode, config.rows, config.cols);
                                ciphertext = bitStringToBytes(bitString);
                            }

                            let xoredBytes;
                            let finalBytes;

                            if (scenario === 'rotated-then-xored') {
                                let bitString = bytesToBitString(ciphertext);
                                bitString = rotateBitString(bitString, rotation);
                                const rotatedBytes = bitStringToBytes(bitString);
                                xoredBytes = repeatingKeyXOR(rotatedBytes, key);
                                finalBytes = xoredBytes;
                            } else {
                                xoredBytes = repeatingKeyXOR(ciphertext, key);
                                let bitString = bytesToBitString(xoredBytes);
                                bitString = rotateBitString(bitString, rotation);
                                finalBytes = bitStringToBytes(bitString);
                            }

                            let matchCount = 0;
                            for (let i = 0; i < finalBytes.length; i++) {
                                const byte = finalBytes[i];
                                const keyByte = key[i % key.length];
                                const xoredBytesSet = cache.keyByteToXoredBytes.get(keyByte);
                                // After XORing ciphertext with key, we get plaintext bytes
                                // Check if (plaintextByte ^ keyByte) is in the cache
                                const expectedXoredByte = byte ^ keyByte;
                                if (xoredBytesSet && xoredBytesSet.has(expectedXoredByte)) {
                                    matchCount++;
                                }
                            }

                            const matchPercentage = finalBytes.length > 0 ? (matchCount / finalBytes.length * 100) : 0;

                            results.push({
                                config: config.dimensions,
                                matrixMode,
                                scenario,
                                rotation,
                                matchCount,
                                totalBytes: finalBytes.length,
                                matchPercentage,
                                xoredBytes: finalBytes
                            });
                        } catch (e) {
                            console.log(`Skipping config: ${config.dimensions}, ${matrixMode}, ${scenario}, rotation ${rotation} - ${e.message}`);
                        }
                    }
                }
            }
        }

        results.sort((a, b) => b.matchPercentage - a.matchPercentage);

        renderAutoResults(results, cache, key);

    } catch (error) {
        alert('Error in auto mode: ' + error.message);
        console.error(error);
    } finally {
        autoBtn.disabled = false;
        autoBtn.textContent = '🔍 Auto Mode';
    }
}

function renderAutoResults(results, cache, key) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'auto-results';

    const title = document.createElement('h3');
    title.textContent = `Auto Mode Results (Top ${Math.min(50, results.length)} configurations)`;
    container.appendChild(title);

    const topResults = results.slice(0, 50);

    topResults.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'ranked-result';
        if (index === 0) {
            resultDiv.classList.add('top-result');
        }

        const header = document.createElement('div');
        header.className = 'ranked-result-header';

        const rank = document.createElement('div');
        rank.className = index === 0 ? 'ranked-result-rank ranked-result-top-rank' : 'ranked-result-rank';
        rank.textContent = `#${index + 1}`;
        header.appendChild(rank);

        const config = document.createElement('div');
        config.className = 'ranked-result-config';
        const scenarioName = result.scenario === 'rotated-then-xored' ? 'Rotated→XORed' : 'XORed→Rotated';
        const matrixInfo = result.config === 'none' ? 'No matrix' : `Matrix: ${result.config}`;
        config.textContent = `${scenarioName} | ${matrixInfo} | Mode: ${result.matrixMode} | Rotation: ${result.rotation} bits`;
        header.appendChild(config);

        resultDiv.appendChild(header);

        const stats = document.createElement('div');
        stats.className = 'ranked-result-stats';

        const matchStat = document.createElement('div');
        matchStat.className = 'ranked-result-stat';
        matchStat.innerHTML = `
            <div class="ranked-result-stat-label">Match %</div>
            <div class="ranked-result-stat-value" style="color: ${result.matchPercentage > 20 ? '#28a745' : result.matchPercentage > 10 ? '#ffc107' : '#dc3545'}">${result.matchPercentage.toFixed(2)}%</div>
        `;
        stats.appendChild(matchStat);

        const countStat = document.createElement('div');
        countStat.className = 'ranked-result-stat';
        countStat.innerHTML = `
            <div class="ranked-result-stat-label">Matches</div>
            <div class="ranked-result-stat-value">${result.matchCount} / ${result.totalBytes}</div>
        `;
        stats.appendChild(countStat);

        resultDiv.appendChild(stats);

        const actions = document.createElement('div');
        actions.className = 'ranked-result-actions';
        const viewBtn = document.createElement('button');
        viewBtn.className = 'ranked-result-btn';
        viewBtn.textContent = 'View Details';
        viewBtn.addEventListener('click', () => {
            viewAutoResult(result, cache, key);
        });
        actions.appendChild(viewBtn);
        resultDiv.appendChild(actions);

        container.appendChild(resultDiv);
    });

    outputDiv.appendChild(container);
}

function viewAutoResult(result, cache, key) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Auto Results';
    backBtn.className = 'back-btn';
    backBtn.addEventListener('click', () => {
        runAutoMode();
    });
    outputDiv.appendChild(backBtn);

    const titleDiv = document.createElement('h3');
    const scenarioName = result.scenario === 'rotated-then-xored' ? 'Rotated then XORed' : 'XORed then Rotated';
    const matrixInfo = result.config === 'none' ? 'No matrix' : `Matrix: ${result.config}`;
    titleDiv.textContent = `${scenarioName} | ${matrixInfo} | Mode: ${result.matrixMode} | Rotation: ${result.rotation} bits`;
    outputDiv.appendChild(titleDiv);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-box';
    infoDiv.textContent = `Match Count: ${result.matchCount} / ${result.totalBytes} (${result.matchPercentage.toFixed(2)}%)`;
    outputDiv.appendChild(infoDiv);

    const container = document.createElement('div');
    container.className = 'byte-display';
    container.style.fontFamily = 'Courier New, monospace';
    container.style.whiteSpace = 'pre-wrap';

    result.xoredBytes.forEach((byte, index) => {
        const keyByte = key[index % key.length];
        const xoredBytesSet = cache.keyByteToXoredBytes.get(keyByte);
        // After XORing ciphertext with key, we get plaintext bytes
        // Check if (plaintextByte ^ keyByte) is in the cache
        const expectedXoredByte = byte ^ keyByte;
        const isMatch = xoredBytesSet && xoredBytesSet.has(expectedXoredByte);

        const span = document.createElement('span');
        const binary = byte.toString(2).padStart(8, '0');
        span.textContent = binary;
        span.className = 'byte-span';

        if (isMatch) {
            span.classList.add('highlight');
            span.dataset.byteValue = byte;
            const candidates = cache.xoredByteToPlaintext.get(expectedXoredByte) || [];
            span.dataset.candidates = JSON.stringify(candidates);
        }

        if (index < result.xoredBytes.length - 1) {
            span.textContent += ' ';
        }

        container.appendChild(span);
    });

    outputDiv.appendChild(container);
    container.querySelectorAll('.highlight').forEach(span => {
        span.addEventListener('mouseenter', (e) => {
            showPopover(e.target, cache);
        });
        span.addEventListener('mouseleave', () => {
            hidePopover();
        });
    });
}

document.getElementById('process-btn').addEventListener('click', process);
document.getElementById('auto-mode-btn').addEventListener('click', runAutoMode);

document.getElementById('ciphertext').addEventListener('input', updateMatrixDimensions);
document.getElementById('ciphertext-format').addEventListener('change', updateMatrixDimensions);

document.getElementById('reverse-ciphertext-btn').addEventListener('click', () => {
    const ciphertextTextarea = document.getElementById('ciphertext');
    const currentText = ciphertextTextarea.value;
    ciphertextTextarea.value = currentText.split('').reverse().join('');
    ciphertextTextarea.dispatchEvent(new Event('input'));
});

document.getElementById('how-it-works-toggle').addEventListener('click', () => {
    const toggle = document.getElementById('how-it-works-toggle');
    const content = document.getElementById('how-it-works-content');

    toggle.classList.toggle('expanded');
    content.classList.toggle('expanded');
    content.classList.toggle('hidden');
});
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        process();
    }
});
