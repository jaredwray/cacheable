import * as fs from "fs-extra";

async function main() {

    console.log("packages path:" + getRelativePackagePath());

    await copyPackages();

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