
import * as fs from "fs";
import { escape } from "html-escaper";
import dateFormat from "dateformat";

const constantMap = {
    timestamp: dateFormat(new Date(), "h:MM TT (Z), mmmm dS, yyyy"),
};

class Node {
    // Concrete subclasses of Node must implement these methods:
    // toHtml
    
}

class Row extends Node {
    
    constructor(text) {
        super();
        this.text = text;
    }
    
    toHtml() {
        return `<div>${replaceLineElements(this.text)}</div>`;
    }
}

class Group extends Node {
    
    constructor(lines) {
        super();
        this.lines = lines;
    }
}

class Div extends Group {
    
    constructor(lines) {
        super(lines)
        this.children = parseDivGroups(this.lines);
    }
    
    getChildrenHtml() {
        return this.children.map((child) => child.toHtml()).join("\n");
    }
}

class Paragraph extends Div {
    
    toHtml() {
        return `<div style="margin-bottom: 15px;">
${this.getChildrenHtml()}
</div>`;
    }
}

class Block extends Div {
    
    constructor(lines) {
        super(lines)
        this.children = parseGroups(this.lines);
    }
    
    toHtml() {
        return `<div style="margin-left: 30px;">
${this.getChildrenHtml()}
</div>`;
    }
}

class List extends Group {
    
    toHtml() {
        const content = this.lines.map((line) => `<li>${replaceLineElements(line)}</li>`)
            .join("\n");
        return `<ul>
${content}
</ul>`;
    }
}

const replaceElements = (text, startIndex = 0) => {
    const htmlList = [];
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
                elementHtml = `<span class="${prefix}">${result.html}</span>`;
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
            const fragmentHtml = escape(text.substring(fragmentStartIndex, fragmentEndIndex));
            htmlList.push(fragmentHtml);
        }
        if (elementHtml !== null) {
            htmlList.push(elementHtml);
        }
        index = nextIndex;
    }
    return { html: htmlList.join(""), index };
};

const replaceLineElements = (line) => {
    try {
        const { html, index } = replaceElements(line);
        if (index < line.length) {
            throw new Error("Line contains unmatched brace");
        }
        return html;
    } catch (error) {
        throw new Error(error.message + ": " + line);
    }
};

const parseDivGroups = (lines) => {
    // TODO: Implement.
    return lines.map((line) => new Row(line));
};

const parseParagraphs = (lines) => {
    const output = [];
    let paragraphLines = [];
    let index = 0;
    while (true) {
        const hasReachedEnd = (index >= lines.length);
        const line = hasReachedEnd ? "" : lines[index];
        if (line.length > 0) {
            paragraphLines.push(line);
        } else if (paragraphLines.length > 0) {
            const paragraph = new Paragraph(paragraphLines);
            output.push(paragraph);
            paragraphLines = [];
        }
        if (hasReachedEnd) {
            break;
        }
        index += 1;
    }
    return output;
};

console.log("Creating documentation page...");

const descriptionLines = fs.readFileSync("./description.txt", "utf8").split("\n")
const descriptionParagraphs = parseParagraphs(descriptionLines);
const descriptionHtml = descriptionParagraphs.map((paragraph) => paragraph.toHtml())
    .join("\n");

const cssContent = fs.readFileSync("./documentation.css", "utf8");

const documentationContent = `<html>
    <head>
        <meta charset="UTF-8">
        <style>
${cssContent}
        </style>
    </head>
    <body>
${descriptionHtml}
    </body>
</html>
`;

fs.writeFileSync("./documentation.html", documentationContent);

console.log("Finished.");


