const appPath = process.argv[2];
const params = process.argv.slice(3);

if(!appPath) {
  console.error("Please provide a file path.");
  process.exit(1);
}

const fullPath = `./src/app/${ appPath }`;
const appModule = require(fullPath);

if(typeof appModule === "function") {
    appModule(...params);
} else {
    console.error("The specified module does not have a default exported function.");
    process.exit(1);
}