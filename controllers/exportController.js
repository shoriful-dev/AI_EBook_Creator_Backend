const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
  ImageRun,
} = require('docx');
const PDFDocument = require('pdfkit');
const Book = require('../models/Book');
const path = require('path');
const fs = require('fs');
const MarkdownIt = require('markdown-it');

// Initialize Markdown parser
const md = new MarkdownIt();

// Typography configuration for DOCX
const DOCX_STYLES = {
  fonts: {
    body: 'Charter',
    heading: 'Inter',
  },
  sizes: {
    title: 32,
    subtitle: 20,
    author: 18,
    chapterTitle: 24,
    h1: 20,
    h2: 18,
    h3: 16,
    body: 12,
  },
  spacing: {
    paragraphBefore: 200,
    paragraphAfter: 200,
    chapterBefore: 400,
    chapterAfter: 300,
    headingBefore: 300,
    headingAfter: 150,
  },
};

// Typography configuration for PDF (modern ebook style)
const TYPOGRAPHY = {
  fonts: {
    serif: 'Times-Roman',
    serifBold: 'Times-Bold',
    serifItalic: 'Times-Italic',
    sans: 'Helvetica',
    sansBold: 'Helvetica-Bold',
    sansOblique: 'Helvetica-Oblique',
  },
  sizes: {
    title: 28,
    subtitle: 20,
    author: 16,
    chapterTitle: 20,
    h1: 18,
    h2: 16,
    h3: 14,
    body: 11,
    caption: 9,
  },
  spacing: {
    paragraphSpacing: 12,
    chapterSpacing: 24,
    headingSpacing: { before: 16, after: 8 },
    listSpacing: 6,
  },
  colors: {
    text: '#333333',
    heading: '#1A1A1A',
    accent: '#4F46E5',
  },
};

// ========== PDF HELPER FUNCTIONS ==========

const renderInlineTokens = (doc, tokens, options = {}) => {
  if (!tokens || tokens.length === 0) return;

  const baseOptions = {
    align: options.align || 'justify',
    indent: options.indent || 0,
    lineGap: options.lineGap || 2,
  };

  let currentFont = TYPOGRAPHY.fonts.serif;
  let textBuffer = '';

  const flushBuffer = () => {
    if (textBuffer) {
      doc.font(currentFont).text(textBuffer, {
        ...baseOptions,
        continued: true,
      });
      textBuffer = '';
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'text') {
      textBuffer += token.content;
    } else if (token.type === 'strong_open') {
      flushBuffer();
      currentFont = TYPOGRAPHY.fonts.serifBold;
    } else if (token.type === 'strong_close') {
      flushBuffer();
      currentFont = TYPOGRAPHY.fonts.serif;
    } else if (token.type === 'em_open') {
      flushBuffer();
      currentFont = TYPOGRAPHY.fonts.serifItalic;
    } else if (token.type === 'em_close') {
      flushBuffer();
      currentFont = TYPOGRAPHY.fonts.serif;
    } else if (token.type === 'code_inline') {
      flushBuffer();
      doc.font('Courier').text(token.content, {
        ...baseOptions,
        continued: true,
      });
      doc.font(currentFont);
    }
  }

  if (textBuffer) {
    doc.font(currentFont).text(textBuffer, {
      ...baseOptions,
      continued: true,
    });
  } else {
    doc.text('', { continued: false });
  }
};

const renderMarkdown = (doc, markdown) => {
  if (!markdown || markdown.trim() === '') return;

  const tokens = md.parse(markdown, {});
  let isList = false;
  let listType = null;
  let orderedListCounter = 1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.substring(1), 10);
      let fontSize;

      switch (level) {
        case 1:
          fontSize = TYPOGRAPHY.sizes.h1;
          break;
        case 2:
          fontSize = TYPOGRAPHY.sizes.h2;
          break;
        case 3:
          fontSize = TYPOGRAPHY.sizes.h3;
          break;
        default:
          fontSize = TYPOGRAPHY.sizes.body;
      }

      doc.moveDown(
        TYPOGRAPHY.spacing.headingSpacing.before / TYPOGRAPHY.sizes.body,
      );
      doc
        .font(TYPOGRAPHY.fonts.sansBold)
        .fontSize(fontSize)
        .fillColor(TYPOGRAPHY.colors.heading);

      if (i + 1 < tokens.length && tokens[i + 1].type === 'inline') {
        renderInlineTokens(doc, tokens[i + 1].children, {
          align: 'left',
          lineGap: 0,
        });
        i++;
      }

      doc.moveDown(
        TYPOGRAPHY.spacing.headingSpacing.after / TYPOGRAPHY.sizes.body,
      );
      if (i + 1 < tokens.length && tokens[i + 1].type === 'heading_close') {
        i++;
      }
    } else if (token.type === 'paragraph_open') {
      doc
        .font(TYPOGRAPHY.fonts.serif)
        .fontSize(TYPOGRAPHY.sizes.body)
        .fillColor(TYPOGRAPHY.colors.text);

      if (i + 1 < tokens.length && tokens[i + 1].type === 'inline') {
        renderInlineTokens(doc, tokens[i + 1].children, {
          align: 'justify',
          lineGap: 2,
        });
        i++;
      }

      if (!isList) {
        doc.moveDown(
          TYPOGRAPHY.spacing.paragraphSpacing / TYPOGRAPHY.sizes.body,
        );
      }

      if (i + 1 < tokens.length && tokens[i + 1].type === 'paragraph_close') {
        i++;
      }
    } else if (token.type === 'bullet_list_open') {
      isList = true;
      listType = 'bullet';
      doc.moveDown(TYPOGRAPHY.spacing.listSpacing / TYPOGRAPHY.sizes.body);
    } else if (token.type === 'bullet_list_close') {
      isList = false;
      listType = null;
      doc.moveDown(TYPOGRAPHY.spacing.listSpacing / TYPOGRAPHY.sizes.body);
    } else if (token.type === 'ordered_list_open') {
      isList = true;
      listType = 'ordered';
      orderedListCounter = 1;
      doc.moveDown(TYPOGRAPHY.spacing.listSpacing / TYPOGRAPHY.sizes.body);
    } else if (token.type === 'ordered_list_close') {
      isList = false;
      listType = null;
      orderedListCounter = 1;
      doc.moveDown(TYPOGRAPHY.spacing.listSpacing / TYPOGRAPHY.sizes.body);
    } else if (token.type === 'list_item_open') {
      doc
        .font(TYPOGRAPHY.fonts.serif)
        .fontSize(TYPOGRAPHY.sizes.body)
        .fillColor(TYPOGRAPHY.colors.text);

      let bullet = '• ';
      if (listType === 'ordered') {
        bullet = `${orderedListCounter}. `;
        orderedListCounter++;
      }

      doc.text(bullet, {
        continued: true,
        indent: 20,
      });

      if (i + 1 < tokens.length && tokens[i + 1].type === 'paragraph_open') {
        if (i + 2 < tokens.length && tokens[i + 2].type === 'inline') {
          renderInlineTokens(doc, tokens[i + 2].children, {
            align: 'justify',
            indent: 20,
            lineGap: 2,
          });
          i += 2;
        }
      }

      doc.moveDown(TYPOGRAPHY.spacing.listSpacing / TYPOGRAPHY.sizes.body);

      if (i + 1 < tokens.length && tokens[i + 1].type === 'list_item_close') {
        i++;
      }
    } else if (token.type === 'blockquote_open') {
      doc.moveDown(0.5);
      doc
        .font(TYPOGRAPHY.fonts.serifItalic)
        .fontSize(TYPOGRAPHY.sizes.body)
        .fillColor('#666666');

      if (i + 1 < tokens.length && tokens[i + 1].type === 'paragraph_open') {
        if (i + 2 < tokens.length && tokens[i + 2].type === 'inline') {
          renderInlineTokens(doc, tokens[i + 2].children, {
            align: 'justify',
            indent: 30,
            lineGap: 2,
          });
          i += 2;
        }
      }

      doc.moveDown(0.5);

      if (i + 1 < tokens.length && tokens[i + 1].type === 'blockquote_close') {
        i++;
      }
    } else if (token.type === 'code_block' || token.type === 'fence') {
      doc.moveDown(0.5);
      doc
        .font('Courier')
        .fontSize(TYPOGRAPHY.sizes.body - 1)
        .fillColor('#333333')
        .text(token.content, {
          indent: 20,
          align: 'left',
        });
      doc.moveDown(0.5);
    } else if (token.type === 'hr') {
      doc.moveDown(0.5);
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke('#CCCCCC');
      doc.moveDown(0.5);
    }
  }
};

// ========== DOCX HELPER FUNCTIONS ==========

const processInlineContent = children => {
  const textRuns = [];
  let currentFormatting = { bold: false, italic: false };
  let textBuffer = '';

  const flushText = () => {
    if (textBuffer.trim()) {
      textRuns.push(
        new TextRun({
          text: textBuffer,
          bold: currentFormatting.bold,
          italic: currentFormatting.italic,
          size: DOCX_STYLES.sizes.body * 2,
          font: DOCX_STYLES.fonts.body,
        }),
      );
      textBuffer = '';
    }
  };

  children.forEach(child => {
    if (child.type === 'strong_open') {
      flushText();
      currentFormatting.bold = true;
    } else if (child.type === 'strong_close') {
      flushText();
      currentFormatting.bold = false;
    } else if (child.type === 'em_open') {
      flushText();
      currentFormatting.italic = true;
    } else if (child.type === 'em_close') {
      flushText();
      currentFormatting.italic = false;
    } else if (child.type === 'text') {
      textBuffer += child.content;
    } else if (child.type === 'code_inline') {
      flushText();
      textRuns.push(
        new TextRun({
          text: child.content,
          font: 'Courier New',
          size: DOCX_STYLES.sizes.body * 2,
          shading: {
            fill: 'F5F5F5',
          },
        }),
      );
    }
  });

  flushText();
  return textRuns;
};

const processMarkdownToDocx = markdown => {
  const tokens = md.parse(markdown, {});
  const paragraphs = [];
  let inList = false;
  let listType = null;
  let orderedCounter = 1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    try {
      if (token.type === 'heading_open') {
        const level = parseInt(token.tag.slice(1), 10);
        const nextToken = tokens[i + 1];

        if (nextToken && nextToken.type === 'inline') {
          let headingLevel;
          let fontSize;
          switch (level) {
            case 1:
              headingLevel = HeadingLevel.HEADING_1;
              fontSize = DOCX_STYLES.sizes.h1;
              break;
            case 2:
              headingLevel = HeadingLevel.HEADING_2;
              fontSize = DOCX_STYLES.sizes.h2;
              break;
            case 3:
              headingLevel = HeadingLevel.HEADING_3;
              fontSize = DOCX_STYLES.sizes.h3;
              break;
            default:
              headingLevel = HeadingLevel.HEADING_3;
              fontSize = DOCX_STYLES.sizes.body;
          }

          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: nextToken.content,
                  bold: true,
                  size: fontSize * 2,
                  font: DOCX_STYLES.fonts.heading,
                }),
              ],
              heading: headingLevel,
              spacing: {
                before: DOCX_STYLES.spacing.headingBefore,
                after: DOCX_STYLES.spacing.headingAfter,
              },
            }),
          );
          i += 1; // Skip the inline token
        }
      } else if (token.type === 'paragraph_open') {
        const nextToken = tokens[i + 1];
        if (nextToken && nextToken.type === 'inline' && nextToken.children) {
          const textRuns = processInlineContent(nextToken.children);

          if (textRuns.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: textRuns,
                spacing: {
                  before: inList ? 100 : DOCX_STYLES.spacing.paragraphBefore,
                  after: inList ? 100 : DOCX_STYLES.spacing.paragraphAfter,
                  line: 360,
                },
                alignment: AlignmentType.JUSTIFIED,
              }),
            );
          }
          i += 2; // Skip inline and paragraph_close
        }
      } else if (token.type === 'bullet_list_open') {
        inList = true;
        listType = 'bullet';
      } else if (token.type === 'bullet_list_close') {
        inList = false;
        listType = null;
        paragraphs.push(
          new Paragraph({
            text: '',
            spacing: {
              after: 100,
            },
          }),
        );
      } else if (token.type === 'ordered_list_open') {
        inList = true;
        listType = 'ordered';
        orderedCounter = 1;
      } else if (token.type === 'ordered_list_close') {
        inList = false;
        listType = null;
        orderedCounter = 1;
        paragraphs.push(
          new Paragraph({
            text: '',
            spacing: {
              after: 100,
            },
          }),
        );
      } else if (token.type === 'list_item_open') {
        const nextToken = tokens[i + 1];
        if (nextToken && nextToken.type === 'paragraph_open') {
          const inlineToken = tokens[i + 2];
          if (
            inlineToken &&
            inlineToken.type === 'inline' &&
            inlineToken.children
          ) {
            const textRuns = processInlineContent(inlineToken.children);
            let bulletText = '• ';
            if (listType === 'ordered') {
              bulletText = `${orderedCounter}. `;
              orderedCounter++;
            }

            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: bulletText,
                    font: DOCX_STYLES.fonts.body,
                    size: DOCX_STYLES.sizes.body * 2,
                  }),
                  ...textRuns,
                ],
                spacing: {
                  before: 50,
                  after: 50,
                },
                indent: { left: 720 },
              }),
            );
            i += 4;
          }
        }
      } else if (token.type === 'blockquote_open') {
        const nextToken = tokens[i + 1];
        if (nextToken && nextToken.type === 'paragraph_open') {
          const inlineToken = tokens[i + 2];
          if (
            inlineToken &&
            inlineToken.type === 'inline' &&
            inlineToken.children
          ) {
            const textRuns = processInlineContent(inlineToken.children);

            paragraphs.push(
              new Paragraph({
                children: textRuns,
                spacing: {
                  before: 200,
                  after: 200,
                },
                indent: { left: 720 },
                alignment: AlignmentType.JUSTIFIED,
                border: {
                  left: {
                    color: '4F46E5',
                    space: 1,
                    style: 'single',
                    size: 24,
                  },
                },
                italics: true,
              }),
            );
            i += 4;
          }
        }
      } else if (token.type === 'code_block' || token.type === 'fence') {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: token.content,
                font: 'Courier New',
                size: 20,
                color: '333333',
              }),
            ],
            spacing: {
              before: 200,
              after: 200,
            },
            shading: {
              fill: 'F5F5F5',
            },
          }),
        );
      } else if (token.type === 'hr') {
        paragraphs.push(
          new Paragraph({
            text: '',
            border: {
              bottom: {
                color: 'CCCCCC',
                space: 1,
                style: 'single',
                size: 6,
              },
            },
            spacing: {
              before: 200,
              after: 200,
            },
          }),
        );
      }
    } catch (error) {
      console.error('Error processing token:', token, error);
    }
  }

  return paragraphs;
};

// ========== EXPORT FUNCTIONS ==========

// Export as PDF function
const exportAsPDF = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${book.title.replace(/[^a-zA-Z0-9\s]/g, '_') || 'book'}.pdf"`,
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add cover image if available
    if (book.coverImage && !book.coverImage.includes('pravatar')) {
      const imagePath = book.coverImage.substring(1);
      try {
        if (fs.existsSync(imagePath)) {
          doc.image(imagePath, {
            fit: [400, 550],
            align: 'center',
            valign: 'center',
          });
          doc.addPage();
        }
      } catch (error) {
        console.error('Error loading cover image for PDF:', error);
      }
    }

    // Title page
    doc.moveDown(5);
    doc
      .fontSize(TYPOGRAPHY.sizes.title)
      .font(TYPOGRAPHY.fonts.sansBold)
      .fillColor(TYPOGRAPHY.colors.heading)
      .text(book.title, {
        align: 'center',
      });

    if (book.subtitle && book.subtitle.trim()) {
      doc.moveDown(1);
      doc
        .fontSize(TYPOGRAPHY.sizes.subtitle)
        .font(TYPOGRAPHY.fonts.sans)
        .fillColor('#4A5568')
        .text(book.subtitle, {
          align: 'center',
        });
    }

    doc.moveDown(1);
    doc
      .fontSize(TYPOGRAPHY.sizes.author)
      .font(TYPOGRAPHY.fonts.sans)
      .fillColor('#2D3748')
      .text(`by ${book.author || 'Unknown Author'}`, {
        align: 'center',
      });

    doc.addPage();

    // Add chapters
    if (book.chapters && book.chapters.length > 0) {
      book.chapters.forEach((chapter, index) => {
        if (index > 0) {
          doc.addPage();
        }

        // Chapter title
        doc
          .fontSize(TYPOGRAPHY.sizes.chapterTitle)
          .font(TYPOGRAPHY.fonts.sansBold)
          .fillColor(TYPOGRAPHY.colors.heading)
          .text(chapter.title);

        doc.moveDown(TYPOGRAPHY.spacing.chapterSpacing / TYPOGRAPHY.sizes.body);

        // Chapter content with markdown rendering
        renderMarkdown(doc, chapter.content || '');
      });
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Server error during PDF export',
        error: error.message,
      });
    }
  }
};

// Export as DOCX function
const exportAsDocument = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const sections = [];

    // Cover page with image if available
    if (book.coverImage && !book.coverImage.includes('pravatar')) {
      const imagePath = book.coverImage.substring(1);

      try {
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);

          // Add cover image
          sections.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: { width: 400, height: 550 },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: {
                before: 400,
                after: 400,
              },
            }),
          );

          // Page break after cover image
          sections.push(
            new Paragraph({
              text: '',
              pageBreakBefore: true,
            }),
          );
        }
      } catch (error) {
        console.error('Error loading cover image:', error);
      }
    }

    // Title page section
    const titlePage = [];

    // Main title
    titlePage.push(
      new Paragraph({
        children: [
          new TextRun({
            text: book.title,
            bold: true,
            size: DOCX_STYLES.sizes.title * 2,
            font: DOCX_STYLES.fonts.heading,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 2000,
          after: 400,
        },
      }),
    );

    // Subtitle if exists
    if (book.subtitle && book.subtitle.trim()) {
      titlePage.push(
        new Paragraph({
          children: [
            new TextRun({
              text: book.subtitle,
              size: DOCX_STYLES.sizes.subtitle * 2,
              font: DOCX_STYLES.fonts.heading,
              color: '4A5568',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 400,
          },
        }),
      );
    }

    // Author
    titlePage.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `by ${book.author || 'Unknown Author'}`,
            size: DOCX_STYLES.sizes.author * 2,
            font: DOCX_STYLES.fonts.heading,
            color: '2D3748',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );

    // Decorative line
    titlePage.push(
      new Paragraph({
        text: '',
        border: {
          bottom: {
            color: '4F46E5',
            space: 1,
            style: 'single',
            size: 12,
          },
        },
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
      }),
    );

    // Page break after title page
    titlePage.push(
      new Paragraph({
        text: '',
        pageBreakBefore: true,
      }),
    );

    sections.push(...titlePage);

    // Process each chapter
    if (book.chapters && book.chapters.length > 0) {
      book.chapters.forEach((chapter, index) => {
        try {
          // Page break before each chapter except the first
          if (index > 0) {
            sections.push(
              new Paragraph({
                text: '',
                pageBreakBefore: true,
              }),
            );
          }

          // Chapter title
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: chapter.title,
                  bold: true,
                  size: DOCX_STYLES.sizes.chapterTitle * 2,
                  font: DOCX_STYLES.fonts.heading,
                  color: '1A202C',
                }),
              ],
              spacing: {
                before: DOCX_STYLES.spacing.chapterBefore,
                after: DOCX_STYLES.spacing.chapterAfter,
              },
            }),
          );

          // Chapter content
          const contentParagraphs = processMarkdownToDocx(
            chapter.content || '',
          );
          sections.push(...contentParagraphs);
        } catch (error) {
          console.error(`Error processing chapter ${index}:`, error);
        }
      });
    }

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children: sections,
        },
      ],
    });

    // Generate the document buffer
    const buffer = await Packer.toBuffer(doc);

    // Send the document as a download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${book.title.replace(/[^a-zA-Z0-9\s]/g, '_') || 'book'}.docx"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting document:', error);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Server error during document export',
        error: error.message,
      });
    }
  }
};

module.exports = {
  exportAsPDF,
  exportAsDocument,
};
