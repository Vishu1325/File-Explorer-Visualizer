const pathInput = document.getElementById('pathInput');
const loadButton = document.getElementById('loadButton');
const treeContainer = document.getElementById('treeContainer');
const rootPathLabel = document.getElementById('rootPath');
const rootNameLabel = document.getElementById('rootName');
const totalSizeLabel = document.getElementById('totalSize');
const itemCountLabel = document.getElementById('itemCount');
const depthSelect = document.getElementById('depthSelect');

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`;
}

function buildColor(size, maxSize) {
    if (!maxSize || maxSize === 0) return '#6ad7ff';
    const ratio = Math.min(1, size / maxSize);
    const hue = 200 + Math.round(120 * ratio);
    return `hsl(${hue}, 85%, 60%)`;
}

function renderNode(node, maxSize) {
    const row = document.createElement('div');
    row.className = 'node-row';
    row.style.borderLeft = `4px solid ${buildColor(node.size, maxSize)}`;

    const label = document.createElement('div');
    label.className = 'node-label';

    const colorDot = document.createElement('span');
    colorDot.className = 'node-color';
    colorDot.style.backgroundColor = buildColor(node.size, maxSize);

    const name = document.createElement('span');
    name.className = 'node-name';
    name.textContent = node.name;
    label.append(colorDot, name);

    const typeTag = document.createElement('span');
    typeTag.className = 'node-tag';
    typeTag.textContent = node.isDirectory ? 'folder' : node.type;

    const sizeLabel = document.createElement('div');
    sizeLabel.className = 'node-size';
    sizeLabel.textContent = formatBytes(node.size || 0);

    row.append(label, typeTag, sizeLabel);

    row.addEventListener('click', () => {
        fetch(`/api/open?path=${encodeURIComponent(node.path)}`)
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    alert(data.message || 'Unable to open this item.');
                }
            });
    });

    if (node.children && node.children.length) {
        const children = document.createElement('div');
        children.className = 'tree-children';
        let maxChildSize = Math.max(...node.children.map((child) => child.size || 0), 1);
        node.children.forEach((child) => children.appendChild(renderNode(child, maxChildSize)));
        row.append(children);
    }

    return row;
}

function renderTree(root) {
    treeContainer.innerHTML = '';
    const maxSize = Math.max(root.size || 0, 1);
    treeContainer.appendChild(renderNode(root, maxSize));
    const totalItems = countItems(root);
    rootPathLabel.textContent = root.path;
    rootNameLabel.textContent = `Root:`;
    totalSizeLabel.textContent = formatBytes(root.size || 0);
    itemCountLabel.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
}

function countItems(node) {
    if (!node.children) return 1;
    return node.children.reduce((count, child) => count + countItems(child), 1);
}

async function loadTree() {
    const pathValue = pathInput.value.trim();
    const depth = depthSelect.value;
    treeContainer.textContent = 'Loading folder data…';

    try {
        const response = await fetch(`/api/tree?path=${encodeURIComponent(pathValue)}&depth=${depth}`);
        const root = await response.json();
        if (response.ok) {
            renderTree(root);
        } else {
            treeContainer.textContent = root.message || root.error || 'Unable to load data.';
        }
    } catch (error) {
        treeContainer.textContent = 'Network error while loading folder.';
    }
}

loadButton.addEventListener('click', loadTree);
window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && document.activeElement === pathInput) {
        loadTree();
    }
});

loadTree();
