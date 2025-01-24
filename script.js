const tagsPerPage = 20;

document.getElementById('uploadButton').addEventListener('click', async () => {

    const fileInput = document.getElementById('imageInput');
    const file = fileInput.files[0];
    const imagePreview = document.getElementById('imagePreview');
    const uploadModal = document.getElementById('uploadModal');
    const uploadProgress = document.getElementById('uploadProgress');

    if (!file) return showToast('Please select an image file first.');


    const reader = new FileReader();
    reader.onload = e => imagePreview.src = e.target.result;
    reader.readAsDataURL(file);

    const apiKey = 'acc_c23f378a7618b4f';
    const apiSecret = '9c5f1fc9b6c3d4331f8291cdcbaef879';
    const authHeader = 'Basic ' + btoa(`${apiKey}:${apiSecret}`);

    // Prepare data for upload
    const formData = new FormData();
    formData.append('image', file);

    let upload_id;

    try {
        uploadModal.style.display = 'block';
        uploadProgress.style.width = '0%';


        const uploadResponse = await fetch('https://api.imagga.com/v2/uploads', {
            method: 'POST',
            headers: { 'Authorization': authHeader },
            body: formData
        });


        if (!uploadResponse.ok) throw new Error('Upload failed.');

        // Track upload progress
        const contentLength = +uploadResponse.headers.get('Content-Length');
        const reader = uploadResponse.body.getReader();
        let receivedLength = 0;
        let chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            uploadProgress.style.width = `${(receivedLength / contentLength) * 100}%`;
        }


        const responseArray = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            responseArray.set(chunk, position);
            position += chunk.length;
        }
        const text = new TextDecoder('utf-8').decode(responseArray);
        const parsedResponse = JSON.parse(text);
        upload_id = parsedResponse.result.upload_id;

        console.log('Fetching colors with upload_id:', upload_id);
        const colorResponse = await fetch(`https://api.imagga.com/v2/colors?image_upload_id=${upload_id}`, { headers: { 'Authorization': authHeader } });
        if (!colorResponse.ok) {
            throw new Error(`Failed to fetch colors: ${colorResponse.status} ${colorResponse.statusText}`);
        }
        const colorResult = await colorResponse.json();

        console.log('Fetching tags with upload_id:', upload_id);
        const tagsResponse = await fetch(`https://api.imagga.com/v2/tags?image_upload_id=${upload_id}`, { headers: { 'Authorization': authHeader } });
        if (!tagsResponse.ok) {
            throw new Error(`Failed to fetch tags: ${tagsResponse.status} ${tagsResponse.statusText}`);
        }
        const tagsResult = await tagsResponse.json();

        displayColors(colorResult.result.colors);
        displayTags(tagsResult.result.tags);
    } catch (error) {
        console.error('Error:', error);
        console.error('Details:', {
            upload_id,
            authHeader,
            message: error.message,
            stack: error.stack
        });
        showToast('An error occurred while processing the image!');
    } finally {
        uploadModal.style.display = 'none';
    }
});


const displayColors = colors => {
    const colorsContainer = document.querySelector('.colors-container');
    colorsContainer.innerHTML = '';

    if (![colors.background_colors, colors.foreground_colors, colors.image_colors].some(arr => arr.length)) {
        colorsContainer.innerHTML = '<p class="error">Nothing to show...</p>';
        return;
    }

    const generateColorSection = (title, colorData) => {
        return `

            <h3>${title}</h3>
            <div class="results">
                ${colorData.map(({ html_code, closest_palette_color, percent }) => `
                    <div class="result-item" data-color="${html_code}">
                        <div>
                            <div class="color-box" style="background-color: ${html_code}" title="Color code: ${html_code}"></div>
                            <p>${html_code}<span> - ${closest_palette_color}</span></p>
                        </div>
                        <div class="progress-bar">
                            <span>${percent.toFixed(2)}%</span>
                            <div class="progress" style="width: ${percent}%"></div>
                        </div>
                    </div> 
                `).join('')}
            </div>
        `;
    };

    colorsContainer.innerHTML += generateColorSection('Background Colors', colors.background_colors);
    colorsContainer.innerHTML += generateColorSection('Foreground Colors', colors.foreground_colors);
    colorsContainer.innerHTML += generateColorSection('Image Colors', colors.image_colors);

    document.querySelectorAll('.colors-container .result-item').forEach(item => {
        item.addEventListener('click', () => {
            const colorCode = item.getAttribute('data-color');
            navigator.clipboard.writeText(colorCode).then(() => showToast(`Copied: ${colorCode}`)).catch(() => showToast('Failed to copy color code!'));
        });
    });

};


let allTags = [];
let displayedTags = 0;

const displayTags = tags => {
    const tagsContainer = document.querySelector('.tags-container');
    const resultList = tagsContainer.querySelector('.results');
    const error = tagsContainer.querySelector('.error');
    const seeMoreButton = document.getElementById('seeMoreButton');
    const exportTagsButton = document.getElementById('exportTagsButton');

    if (resultList) {
        resultList.innerHTML = '';
    } else {
        const resultListContainer = document.createElement('div');
        resultListContainer.className = 'results';
        tagsContainer.insertBefore(resultListContainer, seeMoreButton);
    }


    allTags = tags;
    displayedTags = 0;

    const showMoreTags = () => {
        const tagsToShow = allTags.slice(displayedTags, displayedTags + tagsPerPage);
        displayedTags += tagsToShow.length;

        const tagsHTML = tagsToShow.map(({ tag: { en } }) => `
        
            <div class="result-item">
                <p>${en}</p>
            </div>
        `).join('');

        if (resultList) {
            resultList.innerHTML += tagsHTML;
        }

        error.style.display = displayedTags > 0 ? 'none' : 'block';
        seeMoreButton.style.display = displayedTags < allTags.length ? 'block' : 'none';
        exportTagsButton.style.display = displayedTags > 0 ? 'block' : 'none';
    };

    showMoreTags();

    seeMoreButton.addEventListener('click', showMoreTags);
    exportTagsButton.addEventListener('click', exportTagsToFile);
};


const exportTagsToFile = () => {
    if (allTags.length === 0) {
        showToast('No tags available to export!');
        return;
    }


    const tagsText = allTags.map(({ tag: { en } }) => en).join('\n');
    const blob = new Blob([tagsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Tags.txt';
    a.click();
    URL.revokeObjectURL(url);
};


const showToast = message => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100); // Show toast
    setTimeout(() => {
        toast.classList.remove('show'); // Hide toast
        setTimeout(() => document.body.removeChild(toast), 500);
    }, 3000);
};