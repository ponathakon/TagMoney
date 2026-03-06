const fs = require('fs');
const path = require('path');

function replaceFontsInDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceFontsInDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const newContent = content.replace(/Inter_/g, 'Prompt_');
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

replaceFontsInDirectory(path.join(__dirname, 'app'));
replaceFontsInDirectory(path.join(__dirname, 'components'));
