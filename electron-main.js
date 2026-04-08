const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let flaskProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        icon: path.join(__dirname, 'icon.png'), // Add an icon file
        title: 'Video Cutter Pro'
    });

    // Load the Flask app
    mainWindow.loadURL('http://127.0.0.1:3000');

    // Start Flask server
    startFlaskServer();

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (flaskProcess) {
            flaskProcess.kill();
        }
    });
}

function startFlaskServer() {
    flaskProcess = spawn('python', ['app.py'], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    flaskProcess.on('error', (error) => {
        console.error('Failed to start Flask server:', error);
        dialog.showErrorBox('Server Error', 'Failed to start the video processing server. Make sure Python and dependencies are installed.');
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle file dialogs for better UX
ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] }
        ]
    });
    return result;
});

ipcMain.handle('select-output-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result;
});