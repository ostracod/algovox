
import * as fs from "fs";
import { escape } from "html-escaper";
import dateFormat from "dateformat";

const constantMap = {
    timestamp: dateFormat(new Date(), "h:MM TT (Z), mmmm dS, yyyy"),
};

const replaceElements = (text, startIndex = 0) => {
    const resultTextList = [];
    let index = startIndex;
    let hasReachedEnd = false;
    while (!hasReachedEnd) {
        const closeParenIndex = text.indexOf("){", index);
        const closeBraceIndex = text.indexOf("}", index);
        const hasCloseBrace = (closeBraceIndex >= 0);
        const fragmentStartIndex = index;
        let fragmentEndIndex;
        let elementHtml;
        let nextIndex;
        if (closeParenIndex >= 0 && (!hasCloseBrace || closeBraceIndex > closeParenIndex)) {
            const startBraceIndex = closeParenIndex + 1;
            const openParenIndex = text.lastIndexOf("(", closeParenIndex);
            if (openParenIndex < startIndex) {
                throw new Error("Text contains malformed element");
            }
            fragmentEndIndex = openParenIndex;
            const prefix = text.substring(openParenIndex + 1, closeParenIndex);
            if (prefix.charAt(0) === "!") {
                if (!hasCloseBrace) {
                    throw new Error("Missing close brace");
                }
                const content = text.substring(startBraceIndex + 1, closeBraceIndex);
                const elementType = prefix.substring(1);
                if (elementType === "link") {
                    elementHtml = `<a href="${content}">${content}</a>`;
                } else if (elementType === "char") {
                    elementHtml = String.fromCharCode(parseInt(content, 16));
                } else if (elementType === "image") {
                    elementHtml = `<img src="${content}" />`;
                } else if (elementType === "const") {
                    elementHtml = constantMap[content];
                    if (typeof elementHtml === "undefined") {
                        throw new Error(`Unknown constant "${content}"`);
                    }
                } else {
                    throw new Error(`Unknown element prefix "${prefix}"`);
                }
                nextIndex = closeBraceIndex + 1
            } else {
                const result = replaceElements(text, startBraceIndex + 1);
                const contentEndIndex = result.index;
                if (text.charAt(contentEndIndex) !== "}") {
                    throw new Error("Missing close brace");
                }
                elementHtml = `<span class="${prefix}">${result.text}</span>`;
                nextIndex = contentEndIndex + 1;
            }
        } else {
            if (hasCloseBrace) {
                fragmentEndIndex = closeBraceIndex;
            } else {
                fragmentEndIndex = text.length;
            }
            nextIndex = fragmentEndIndex;
            elementHtml = null;
            hasReachedEnd = true;
        }
        if (fragmentEndIndex > fragmentStartIndex) {
            const fragment = escape(text.substring(fragmentStartIndex, fragmentEndIndex));
            resultTextList.push(fragment);
        }
        if (elementHtml !== null) {
            resultTextList.push(elementHtml);
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


