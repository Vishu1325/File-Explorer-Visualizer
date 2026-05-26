const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const { execFile } = require('child_process');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));
app.use(express.json());

function safePath(requestedPath) {
    if (!requestedPath) return os.homedir();
    return path.resolve(requestedPath);
}

function sortBySize(a, b) {
    return b.size - a.size;
}

async function readDirectory(pathWithDir, depth = 1) {
    const node = {
        path: pathWithDir,
        name: path.basename(pathWithDir) || pathWithDir,
        isDirectory: true,
        size: 0,
        children: []
    };

    let entries;
    try {
        entries = await fs.readdir(pathWithDir, { withFileTypes: true });
    } catch (error) {
        return { ...node, error: 'Unable to read folder contents' };
    }

    const childPromises = entries.map(async (entry) => {
        const entryPath = path.join(pathWithDir, entry.name);
        try {
            const stats = await fs.stat(entryPath);
            const child = {
                path: entryPath,
                name: entry.name,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                modified: stats.mtimeMs,
                type: stats.isDirectory() ? 'directory' : path.extname(entry.name).slice(1) || 'file'
            };
            if (stats.isDirectory() && depth > 0) {
                const subtree = await readDirectory(entryPath, depth - 1);
                child.size = subtree.size;
                child.children = subtree.children;
            }
            return child;
        } catch (error) {
            return {
                path: entryPath,
                name: entry.name,
                isDirectory: entry.isDirectory(),
                size: 0,
                type: entry.isDirectory() ? 'directory' : path.extname(entry.name).slice(1) || 'file',
                error: 'Permission denied or inaccessible'
            };
        }
    });

    const children = await Promise.all(childPromises);
    node.children = children.sort(sortBySize);
    node.size = children.reduce((sum, child) => sum + (child.size || 0), 0);
    return node;
}

async function getFileInfo(filePath) {
    const stats = await fs.stat(filePath);
    return {
        path: filePath,
        name: path.basename(filePath),
        isDirectory: false,
        size: stats.size,
        modified: stats.mtimeMs,
        type: path.extname(filePath).slice(1) || 'file'
    };
}

app.get('/api/tree', async (req, res) => {
    try {
        const requestedPath = safePath(req.query.path);
        const depth = Number(req.query.depth) >= 0 ? Number(req.query.depth) : 1;
        const stats = await fs.stat(requestedPath);

        if (stats.isDirectory()) {
            const tree = await readDirectory(requestedPath, depth);
            res.json(tree);
            return;
        }

        const fileInfo = await getFileInfo(requestedPath);
        res.json(fileInfo);
    } catch (error) {
        res.status(400).json({ error: 'Unable to load path', message: error.message });
    }
});

app.get('/api/open', async (req, res) => {
    try {
        const requestedPath = safePath(req.query.path);
        const stats = await fs.stat(requestedPath);
        let args;

        if (stats.isDirectory()) {
            args = [requestedPath];
        } else {
            args = ['/select,', requestedPath];
        }

        execFile('explorer.exe', args, (error) => {
            if (error) {
                res.status(500).json({ error: 'Failed to open path', message: error.message });
                return;
            }
            res.json({ opened: true, path: requestedPath });
        });
    } catch (error) {
        res.status(400).json({ error: 'Unable to open path', message: error.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
    console.log(`File Explorer Visualizer running at http://localhost:${port}`);
});
