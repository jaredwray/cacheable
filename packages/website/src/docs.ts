import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";

async function main() {

    console.log("packages path:" + getRelativePackagePath());

    await copyPackages();
    await copyGettingStarted();
    await copyCacheableSymbol();
};

async function copyPackages() {
    const packagesPath = getRelativePackagePath();
    const packageList = await readdir(`${packagesPath}`);
    const filterList = ["website", ".DS_Store"];

    for (const packageName of packageList) {
        if((filterList.indexOf(packageName) > -1) !== true ) {
            console.log("Adding package: " + packageName);
            await createDoc(packageName, `${packagesPath}`, `${packagesPath}/website/site/docs`);
        }
    };
}

async function copyCacheableSymbol() {
    const rootPath = getRelativeRootPath();
    const packagesPath = getRelativePackagePath();
    const outputPath = `${packagesPath}/website/dist`;
    await mkdir(`${outputPath}`, { recursive: true });
    await copyFile(`${packagesPath}/website/site/symbol.svg`, `${outputPath}/symbol.svg`);
}

async function copyGettingStarted() {
    console.log("Adding Getting Started");
    const rootPath = getRelativeRootPath();
    const packagesPath = getRelativePackagePath();
    const outputPath = `${packagesPath}/website/site/docs`;
    const originalFileText = await readFile(`${rootPath}/README.md`, "utf8");
    let newFileText = "---\n";
    newFileText += `title: 'Getting Started Guide'\n`;
    newFileText += `order: 1\n`;
    //newFileText += `parent: '${parent}'\n`;
    newFileText += "---\n";
    newFileText += "\n";
    newFileText += originalFileText;

    newFileText = cleanDocumentFromImage(newFileText);

    await mkdir(`${outputPath}`, { recursive: true });
    await writeFile(`${outputPath}/index.md`, newFileText);
}

function cleanDocumentFromImage(document: string) {
    document = document.replace(`[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable">](https://github.com/jaredwray/cacheable)`, "");
    document = document.replace(`[<img align="center" src="https://cacheable.org/symbol.svg" alt="Cacheable">](https://github.com/jaredwray/cacheable)`, "");
    return document;
};

function getRelativePackagePath() {
    if(existsSync("packages")) {
        //we are in the root
        return "packages";
    }

    //we are in the website folder
    return "../../packages"
}

function getRelativeRootPath() {
    if(existsSync("packages")) {
        //we are in the root
        return "./";
    }

    //we are in the website folder
    return "../../"
}

async function createDoc(packageName: string, path: string, outputPath: string) {
    const originalFileName = "README.md";
    const newFileName = `${packageName}.md`;
    const packageJSONPath = `${path}/${packageName}/package.json`;
    const packageJSON = JSON.parse(await readFile(packageJSONPath, "utf8"));
    const originalFileText = await readFile(`${path}/${packageName}/${originalFileName}`, "utf8");
    let newFileText = "---\n";
    newFileText += `title: '${packageJSON.name}'\n`;
    newFileText += `sidebarTitle: '${packageJSON.name}'\n`;
    //newFileText += `parent: '${parent}'\n`;
    newFileText += "---\n";
    newFileText += "\n";
    newFileText += originalFileText;

    newFileText = cleanDocumentFromImage(newFileText);

    await mkdir(`${outputPath}`, { recursive: true });
    await writeFile(`${outputPath}/${newFileName}`, newFileText);
}

main();
