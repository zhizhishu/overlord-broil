import fs from 'fs';
 
console.time('转换耗时');
const distPath = './dist/index.html';
let htmlText = fs.readFileSync(distPath, 'utf8');
const resultText = htmlText
    .replace(/\snomodule(?=[\s>])/g, '')
    .replace(/\scrossorigin(?=[\s>])/g, '')
    .replace(/data-src/g, 'src');
fs.writeFileSync(distPath,resultText,'utf8');
console.timeEnd('转换耗时');
