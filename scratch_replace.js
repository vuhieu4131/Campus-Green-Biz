const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findFiles(srcDir);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace default_avatar inside <Avatar src={...} /> or <img src={...} />
  content = content.replace(/"https:\/\/i\.pravatar\.cc[^"]*"/g, '""');
  content = content.replace(/"https:\/\/stc-zalopay-images\.zg\.vn\/v2\/0\/images\/avatars\/default_avatar\.png"/g, '""');
  content = content.replace(/"https:\/\/zalo-api\.zdn\.vn\/api\/emoticon\/emoticon\/default_avatar\.png"/g, '""');

  // Specific fix for getDefaultAvatar where it's used with user.id, if we want to.
  // Actually, wait. If we just replace the fallback string with "", we might get broken images if there's no getDefaultAvatar wrapper!
  // It's better to NOT run this script. I will cancel this and do it properly with sed/multi_replace.
}
