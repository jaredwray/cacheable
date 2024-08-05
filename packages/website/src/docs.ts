import * as fs from "fs-extra";

async function main() {

    console.log("packages path:" + getRelativePackagePath());

    await copyPackages();
    await copyGettingStarted();

};

async function copyPackages() {
    const packagesPath = getRelativePackagePath();
    const packageList = await fs.readdir(`${packagesPath}`);
    const filterList = ["website", ".DS_Store"];

    for (const packageName of packageList) {
        if((filterList.indexOf(packageName) > -1) !== true ) {
            console.log("Adding package: " + packageName);
            await createDoc(packageName, `${packagesPath}`, `${packagesPath}/website/site/docs/`);
        }
    };
}

async function copyGettingStarted() {
    console.log("Adding Getting Started");
    const rootPath = getRelativeRootPath();
    const packagesPath = getRelativePackagePath();
    const outputPath = `${packagesPath}/website/site/docs/`;
    const originalFileText = await fs.readFile(`${rootPath}/README.md`, "utf8");
    let newFileText = "---\n";
    newFileText += `title: 'Getting Started Guilde'\n`;
    newFileText += `order: 1\n`;
    //newFileText += `parent: '${parent}'\n`;
    newFileText += "---\n";
    newFileText += "\n";
    newFileText += originalFileText;

    newFileText = cleanDocumentFromImage(newFileText);

    await fs.writeFile(`${outputPath}/index.md`, newFileText);
}

function cleanDocumentFromImage(document: string) {
    document = document.replace(`[<img align="center" src="https://jaredwray.com/images/cacheable_white.svg" alt="keyv">](https://github.com/jaredwray/cacheable)`, "");
    return document;
};

function getRelativePackagePath() {
    if(fs.pathExistsSync("packages")) {
        //we are in the root
        return "packages";
    }

    //we are in the website folder
    return "../../packages"
}

function getRelativeRootPath() {
    if(fs.pathExistsSync("packages")) {
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
    const packageJSON = await fs.readJSON(packageJSONPath);
    const originalFileText = await fs.readFile(`${path}/${packageName}/${originalFileName}`, "utf8");
    let newFileText = "---\n";
    newFileText += `title: '${packageJSON.name}'\n`;
    newFileText += `sidebarTitle: '${packageJSON.name}'\n`;
    //newFileText += `parent: '${parent}'\n`;
    newFileText += "---\n";
    newFileText += "\n";
    newFileText += originalFileText;

    newFileText = cleanDocumentFromImage(newFileText);

    await fs.writeFile(`${outputPath}/${newFileName}`, newFileText);
}

main();