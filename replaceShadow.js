const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let count = 0;
walkDir('f:/campus-green-biz-backend/src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.scss')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('shadow-sm')) {
      let newContent = content.replace(/shadow-sm/g, 'shadow-md');
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
      count++;
    }
  }
});

console.log(`Finished replacing in ${count} files.`);
