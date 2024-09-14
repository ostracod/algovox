
import * as fs from "fs";
import { escape } from "html-escaper";

const replaceElements = (text, startIndex = 0) => {
    const resultTextList = [];
    let startBraceIndex;
    let closeBraceIndex;
    let hasCloseBrace;
    let nextIndex;
    const replaceNestedElements = () => {
        const result = replaceElements(text, startBraceIndex + 1);
        const contentEndIndex = result.index;
        if (text.charAt(contentEndIndex) !== "}") {
            throw new Error("Missing close brace");
        }
        nextIndex = contentEndIndex + 1;
        return result.text;
    };
    const readPlainContent = () => {
        if (!hasCloseBrace) {
            throw new Error("Missing close brace");
        }
        const content = text.substring(startBraceIndex + 1, closeBraceIndex);
        nextIndex = closeBraceIndex + 1
        return content;
    };
    let index = startIndex;
    let hasReachedEnd = false;
    while (!hasReachedEnd) {
        const closeParenIndex = text.indexOf("){", index);
        closeBraceIndex = text.indexOf("}", index);
        hasCloseBrace = (closeBraceIndex >= 0);
        const fragmentStartIndex = index;
        let fragmentEndIndex;
        let element;
        if (closeParenIndex >= 0 && (!hasCloseBrace || closeBraceIndex > closeParenIndex)) {
            startBraceIndex = closeParenIndex + 1;
            const openParenIndex = text.lastIndexOf("(", closeParenIndex);
            if (openParenIndex < startIndex) {
                throw new Error("Text contains malformed element");
            }
            fragmentEndIndex = openParenIndex;
            const prefix = text.substring(openParenIndex + 1, closeParenIndex);
            if (prefix.charAt(0) === "!") {
                const elementType = prefix.substring(1);
                if (elementType === "link") {
                    const url = readPlainContent();
                    element = `<a href="${url}">${url}</a>`;
                } else {
                    // TODO: Handle more element types.
                    // TODO: Throw an error for unrecognized element types.
                    element = replaceNestedElements();
                }
            } else {
                const content = replaceNestedElements();
                element = `<span class="${prefix}">${content}</span>`;
            }
        } else {
            if (hasCloseBrace) {
                fragmentEndIndex = closeBraceIndex;
            } else {
                fragmentEndIndex = text.length;
            }
            nextIndex = fragmentEndIndex;
            element = null;
            hasReachedEnd = true;
        }
        if (fragmentEndIndex > fragmentStartIndex) {
            const fragment = escape(text.substring(fragmentStartIndex, fragmentEndIndex));
            resultTextList.push(fragment);
        }
        if (element !== null) {
            resultTextList.push(element);
        }
        index = nextIndex;
    }
    return { text: resultTextList.join(""), index };
};

const replaceLineElements = (line) => {
    try {
        const { text, index } = replaceElements(line);
        if (index < line.length) {
            throw new Error("Line contains unmatched brace");
        }
        return text;
    } catch (error) {
        throw new Error(error.message + ": " + line);
    }
};

console.log("Creating documentation page...");

const descriptionContent = fs.readFileSync("./description.txt", "utf8")
    .split("\n")
    .map((line) => replaceLineElements(line))
    .join("<br />\n");

const cssContent = fs.readFileSync("./documentation.css", "utf8");

const documentationContent = `<html>
    <head>
        <meta charset="UTF-8">
        <style>
${cssContent}
        </style>
    </head>
    <body>
${descriptionContent}
    </body>
</html>
`;

fs.writeFileSync("./documentation.html", documentationContent);

console.log("Finished.");


