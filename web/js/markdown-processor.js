// Markdown Processor for Live Interview
// Handles comprehensive markdown parsing while preserving code blocks
import { SchematicsEngine } from './schematics-engine.js';

export class MarkdownProcessor {
    constructor(config = {}) {
        this.config = {
            preserveCodeBlocks: true,
            enableNestedLists: true,
            customBullets: true,
            professionalStyling: true,
            maxNestingLevel: 4,
            enableTables: true,
            enableBlockquotes: true,
            enableLinks: true,
            enableTaskLists: true,
            ...config
        };
        
        // Regex patterns for markdown elements
        // Regex patterns for markdown elements
        this.patterns = {
            // Code blocks (highest priority - must be preserved, supports c++, c#, etc.)
            codeBlock: /(?:```|~~~)([a-zA-Z0-9_+#.-]+)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n?[^\S\r\n]*(?:```|~~~)/g,
            
            // Display math: \[ ... \] and $$ ... $$
            displayMathBracket: /\\\[([\s\S]+?)\\\]/g,
            displayMathDollar: /\$\$([\s\S]+?)\$\$/g,

            // Inline math: \( ... \) and $ ... $
            inlineMathParen: /\\\(([\s\S]+?)\\\)/g,
            inlineMathDollar: /(^|[^\\])\$([^\$\r\n]+?)\$/g,

            // Headers
            header: /^(#{1,6})\s+(.+)$/m,
            
            // Tables - detect table rows (no /g flag to avoid lastIndex state bugs)
            tableRow: /^\|(.+)\|$/m,
            tableSeparator: /^\|[\s]*:?-+:?[\s]*(\|[\s]*:?-+:?[\s]*)*\|$/m,
            
            // Lists
            bulletList: /^(\s*)([-*+])\s+(.+)$/m,
            numberedList: /^(\s*)(\d+\.)\s+(.+)$/m,
            taskList: /^(\s*)([-*+])\s+\[([ xX])\]\s+(.+)$/m,
            
            // Blockquotes
            blockquote: /^>\s*(.+)$/m,
            
            // Horizontal rules (no /g flag to avoid lastIndex state bugs)
            horizontalRule: /^(\*{3,}|-{3,}|_{3,})$/m,
            
            // Inline formatting
            bold: /\*\*([^*]+)\*\*|__([^_]+)__/g,
            italic: /(?:^|[^*])\*([^*]+)\*(?!\*)|(?:^|[^_])_([^_]+)_(?!_)/g,
            strikethrough: /~~(.*?)~~/g,
            inlineCode: /`([^`\r\n]+)`/g,
            links: /\[([^\]]+)\]\(([^)]+)\)/g,
            images: /!\[([^\]]*)\]\(([^)]+)\)/g,
            
            // Line breaks and paragraphs
            doubleLineBreak: /\n\s*\n/g,
            singleLineBreak: /\n/g
        };
        
        // Counter for unique IDs
        this.elementCounter = 0;
    }

    /**
     * Main parsing method - processes raw text into structured content
     * @param {string} text - Raw text content
     * @returns {Array} - Array of content segments for streaming
     */
    parseContent(text) {
        if (!text || typeof text !== 'string') {
            return [{ type: 'text', content: '', html: '' }];
        }

        // Step 1: Extract and protect code blocks
        const { textWithPlaceholders, codeBlocks } = this.extractCodeBlocks(text);
        
        // Step 1b: Neutralize raw HTML in the remaining source BEFORE any markdown
        // substitution. Fenced code blocks were already pulled out above, so their
        // content is untouched here and stays escaped exactly once at render time.
        const escapedText = this.escapeMarkdownSource(textWithPlaceholders);

        // Step 2: Parse block elements (headers, lists, paragraphs, tables, etc.)
        const blockParsed = this.parseBlockElements(escapedText);
        
        // Step 3: Parse inline elements within each block
        const inlineParsed = this.parseInlineElements(blockParsed);
        
        // Step 4: Restore code blocks
        const finalContent = this.restoreCodeBlocks(inlineParsed, codeBlocks);
        
        return finalContent;
    }

    /**
     * Extract code blocks and replace with placeholders
     */
    extractCodeBlocks(text) {
        const codeBlocks = [];
        
        // Reset regex to avoid issues with global flag
        this.patterns.codeBlock.lastIndex = 0;
        
        let textWithPlaceholders = text.replace(this.patterns.codeBlock, (match, language, code) => {
            const rawLang = (language || 'javascript').trim();
            const isSvg = rawLang.toLowerCase() === 'svg' || code.trim().startsWith('<svg');
            const id = `\uE002CODEBLOCK${codeBlocks.length}\uE003`;
            codeBlocks.push({
                id,
                type: isSvg ? 'svg' : 'code',
                language: isSvg ? 'svg' : rawLang,
                content: code.replace(/^\r?\n/, '').replace(/\r?\n$/, ''),
                originalMatch: match
            });
            return `\n\n${id}\n\n`;
        });
        
        // Handle edge case: unclosed code block at end of text (e.g. streaming or truncated output)
        const unclosedFenceMatch = textWithPlaceholders.match(/(?:^|\n)[^\S\r\n]*(?:```|~~~)([a-zA-Z0-9_+#.-]+)?[^\S\r\n]*\r?\n([\s\S]*)$/);
        if (unclosedFenceMatch) {
            const fullMatch = unclosedFenceMatch[0];
            const language = (unclosedFenceMatch[1] || 'javascript').trim();
            const code = unclosedFenceMatch[2];
            const isSvg = language.toLowerCase() === 'svg' || code.trim().startsWith('<svg');
            const id = `\uE002CODEBLOCK${codeBlocks.length}\uE003`;
            codeBlocks.push({
                id,
                type: isSvg ? 'svg' : 'code',
                language: isSvg ? 'svg' : language,
                content: code.replace(/^\r?\n/, '').replace(/\r?\n$/, ''),
                originalMatch: fullMatch
            });
            textWithPlaceholders = textWithPlaceholders.substring(0, textWithPlaceholders.length - fullMatch.length) + `\n\n${id}\n\n`;
        }

        // Extract raw <svg>...</svg> blocks not inside code fences so escapeMarkdownSource does not damage them
        const rawSvgRegex = /<svg[\s\S]*?<\/svg>/gi;
        textWithPlaceholders = textWithPlaceholders.replace(rawSvgRegex, (svgMatch) => {
            const id = `\uE002CODEBLOCK${codeBlocks.length}\uE003`;
            codeBlocks.push({
                id,
                type: 'svg',
                language: 'svg',
                content: svgMatch.trim(),
                originalMatch: svgMatch
            });
            return `\n\n${id}\n\n`;
        });

        return { textWithPlaceholders, codeBlocks };
    }

    /**
     * Parse block-level elements (headers, lists, paragraphs, tables, etc.)
     */
    parseBlockElements(text) {
        const lines = text.split('\n');
        const blocks = [];
        let currentBlock = null;
        let currentList = null;
        let currentTable = null;
        let currentBlockquote = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines between blocks
            if (!trimmedLine) {
                this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote });
                currentBlock = currentList = currentTable = currentBlockquote = null;
                continue;
            }

            // Check for code block placeholders (keep as distinct block)
            const codeBlockMatch = trimmedLine.match(/^(\uE002CODEBLOCK\d+\uE003|__CODE_BLOCK_\d+__)$/);
            if (codeBlockMatch) {
                this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote });
                currentBlock = currentList = currentTable = currentBlockquote = null;
                
                blocks.push({
                    type: 'code_placeholder',
                    id: codeBlockMatch[1]
                });
                continue;
            }
            
            // Check for horizontal rules
            if (this.patterns.horizontalRule.test(trimmedLine)) {
                this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote });
                currentBlock = currentList = currentTable = currentBlockquote = null;
                
                blocks.push({
                    type: 'horizontalRule',
                    id: `hr-${this.elementCounter++}`
                });
                continue;
            }
            
            // Check for headers
            const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote });
                currentBlock = currentList = currentTable = currentBlockquote = null;
                
                blocks.push({
                    type: 'header',
                    level: headerMatch[1].length,
                    content: headerMatch[2].trim(),
                    id: `header-${this.elementCounter++}`
                });
                continue;
            }

            // Check for major interview section headers (even if model prefixed with - / * or omitted ###)
            const sectionHeaderMatch = trimmedLine.match(/^(?:[-*+]\s+)?(?:\*\*)?(?:#{1,6}\s*)?([0-9]\.\s+(?:Problem Clarification|Brute Force|Optimal Solution|Dry Run|Edge Cases|Requirements|Architecture|Complexity)[^*:\r\n]*?)(?:\*\*)?:?$/i);
            if (sectionHeaderMatch) {
                this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote });
                currentBlock = currentList = currentTable = currentBlockquote = null;
                
                blocks.push({
                    type: 'header',
                    level: 3,
                    content: sectionHeaderMatch[1].trim(),
                    id: `header-${this.elementCounter++}`
                });
                continue;
            }
            
            // Check for table rows
            if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                if (currentBlock || currentList || currentBlockquote) {
                    this.endCurrentBlocks(blocks, { currentBlock, currentList, currentBlockquote });
                    currentBlock = currentList = currentBlockquote = null;
                }
                
                // Check if this is a table separator
                const isSeparator = this.patterns.tableSeparator.test(trimmedLine);
                
                if (!currentTable) {
                    currentTable = {
                        type: 'table',
                        headers: [],
                        rows: [],
                        alignments: [],
                        id: `table-${this.elementCounter++}`
                    };
                }
                
                if (isSeparator) {
                    // Parse alignment from separator
                    const cells = trimmedLine.split('|').slice(1, -1);
                    currentTable.alignments = cells.map(cell => {
                        const trimmed = cell.trim();
                        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
                        if (trimmed.endsWith(':')) return 'right';
                        return 'left';
                    });
                } else {
                    // Parse table row
                    const cells = trimmedLine.split('|').slice(1, -1).map(cell => cell.trim());
                    
                    if (currentTable.headers.length === 0 && currentTable.rows.length === 0) {
                        currentTable.headers = cells;
                    } else {
                        currentTable.rows.push(cells);
                    }
                }
                continue;
            } else if (currentTable) {
                // End table if we hit a non-table line
                blocks.push(currentTable);
                currentTable = null;
            }
            
            // Check for blockquotes
            const blockquoteMatch = trimmedLine.match(/^>\s*(.+)$/);
            if (blockquoteMatch) {
                if (currentBlock || currentList || currentTable) {
                    this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable });
                    currentBlock = currentList = currentTable = null;
                }
                
                if (!currentBlockquote) {
                    currentBlockquote = {
                        type: 'blockquote',
                        content: blockquoteMatch[1],
                        id: `blockquote-${this.elementCounter++}`
                    };
                } else {
                    currentBlockquote.content += ' ' + blockquoteMatch[1];
                }
                continue;
            } else if (currentBlockquote) {
                blocks.push(currentBlockquote);
                currentBlockquote = null;
            }
            
            // Check for task lists
            const taskMatch = line.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.+)$/);
            if (taskMatch) {
                const indent = taskMatch[1].length;
                const checked = taskMatch[3].toLowerCase() === 'x';
                const content = taskMatch[4];
                
                if (currentBlock || currentTable || currentBlockquote) {
                    this.endCurrentBlocks(blocks, { currentBlock, currentTable, currentBlockquote });
                    currentBlock = currentTable = currentBlockquote = null;
                }
                
                if (!currentList || currentList.listType !== 'task') {
                    if (currentList) blocks.push(currentList);
                    currentList = {
                        type: 'list',
                        listType: 'task',
                        items: [],
                        id: `list-${this.elementCounter++}`
                    };
                }
                
                currentList.items.push({
                    content: content,
                    checked: checked,
                    indent: Math.floor(indent / 2),
                    id: `item-${this.elementCounter++}`
                });
                continue;
            }
            
            // Check for bullet lists
            const bulletMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
            if (bulletMatch) {
                const indent = bulletMatch[1].length;
                const content = bulletMatch[3];
                
                if (currentBlock || currentTable || currentBlockquote) {
                    this.endCurrentBlocks(blocks, { currentBlock, currentTable, currentBlockquote });
                    currentBlock = currentTable = currentBlockquote = null;
                }
                
                if (!currentList || currentList.listType !== 'bullet') {
                    if (currentList) blocks.push(currentList);
                    currentList = {
                        type: 'list',
                        listType: 'bullet',
                        items: [],
                        id: `list-${this.elementCounter++}`
                    };
                }
                
                currentList.items.push({
                    content: content,
                    indent: Math.floor(indent / 2),
                    id: `item-${this.elementCounter++}`
                });
                continue;
            }
            
            // Check for numbered lists
            const numberedMatch = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
            if (numberedMatch) {
                const indent = numberedMatch[1].length;
                const content = numberedMatch[3];
                
                if (currentBlock || currentTable || currentBlockquote) {
                    this.endCurrentBlocks(blocks, { currentBlock, currentTable, currentBlockquote });
                    currentBlock = currentTable = currentBlockquote = null;
                }
                
                if (!currentList || currentList.listType !== 'numbered') {
                    if (currentList) blocks.push(currentList);
                    currentList = {
                        type: 'list',
                        listType: 'numbered',
                        items: [],
                        id: `list-${this.elementCounter++}`
                    };
                }
                
                currentList.items.push({
                    content: content,
                    indent: Math.floor(indent / 2),
                    id: `item-${this.elementCounter++}`
                });
                continue;
            }
            
            // Regular text - add to current paragraph or create new one
            if (currentList || currentTable || currentBlockquote) {
                this.endCurrentBlocks(blocks, { currentList, currentTable, currentBlockquote });
                currentList = currentTable = currentBlockquote = null;
            }
            
            if (!currentBlock || currentBlock.type !== 'paragraph') {
                currentBlock = {
                    type: 'paragraph',
                    content: trimmedLine,
                    id: `paragraph-${this.elementCounter++}`
                };
            } else {
                currentBlock.content += ' ' + trimmedLine;
            }
        }
        
        // Add remaining blocks
        this.endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote });
        
        return blocks;
    }

    /**
     * Helper method to end current blocks and add them to the blocks array
     */
    endCurrentBlocks(blocks, { currentBlock, currentList, currentTable, currentBlockquote }) {
        if (currentBlock) blocks.push(currentBlock);
        if (currentList) blocks.push(currentList);
        if (currentTable) blocks.push(currentTable);
        if (currentBlockquote) blocks.push(currentBlockquote);
    }

    /**
     * Parse inline elements (bold, italic, code, links, etc.)
     */
    parseInlineElements(blocks) {
        return blocks.map(block => {
            if (block.type === 'list') {
                // Process each list item
                block.items = block.items.map(item => ({
                    ...item,
                    content: this.processInlineFormatting(item.content)
                }));
            } else if (block.type === 'table') {
                // Process table headers and cells
                block.headers = block.headers.map(header => this.processInlineFormatting(header));
                block.rows = block.rows.map(row => 
                    row.map(cell => this.processInlineFormatting(cell))
                );
            } else if (block.content) {
                block.content = this.processInlineFormatting(block.content);
            }
            return block;
        });
    }

    /**
     * Process inline formatting for a text string
     */
    processInlineFormatting(text) {
        if (!text) return text;
        
        // Process in order of precedence
        // 1. Images (before links)
        text = text.replace(this.patterns.images, (match, alt, src) => {
            return `<img class="markdown-image" src="${src}" alt="${alt}" />`;
        });
        
        // 2. Links
        text = text.replace(this.patterns.links, (match, linkText, url) => {
            return `<a class="markdown-link" href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
        });
        
        // 3. Inline code (highest priority for text formatting - don't format inside)
        // Uses Unicode private-use token (\uE000...\uE001) to guarantee zero collisions with markdown bold/italic underscores
        const codeSegments = [];
        let processedText = text.replace(this.patterns.inlineCode, (match, code) => {
            const id = `\uE000INLINECODE${codeSegments.length}\uE001`;
            codeSegments.push({
                id,
                content: code,
                html: `<code class="inline-code">${code}</code>`
            });
            return id;
        });

        // 4. Mathematical equations (Display math & Inline math)
        // Rendered via KaTeX (with clean Unicode/ASCII fallback) and protected with \uE004MATHn\uE005
        // tokens so markdown bold/italic (especially subscripts like V_{no-load}) never corrupt formulas.
        const mathSegments = [];
        const protectMath = (latex, isBlock) => {
            const id = `\uE004MATH${mathSegments.length}\uE005`;
            const html = this.renderMath(latex, isBlock);
            mathSegments.push({ id, html });
            return id;
        };

        // Display math: \[ ... \] and $$ ... $$
        processedText = processedText.replace(this.patterns.displayMathBracket, (match, mathContent) => {
            return `\n${protectMath(mathContent, true)}\n`;
        });
        processedText = processedText.replace(this.patterns.displayMathDollar, (match, mathContent) => {
            return `\n${protectMath(mathContent, true)}\n`;
        });

        // Inline math: \( ... \) and $ ... $
        processedText = processedText.replace(this.patterns.inlineMathParen, (match, mathContent) => {
            return protectMath(mathContent, false);
        });
        processedText = processedText.replace(this.patterns.inlineMathDollar, (match, prefix, mathContent) => {
            // Avoid capturing plain currency amounts like $10 or $25.50
            if (/^\d+(?:\.\d+)?$/.test(mathContent.trim())) {
                return match;
            }
            return `${prefix}${protectMath(mathContent, false)}`;
        });

        // Common LaTeX arrows and symbols in general text
        processedText = processedText
            .replace(/\\rightarrow\b|\\to\b/g, '→')
            .replace(/\\leftarrow\b/g, '←')
            .replace(/\\Rightarrow\b/g, '⇒')
            .replace(/\\Leftarrow\b/g, '⇐')
            .replace(/\\leftrightarrow\b/g, '↔')
            .replace(/\\le\b|\\leq\b/g, '≤')
            .replace(/\\ge\b|\\geq\b/g, '≥')
            .replace(/\\ne\b|\\neq\b/g, '≠')
            .replace(/\\times\b/g, '×')
            .replace(/\\cdot\b/g, '·')
            .replace(/\\approx\b/g, '≈')
            .replace(/\\pm\b/g, '±')
            .replace(/\\dots\b|\\cdots\b|\\ldots\b/g, '…');

        // 5. Bold text
        processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong class="markdown-bold">$1</strong>');
        processedText = processedText.replace(/__([^_]+)__/g, '<strong class="markdown-bold">$1</strong>');
        
        // 6. Italic text
        processedText = processedText.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em class="markdown-italic">$2</em>');
        processedText = processedText.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em class="markdown-italic">$2</em>');
        
        // 7. Strikethrough
        processedText = processedText.replace(this.patterns.strikethrough, (match, content) => {
            return `<del class="markdown-strikethrough">${content}</del>`;
        });
        
        // 8. Restore math segments
        mathSegments.forEach(segment => {
            processedText = processedText.replaceAll(segment.id, () => segment.html);
        });

        // 9. Restore inline code
        codeSegments.forEach(segment => {
            processedText = processedText.replaceAll(segment.id, () => segment.html);
        });
        
        return processedText;
    }

    /**
     * Restore code blocks in final content
     */
    restoreCodeBlocks(blocks, codeBlocks) {
        const codeBlockMap = {};
        codeBlocks.forEach(block => {
            codeBlockMap[block.id] = block;
        });
        
        const finalBlocks = [];
        const codeBlockRegex = /(\uE002CODEBLOCK\d+\uE003|__CODE_BLOCK_\d+__)/g;
        const codeBlockExactRegex = /^(\uE002CODEBLOCK\d+\uE003|__CODE_BLOCK_\d+__)$/;
        
        blocks.forEach(block => {
            if (block.type === 'code_placeholder') {
                const codeBlock = codeBlockMap[block.id];
                if (codeBlock) {
                    finalBlocks.push(codeBlock);
                }
            } else if (block.type === 'paragraph' && block.content && (block.content.includes('\uE002CODEBLOCK') || block.content.includes('__CODE_BLOCK_'))) {
                // Split paragraph by code block placeholders
                const parts = block.content.split(codeBlockRegex);
                
                parts.forEach(part => {
                    if (part.match(codeBlockExactRegex)) {
                        const codeBlock = codeBlockMap[part];
                        if (codeBlock) {
                            finalBlocks.push(codeBlock);
                        }
                    } else if (part.trim()) {
                        finalBlocks.push({
                            type: 'paragraph',
                            content: part.trim(),
                            id: `paragraph-${this.elementCounter++}`
                        });
                    }
                });
            } else if (block.type === 'table' && block.headers) {
                // Process table headers and cells for code blocks
                const processedHeaders = block.headers.map(header => {
                    if (header && (header.includes('\uE002CODEBLOCK') || header.includes('__CODE_BLOCK_'))) {
                        // For table cells, we'll inline the code
                        return header.replace(codeBlockRegex, (match) => {
                            const codeBlock = codeBlockMap[match];
                            return codeBlock ? `<code>${this.escapeHtml(codeBlock.content)}</code>` : match;
                        });
                    }
                    return header;
                });
                
                const processedRows = block.rows.map(row => 
                    row.map(cell => {
                        if (cell && (cell.includes('\uE002CODEBLOCK') || cell.includes('__CODE_BLOCK_'))) {
                            return cell.replace(codeBlockRegex, (match) => {
                                const codeBlock = codeBlockMap[match];
                                return codeBlock ? `<code>${this.escapeHtml(codeBlock.content)}</code>` : match;
                            });
                        }
                        return cell;
                    })
                );
                
                finalBlocks.push({
                    ...block,
                    headers: processedHeaders,
                    rows: processedRows
                });
            } else if (block.content && (block.content.includes('\uE002CODEBLOCK') || block.content.includes('__CODE_BLOCK_'))) {
                // Process other block types that might contain code blocks
                const processedContent = block.content.replace(codeBlockRegex, (match) => {
                    const codeBlock = codeBlockMap[match];
                    return codeBlock ? `<code>${this.escapeHtml(codeBlock.content)}</code>` : match;
                });
                
                finalBlocks.push({
                    ...block,
                    content: processedContent
                });
            } else {
                finalBlocks.push(block);
            }
        });
        
        return finalBlocks;
    }

    /**
     * Generate HTML for a content block
     */
    generateHTML(block) {
        switch (block.type) {
            case 'header':
                return this.generateHeaderHTML(block);
            case 'list':
                return this.generateListHTML(block);
            case 'paragraph':
                return this.generateParagraphHTML(block);
            case 'svg':
                return this.generateSvgDiagramHTML(block);
            case 'code':
                if ((block.language || '').toLowerCase().trim() === 'svg' || (block.content && block.content.trim().startsWith('<svg'))) {
                    return this.generateSvgDiagramHTML(block);
                }
                return this.generateCodeHTML(block);
            case 'table':
                return this.generateTableHTML(block);
            case 'blockquote':
                return this.generateBlockquoteHTML(block);
            case 'horizontalRule':
                return this.generateHorizontalRuleHTML(block);
            default:
                return `<div class="unknown-block">${this.escapeHtml(block.content || '')}</div>`;
        }
    }

    generateHeaderHTML(block) {
        const level = Math.min(Math.max(block.level, 1), 6);
        const className = `markdown-header markdown-h${level}`;
        return `<h${level} class="${className}" id="${block.id}">${block.content}</h${level}>`;
    }

    generateListHTML(block) {
        if (block.listType === 'task') {
            return this.generateTaskListHTML(block);
        }
        
        const tag = block.listType === 'numbered' ? 'ol' : 'ul';
        const className = `markdown-list markdown-${block.listType}-list`;
        
        let html = `<${tag} class="${className}">`;
        
        block.items.forEach(item => {
            const indentClass = item.indent > 0 ? ` indent-${Math.min(item.indent, this.config.maxNestingLevel)}` : '';
            html += `<li class="markdown-list-item${indentClass}">${item.content}</li>`;
        });
        
        html += `</${tag}>`;
        return html;
    }

    generateTaskListHTML(block) {
        const className = 'markdown-list markdown-task-list';
        
        let html = `<ul class="${className}">`;
        
        block.items.forEach(item => {
            const indentClass = item.indent > 0 ? ` indent-${Math.min(item.indent, this.config.maxNestingLevel)}` : '';
            const checkedAttr = item.checked ? ' checked' : '';
            const checkedClass = item.checked ? ' task-checked' : ' task-unchecked';
            
            html += `<li class="markdown-task-item${indentClass}${checkedClass}">`;
            html += `<input type="checkbox" class="task-checkbox" disabled${checkedAttr}>`;
            html += `<span class="task-content">${item.content}</span>`;
            html += `</li>`;
        });
        
        html += `</ul>`;
        return html;
    }

    generateTableHTML(block) {
        if (!block.headers || block.headers.length === 0) {
            return '';
        }
        
        const className = 'markdown-table';
        let html = `<div class="table-wrapper"><table class="${className}">`;
        
        // Generate table header
        html += '<thead><tr>';
        block.headers.forEach((header, index) => {
            const alignment = block.alignments[index] || 'left';
            const alignClass = alignment !== 'left' ? ` text-${alignment}` : '';
            html += `<th class="table-header${alignClass}">${header}</th>`;
        });
        html += '</tr></thead>';
        
        // Generate table body
        if (block.rows && block.rows.length > 0) {
            html += '<tbody>';
            block.rows.forEach(row => {
                html += '<tr>';
                row.forEach((cell, index) => {
                    const alignment = block.alignments[index] || 'left';
                    const alignClass = alignment !== 'left' ? ` text-${alignment}` : '';
                    html += `<td class="table-cell${alignClass}">${cell}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody>';
        }
        
        html += '</table></div>';
        return html;
    }

    generateBlockquoteHTML(block) {
        const className = 'markdown-blockquote';
        return `<blockquote class="${className}">${block.content}</blockquote>`;
    }

    generateHorizontalRuleHTML(block) {
        const className = 'markdown-hr';
        return `<hr class="${className}" />`;
    }

    generateParagraphHTML(block) {
        if (!block.content || !block.content.trim()) {
            return '';
        }
        return `<p class="markdown-paragraph">${block.content}</p>`;
    }

    normalizeLanguage(lang) {
        if (!lang) return 'text';
        const l = lang.toLowerCase().trim();
        const map = {
            'c++': 'cpp',
            'c#': 'csharp',
            'cs': 'csharp',
            'f#': 'fsharp',
            'py': 'python',
            'js': 'javascript',
            'ts': 'typescript',
            'sh': 'bash',
            'shell': 'bash',
            'zsh': 'bash',
            'yml': 'yaml',
            'golang': 'go',
            'rb': 'ruby',
            'rs': 'rust',
            'md': 'markdown'
        };
        return map[l] || l;
    }

    generateCodeHTML(block) {
        const rawLang = (block.language || 'text').trim();
        if (rawLang.toLowerCase() === 'svg' || (block.content && block.content.trim().startsWith('<svg'))) {
            return this.generateSvgDiagramHTML(block);
        }
        const normLang = this.normalizeLanguage(rawLang);
        const escapedCode = this.escapeHtml(block.content || '');
        const cleanIdSuffix = block.id ? block.id.replace(/[^\w-]/g, '').toLowerCase() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const blockId = cleanIdSuffix.startsWith('code-block-') ? cleanIdSuffix : `code-block-${cleanIdSuffix}`;

        return `<div class="code-block-container" data-block-id="${blockId}">` +
            `<div class="code-block-header">` +
                `<span class="code-language">${this.escapeHtml(rawLang)}</span>` +
                `<button class="copy-button" type="button" title="Copy code">📋</button>` +
            `</div>` +
            `<pre class="code-block language-${normLang}"><code class="language-${normLang}">${escapedCode}</code></pre>` +
        `</div>`;
    }

    /**
     * Generate visual SVG diagram component for schematic/circuit visualization
     */
    generateSvgDiagramHTML(block) {
        let rawSvg = (block.content || '').trim();
        // If content is wrapped in html tags or contains markdown markers, extract the <svg ... </svg> tag
        const svgMatch = rawSvg.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatch) {
            rawSvg = svgMatch[0];
        }

        // Adjust stroke and text colors: Convert dark/black strokes and text to high-contrast colors for transparent dark HUD
        let cleanSvg = rawSvg
            .replace(/stroke\s*:\s*(?:#000(?:000)?|black|rgb\(0,\s*0,\s*0\)|#111|#222)/gi, 'stroke: #38bdf8')
            .replace(/stroke\s*=\s*["'](?:#000(?:000)?|black|rgb\(0,\s*0,\s*0\)|#111|#222)["']/gi, 'stroke="#38bdf8"')
            .replace(/fill\s*:\s*(?:#000(?:000)?|black|rgb\(0,\s*0,\s*0\)|#111|#222)/gi, 'fill: #f8fafc')
            .replace(/fill\s*=\s*["'](?:#000(?:000)?|black|rgb\(0,\s*0,\s*0\)|#111|#222)["']/gi, 'fill="#f8fafc"');

        // Ensure SVG has responsive scaling attributes
        if (!cleanSvg.includes('viewBox') && cleanSvg.includes('width=') && cleanSvg.includes('height=')) {
            const wMatch = cleanSvg.match(/width=["'](\d+)["']/);
            const hMatch = cleanSvg.match(/height=["'](\d+)["']/);
            if (wMatch && hMatch) {
                cleanSvg = cleanSvg.replace(/<svg\b/i, `<svg viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`);
            }
        }

        // Check if this SVG matches a recognized electrical machine / transformer circuit
        const detectedCircuit = SchematicsEngine.detectCircuitType(rawSvg);
        const textbookSvg = detectedCircuit ? SchematicsEngine.getCircuitSVG(detectedCircuit) : null;

        const cleanIdSuffix = block.id ? block.id.replace(/[^\w-]/g, '').toLowerCase() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const blockId = cleanIdSuffix.startsWith('svg-block-') ? cleanIdSuffix : `svg-block-${cleanIdSuffix}`;
        const escapedCode = this.escapeHtml(rawSvg);

        if (textbookSvg) {
            const formattedName = detectedCircuit.replace(/-/g, ' ').toUpperCase();
            return `<div class="ee-svg-diagram-container" data-block-id="${blockId}">` +
                `<div class="ee-svg-diagram-header">` +
                    `<div class="ee-diagram-title">` +
                        `<span class="ee-diagram-icon">⚡</span>` +
                        `<span>${this.escapeHtml(formattedName)} (Textbook Vector Accuracy)</span>` +
                    `</div>` +
                    `<div class="ee-diagram-actions">` +
                        `<button class="svg-view-tab-btn active" data-view="textbook" type="button" title="Textbook Schematic">⚡ Schematic</button>` +
                        `<button class="svg-view-tab-btn" data-view="ai" type="button" title="View AI Generated SVG">🤖 AI Raw</button>` +
                        `<button class="svg-toggle-btn" type="button" title="View SVG Code">🔍 Code</button>` +
                        `<button class="svg-copy-btn" type="button" title="Copy SVG Code">📋 Copy</button>` +
                    `</div>` +
                `</div>` +
                `<div class="ee-svg-viewport ee-view-textbook">` +
                    textbookSvg +
                `</div>` +
                `<div class="ee-svg-viewport ee-view-ai" style="display: none;">` +
                    cleanSvg +
                `</div>` +
                `<div class="ee-svg-code-view" style="display: none;">` +
                    `<pre class="code-block language-markup"><code class="language-markup">${escapedCode}</code></pre>` +
                `</div>` +
            `</div>`;
        }

        return `<div class="ee-svg-diagram-container" data-block-id="${blockId}">` +
            `<div class="ee-svg-diagram-header">` +
                `<div class="ee-diagram-title">` +
                    `<span class="ee-diagram-icon">⚡</span>` +
                    `<span>Schematic / Single-Line Diagram</span>` +
                `</div>` +
                `<div class="ee-diagram-actions">` +
                    `<button class="svg-toggle-btn" type="button" title="View SVG Code">🔍 Code</button>` +
                    `<button class="svg-copy-btn" type="button" title="Copy SVG Code">📋 Copy</button>` +
                `</div>` +
            `</div>` +
            `<div class="ee-svg-viewport">` +
                cleanSvg +
            `</div>` +
            `<div class="ee-svg-code-view" style="display: none;">` +
                `<pre class="code-block language-markup"><code class="language-markup">${escapedCode}</code></pre>` +
            `</div>` +
        `</div>`;
    }

    /**
     * Render LaTeX mathematical expressions using KaTeX with robust Unicode fallback
     */
    renderMath(latex, isBlock = false) {
        if (!latex) return '';
        // Unescape entities that may have been created earlier
        let raw = String(latex).trim()
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');

        // Clean double backslashes
        raw = raw.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

        // 1. Try KaTeX first if available in the browser window
        if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
            try {
                return window.katex.renderToString(raw, {
                    displayMode: isBlock,
                    throwOnError: false
                });
            } catch (e) {
                console.warn('KaTeX rendering error:', e);
            }
        }

        // 2. High-quality Unicode / readable formula fallback (removes raw backslashes and LaTeX macros)
        let clean = raw;
        // Flatten inner text, math macros, and sub/sup braces first so \frac matches cleanly
        for (let pass = 0; pass < 3; pass++) {
            clean = clean
                .replace(/\\text\{([^}]*)\}/g, '$1')
                .replace(/\\mathrm\{([^}]*)\}/g, '$1')
                .replace(/\\mathbf\{([^}]*)\}/g, '$1')
                .replace(/_\{([^}]+)\}/g, '_$1')
                .replace(/\^\{([^}]+)\}/g, '^$1');
        }

        clean = clean
            .replace(/\\left\(/g, '(')
            .replace(/\\right\)/g, ')')
            .replace(/\\left\[/g, '[')
            .replace(/\\right\]/g, ']')
            .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
            .replace(/\\sqrt\[3\]\{([^{}]+)\}/g, '∛($1)')
            .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
            .replace(/\\sqrt/g, '√')
            .replace(/\\cdot/g, ' · ')
            .replace(/\\times/g, ' × ')
            .replace(/\\pm/g, '±')
            .replace(/\\approx/g, '≈')
            .replace(/\\neq/g, '≠')
            .replace(/\\leq?/g, '≤')
            .replace(/\\geq?/g, '≥')
            .replace(/\\phi/gi, 'φ')
            .replace(/\\theta/gi, 'θ')
            .replace(/\\omega/gi, 'ω')
            .replace(/\\pi/gi, 'π')
            .replace(/\\eta/gi, 'η')
            .replace(/\\Delta/g, 'Δ')
            .replace(/\\Omega/g, 'Ω')
            .replace(/\\mu/g, 'μ')
            .replace(/\\quad/g, ' ')
            .replace(/\\qquad/g, '  ')
            .replace(/\\([a-zA-Z]+)/g, '$1')
            .replace(/\{([^{}]+)\}/g, '$1')
            .replace(/\\%/g, '%')
            .replace(/\\/g, '')
            .trim();

        if (isBlock) {
            return `<div class="display-math"><code class="math-code">${this.escapeHtml(clean)}</code></div>`;
        } else {
            return `<span class="inline-math"><code class="math-code">${this.escapeHtml(clean)}</code></span>`;
        }
    }

    /**
     * Escape raw HTML in markdown SOURCE text, before any markdown pattern
     * substitution runs.
     *
     * Deliberately does NOT escape '>': blockquote detection in
     * parseBlockElements matches /^>\s*(.+)$/ on this string, and a literal '>'
     * cannot open a tag once '<' is escaped. Deliberately does NOT escape "'"
     * either: every attribute emitted by this class is wrapped in double quotes
     * (which ARE escaped), and leaving "'" alone avoids injecting '$&' sequences
     * into text that later passes through String.prototype.replace.
     */
    escapeMarkdownSource(text) {
        if (!text || typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Utility method to escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}